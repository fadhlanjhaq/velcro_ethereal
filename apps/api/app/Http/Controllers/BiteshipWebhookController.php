<?php

namespace App\Http\Controllers;

use App\Enums\OrderStatus;
use App\Enums\ShipmentStatus;
use App\Models\Order;
use App\Models\Shipment;
use App\Services\Shipping\BiteshipOrderStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Webhook status pengiriman dari Biteship (Langkah E2) — server-to-server.
 *
 * Prinsip (lihat docs/decisions/shipping-biteship.md §1.12):
 * - Keaslian: header rahasia yang diatur di dashboard Biteship ("Headers
 *   Signature Key" = nama header, "Headers Signature Secret" = nilainya),
 *   dibandingkan dengan hash_equals SEBELUM data apa pun dibaca/diubah
 *   (satu-satunya pengecualian: request tanpa ID order, lihat handle()). Tidak cocok →
 *   401. Config kosong → SEMUA request ditolak (fail closed).
 *   ASUMSI: Biteship mengirim nilai secret apa adanya di header itu (bukan
 *   HMAC dari body) — docs publik tidak menjelaskan mekanismenya; ini sesuai
 *   nama field di dashboard.
 * - Event: order.status (status berubah), order.waybill_id (resi terbit /
 *   berubah), order.price (harga berubah, mis. berat aktual). Payload dibaca
 *   toleran: ID order dari `order_id`, fallback `id`.
 * - Status hanya MAJU (processing < shipped < delivered): event terlambat
 *   tidak memundurkan status enum, tapi provider_status tetap dicatat.
 *   Status "bermasalah" tidak mengubah enum. Order completed / cancelled
 *   tidak disentuh.
 * - Kiriman tes / tanpa ID order → 200 SEBELUM cek signature, tanpa diproses
 *   (supaya pendaftaran webhook di dashboard berhasil). Order tak dikenal (sudah
 *   lolos signature) → 200 + log. Kesalahan tak terduga
 *   (mis. DB) dibiarkan jadi 500, supaya terlihat gagal di Events Log Biteship
 *   dan bisa di-"Resend".
 */
class BiteshipWebhookController extends Controller
{
    /**
     * Urutan maju status shipment. Pending (belum dibooking) paling awal.
     */
    private const SHIPMENT_RANK = [
        'pending' => 0,
        'processing' => 1,
        'shipped' => 2,
        'delivered' => 3,
    ];

    /**
     * Urutan maju status order. Cancelled sengaja tidak ada: order yang
     * dibatalkan tidak pernah diubah oleh webhook pengiriman.
     */
    private const ORDER_RANK = [
        'pending' => 0,
        'paid' => 1,
        'processing' => 2,
        'shipped' => 3,
        'completed' => 4,
    ];

    public function handle(Request $request): JsonResponse
    {
        $payload = $request->json()->all();
        $orderId = $this->extractOrderId($payload);

        // Body kosong / tanpa ID order — mis. kiriman tes saat webhook
        // didaftarkan di dashboard Biteship — dibalas 200 SEBELUM cek signature.
        // Alasan: docs tidak menjamin kiriman tes membawa header rahasia; kalau
        // ditolak 401, pendaftaran webhook di dashboard bisa gagal.
        // Aman: tanpa ID order tidak ada data yang dibaca maupun diubah — tidak
        // ada query DB, payload tidak disimpan. Penyerang hanya mendapat "OK".
        // Request yang MEMBAWA ID order tetap wajib lolos signature (401).
        if ($orderId === null) {
            Log::info('Biteship webhook: tanpa order_id, diabaikan (kemungkinan kiriman tes).', [
                'event' => is_scalar($payload['event'] ?? null) ? $payload['event'] : null,
            ]);

            return $this->ok();
        }

        if (! $this->hasValidSignature($request)) {
            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        $event = $this->resolveEvent($payload);

        $handled = DB::transaction(function () use ($orderId, $event, $payload): bool {
            /** @var Shipment|null $shipment */
            $shipment = Shipment::query()
                ->where('biteship_order_id', $orderId)
                ->lockForUpdate()
                ->first();

            if ($shipment === null) {
                return false;
            }

            $shipment->last_webhook_payload = $payload;

            // Resi bisa ikut di event apa pun (order.status juga membawa
            // courier_waybill_id), bukan hanya di order.waybill_id.
            $this->applyWaybill($shipment, $payload);

            match ($event) {
                'order.status' => $this->applyStatus($shipment, $payload),
                'order.price' => $this->applyPrice($shipment, $payload),
                'order.waybill_id' => null, // sudah ditangani applyWaybill()
                default => Log::info('Biteship webhook: event tidak dikenal, hanya payload yang disimpan.', [
                    'event' => $event,
                    'biteship_order_id' => $shipment->biteship_order_id,
                ]),
            };

            $shipment->save();

            return true;
        });

        if (! $handled) {
            Log::warning('Biteship webhook: order_id tidak cocok dengan shipment mana pun.', [
                'biteship_order_id' => $orderId,
                'event' => $event,
            ]);
        }

        return $this->ok();
    }

    /**
     * Fail closed: tanpa key/secret di config, tidak ada request yang
     * dipercaya. Nilai secret maupun header yang dikirim tidak pernah di-log.
     */
    private function hasValidSignature(Request $request): bool
    {
        $headerName = trim((string) config('services.biteship.webhook.signature_key'));
        $secret = (string) config('services.biteship.webhook.signature_secret');

        if ($headerName === '' || $secret === '') {
            Log::error('Biteship webhook: BITESHIP_WEBHOOK_SIGNATURE_KEY / _SECRET belum diisi — semua request ditolak.');

            return false;
        }

        $provided = (string) $request->header($headerName, '');

        if ($provided === '' || ! hash_equals($secret, $provided)) {
            Log::warning('Biteship webhook: header signature tidak cocok, request ditolak.', [
                'ip' => $request->ip(),
                'header_present' => $request->headers->has($headerName),
                'event' => $request->input('event'),
            ]);

            return false;
        }

        return true;
    }

    /**
     * ID order Biteship: docs memakai `order_id`; `id` sebagai cadangan kalau
     * bentuk payload berbeda.
     *
     * @param  array<string, mixed>  $payload
     */
    private function extractOrderId(array $payload): ?string
    {
        foreach (['order_id', 'id'] as $field) {
            $value = $payload[$field] ?? null;

            if (is_scalar($value) && trim((string) $value) !== '') {
                return trim((string) $value);
            }
        }

        return null;
    }

    /**
     * Nama event dari `event`. Kalau tidak ada, ditebak dari isi payload
     * (toleran terhadap bentuk yang berbeda dari docs).
     *
     * @param  array<string, mixed>  $payload
     */
    private function resolveEvent(array $payload): string
    {
        $event = strtolower(trim((string) ($payload['event'] ?? '')));

        if ($event !== '') {
            return $event;
        }

        return match (true) {
            isset($payload['price']) && ! isset($payload['courier_company']) => 'order.price',
            isset($payload['status']) => 'order.status',
            default => '',
        };
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function applyWaybill(Shipment $shipment, array $payload): void
    {
        $waybill = $payload['courier_waybill_id'] ?? $payload['waybill_id'] ?? null;

        if (! is_scalar($waybill) || trim((string) $waybill) === '') {
            return;
        }

        $waybill = trim((string) $waybill);

        if ($shipment->tracking_number !== $waybill) {
            Log::info('Biteship webhook: nomor resi diperbarui.', [
                'biteship_order_id' => $shipment->biteship_order_id,
                'from' => $shipment->tracking_number,
                'to' => $waybill,
            ]);

            $shipment->tracking_number = $waybill;
        }
    }

    /**
     * order.status: selalu catat status mentah; ubah status enum hanya kalau
     * MAJU. Order ikut maju (shipped / completed), kecuali sudah completed atau
     * cancelled.
     *
     * @param  array<string, mixed>  $payload
     */
    private function applyStatus(Shipment $shipment, array $payload): void
    {
        $status = strtolower(trim((string) ($payload['status'] ?? '')));

        if ($status === '') {
            return;
        }

        $shipment->provider_status = $status;
        $shipment->provider_status_at = now();

        $group = BiteshipOrderStatus::group($status);

        $target = match ($group) {
            BiteshipOrderStatus::GROUP_PROCESSING => ShipmentStatus::Processing,
            BiteshipOrderStatus::GROUP_SHIPPED => ShipmentStatus::Shipped,
            BiteshipOrderStatus::GROUP_DELIVERED => ShipmentStatus::Delivered,
            // Bermasalah / tidak dikenal: cukup tercatat di provider_status.
            default => null,
        };

        if ($group === null) {
            Log::info('Biteship webhook: status tidak dikenal, hanya dicatat.', [
                'biteship_order_id' => $shipment->biteship_order_id,
                'status' => $status,
            ]);
        }

        if ($target === null) {
            return;
        }

        if (self::SHIPMENT_RANK[$target->value] > self::SHIPMENT_RANK[$shipment->status->value]) {
            $shipment->status = $target;
        } elseif (self::SHIPMENT_RANK[$target->value] < self::SHIPMENT_RANK[$shipment->status->value]) {
            Log::info('Biteship webhook: event status mundur diabaikan (status enum tetap).', [
                'biteship_order_id' => $shipment->biteship_order_id,
                'current' => $shipment->status->value,
                'incoming' => $status,
            ]);
        }

        // Waktu dijemput / sampai diisi sekali. Delivered tanpa event picked
        // sebelumnya tetap mengisi shipped_at supaya urutannya masuk akal.
        if (in_array($target, [ShipmentStatus::Shipped, ShipmentStatus::Delivered], true)
            && $shipment->shipped_at === null) {
            $shipment->shipped_at = now();
        }

        if ($target === ShipmentStatus::Delivered && $shipment->delivered_at === null) {
            $shipment->delivered_at = now();
        }

        $orderTarget = match ($target) {
            ShipmentStatus::Shipped => OrderStatus::Shipped,
            ShipmentStatus::Delivered => OrderStatus::Completed,
            default => null,
        };

        if ($orderTarget !== null) {
            $this->advanceOrder($shipment, $orderTarget);
        }
    }

    private function advanceOrder(Shipment $shipment, OrderStatus $target): void
    {
        /** @var Order $order */
        $order = Order::query()->whereKey($shipment->order_id)->lockForUpdate()->firstOrFail();

        // Order selesai / dibatalkan tidak diubah oleh webhook pengiriman.
        if (in_array($order->status, [OrderStatus::Completed, OrderStatus::Cancelled], true)) {
            return;
        }

        if (self::ORDER_RANK[$target->value] > (self::ORDER_RANK[$order->status->value] ?? PHP_INT_MAX)) {
            $order->update(['status' => $target]);
        }
    }

    /**
     * order.price: simpan harga akhir. Selisih dengan booked_price ditanggung
     * toko (pembeli sudah bayar) — hanya di-log & ditampilkan di admin.
     *
     * @param  array<string, mixed>  $payload
     */
    private function applyPrice(Shipment $shipment, array $payload): void
    {
        $price = $payload['price'] ?? $payload['order_price'] ?? null;

        if (! is_numeric($price)) {
            return;
        }

        $shipment->provider_final_price = (int) round((float) $price);

        if ($shipment->finalPriceChanged()) {
            Log::warning('Biteship webhook: tagihan kurir berubah setelah booking (selisih ditanggung toko).', [
                'biteship_order_id' => $shipment->biteship_order_id,
                'order_id' => $shipment->order_id,
                'booked_price' => (int) round((float) $shipment->booked_price),
                'final_price' => (int) round((float) $price),
            ]);
        }
    }

    private function ok(): JsonResponse
    {
        return response()->json(['message' => 'OK']);
    }
}
