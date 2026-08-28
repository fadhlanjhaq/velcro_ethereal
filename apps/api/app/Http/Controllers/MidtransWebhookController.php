<?php

namespace App\Http\Controllers;

use App\Exceptions\PaymentGatewayException;
use App\Exceptions\UnknownMidtransStatusException;
use App\Models\Order;
use App\Models\Payment;
use App\Models\ProductVariant;
use App\Services\MidtransService;
use App\Services\MidtransStatusTranslator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Payment notification (webhook) dari Midtrans — dipanggil server-to-server.
 *
 * Prinsip (lihat docs/decisions/payments-midtrans.md §1.5–1.7, §2.5–2.9):
 * - Verifikasi signature SEBELUM apa pun diproses.
 * - Status resmi selalu di-refetch via Transaction::status(); transaction_status
 *   / fraud_status dari body notification TIDAK dipercaya langsung.
 * - Diproses sinkron di sini (project belum punya worker queue di production).
 * - Idempotent: efek samping (potong stok, ubah status order) hanya dijalankan
 *   sekali, pada transisi PERTAMA payment ke "paid".
 * - Kegagalan karena alasan bisnis (signature invalid, order tak ditemukan,
 *   status tak dikenal, Midtrans API error) tetap dibalas HTTP 200 supaya
 *   Midtrans berhenti retry — tapi selalu di-log lengkap untuk investigasi.
 */
class MidtransWebhookController extends Controller
{
    public function __construct(
        private readonly MidtransService $midtrans,
        private readonly MidtransStatusTranslator $translator,
    ) {}

    public function handle(Request $request): JsonResponse
    {
        $orderId = (string) $request->input('order_id', '');
        $statusCode = (string) $request->input('status_code', '');
        $grossAmount = (string) $request->input('gross_amount', '');
        $signatureKey = (string) $request->input('signature_key', '');

        // Verifikasi signature: sha512(order_id + status_code + gross_amount + server_key).
        $expected = hash(
            'sha512',
            $orderId.$statusCode.$grossAmount.config('services.midtrans.server_key'),
        );

        if (! hash_equals($expected, $signatureKey)) {
            Log::warning('Midtrans webhook: signature tidak valid (potensi spoofing).', [
                'order_id' => $orderId,
                'ip' => $request->ip(),
                'payload' => $request->all(),
            ]);

            // Jangan proses, jangan beri tahu pemanggil alasan gagalnya.
            return $this->ok();
        }

        $payment = Payment::query()
            ->where('midtrans_order_id', $orderId)
            ->first();

        if ($payment === null) {
            Log::error('Midtrans webhook: order_id tidak punya padanan Payment lokal.', [
                'order_id' => $orderId,
                'ip' => $request->ip(),
                'payload' => $request->all(),
            ]);

            return $this->ok();
        }

        // Status RESMI dari Midtrans — bukan dari body notification.
        try {
            $official = $this->midtrans->getTransactionStatus($orderId);
        } catch (PaymentGatewayException $e) {
            Log::error('Midtrans webhook: gagal refetch status resmi dari Midtrans.', [
                'order_id' => $orderId,
                'exception' => $e->getMessage(),
            ]);

            // Midtrans akan retry notifikasi berikutnya; kita coba lagi nanti.
            return $this->ok();
        }

        try {
            $this->applyOfficialStatus($payment->id, $orderId, $official);
        } catch (UnknownMidtransStatusException $e) {
            Log::error('Midtrans webhook: status transaksi tidak dikenal, tidak diproses.', [
                'order_id' => $orderId,
                'transaction_status' => $official['transaction_status'] ?? null,
                'fraud_status' => $official['fraud_status'] ?? null,
                'exception' => $e->getMessage(),
            ]);

            // Retry tidak akan menolong sampai mapping diperbaiki → balas 200.
            return $this->ok();
        } catch (Throwable $e) {
            // Kegagalan tak terduga (mis. DB error). Log, lalu biarkan propagate
            // → HTTP 500 supaya Midtrans retry (kemungkinan transient).
            Log::error('Midtrans webhook: kegagalan tak terduga saat memproses status.', [
                'order_id' => $orderId,
                'exception' => $e->getMessage(),
            ]);

            throw $e;
        }

        return $this->ok();
    }

    /**
     * Terapkan status resmi Midtrans ke Payment + efek sampingnya, dalam satu
     * transaksi dengan lock baris Payment (menyerialkan notifikasi yang retry /
     * masuk bersamaan untuk order yang sama).
     *
     * @param  array<string, mixed>  $official  full response Transaction::status()
     *
     * @throws UnknownMidtransStatusException
     */
    private function applyOfficialStatus(int $paymentId, string $orderId, array $official): void
    {
        $transactionStatus = isset($official['transaction_status'])
            ? (string) $official['transaction_status']
            : '';
        $fraudStatus = isset($official['fraud_status']) && $official['fraud_status'] !== null
            ? (string) $official['fraud_status']
            : null;

        // Diterjemahkan di luar transaksi: kalau status tak dikenal, gagal cepat
        // tanpa membuka transaksi DB sama sekali.
        $newStatus = $this->translator->mapToPaymentStatus($transactionStatus, $fraudStatus);

        DB::transaction(function () use (
            $paymentId, $orderId, $official, $transactionStatus, $fraudStatus, $newStatus
        ): void {
            /** @var Payment $payment */
            $payment = Payment::query()
                ->whereKey($paymentId)
                ->lockForUpdate()
                ->firstOrFail();

            // Cross-check nominal — safety net murah, BUKAN gerbang. Signature +
            // refetch status resmi tetap lapisan kepercayaan utama; ini hanya
            // early-warning kalau ada order_id yang kepake ulang secara keliru
            // atau anomali lain. Tidak menggagalkan webhook.
            $officialGross = isset($official['gross_amount'])
                ? (int) round((float) $official['gross_amount'])
                : null;

            if ($officialGross !== null && $officialGross !== $payment->gross_amount) {
                Log::warning('Midtrans webhook: gross_amount tidak cocok dengan catatan lokal — perlu investigasi manual.', [
                    'order_id' => $orderId,
                    'gross_amount_kita' => $payment->gross_amount,
                    'gross_amount_midtrans' => $official['gross_amount'] ?? null,
                ]);
            }

            $wasPaid = $this->translator->isPaidStatus($payment->status);
            $willBePaid = $this->translator->isPaidStatus($newStatus);

            // Idempotency: status tidak berubah DAN payment sudah pernah "paid" →
            // jangan ulangi efek samping (stok/order). Tetap segarkan audit trail
            // dengan payload terbaru, lalu selesai.
            if ($payment->status === $newStatus && $wasPaid) {
                $payment->update([
                    'transaction_status' => $transactionStatus,
                    'fraud_status' => $fraudStatus,
                    'raw_response' => $official,
                ]);

                Log::info('Midtrans webhook: notifikasi ulang untuk status final, efek samping dilewati.', [
                    'order_id' => $orderId,
                    'status' => $newStatus->value,
                ]);

                return;
            }

            $firstTransitionToPaid = ! $wasPaid && $willBePaid;

            $attributes = [
                'status' => $newStatus,
                'transaction_status' => $transactionStatus,
                'fraud_status' => $fraudStatus,
                'raw_response' => $official,
            ];

            if ($firstTransitionToPaid && $payment->paid_at === null) {
                $attributes['paid_at'] = now();
            }

            $payment->update($attributes);

            /** @var Order $order */
            $order = $payment->order()->with('items')->firstOrFail();

            if ($firstTransitionToPaid) {
                $this->decrementStock($order, $orderId);
            }

            $orderStatus = $this->translator->mapToOrderStatus($newStatus);

            if ($orderStatus !== null) {
                $order->update(['status' => $orderStatus]);
            }
        });
    }

    /**
     * Potong stok tiap varian di order sebesar quantity-nya. Dipanggil HANYA
     * pada transisi pertama payment ke "paid".
     *
     * Kalau quantity melebihi stok tersedia (oversell — risiko yang sudah
     * diterima, lihat known limitation §3.8): stok di-clamp ke 0, proses TETAP
     * lanjut (jangan throw/rollback — uang sudah masuk), dan deficit di-log
     * detail sebagai warning supaya admin bisa restock / kontak pembeli manual.
     */
    private function decrementStock(Order $order, string $orderId): void
    {
        foreach ($order->items as $item) {
            if ($item->product_variant_id === null) {
                Log::warning('Midtrans webhook: order item tanpa product_variant_id, stok dilewati.', [
                    'order_id' => $orderId,
                    'order_number' => $order->order_number,
                    'order_item_id' => $item->id,
                ]);

                continue;
            }

            /** @var ProductVariant|null $variant */
            $variant = ProductVariant::query()
                ->whereKey($item->product_variant_id)
                ->lockForUpdate()
                ->first();

            if ($variant === null) {
                Log::warning('Midtrans webhook: ProductVariant tidak ditemukan saat potong stok.', [
                    'order_id' => $orderId,
                    'order_number' => $order->order_number,
                    'product_variant_id' => $item->product_variant_id,
                ]);

                continue;
            }

            $stockBefore = $variant->stock;
            $newStock = max(0, $stockBefore - $item->quantity);

            // Oversell: yang diminta melebihi yang tersedia. Stok di-clamp ke 0
            // (kolom `stock` tetap unsignedInteger). Begitu di-clamp, angka stok
            // tidak lagi menyimpan "kurang berapa" — deficit HANYA tercatat di
            // log ini, jadi log harus lengkap.
            if ($stockBefore < $item->quantity) {
                Log::warning(
                    'Midtrans webhook: OVERSELL — stok diminta melebihi tersedia, stok di-clamp ke 0. '
                    .'Uang sudah masuk; deficit hanya tercatat di log ini (kolom stock tidak menyimpannya). '
                    .'Perlu restock / kontak pembeli manual.',
                    [
                        'order_id' => $orderId,
                        'order_number' => $order->order_number,
                        'product_variant_id' => $variant->id,
                        'sku' => $variant->sku,
                        'stock_before' => $stockBefore,
                        'quantity_requested' => $item->quantity,
                        'deficit' => $item->quantity - $stockBefore,
                    ],
                );
            }

            // Nilai final sudah dihitung manual (bukan decrement()) supaya tidak
            // pernah menembus 0 pada kolom unsigned.
            $variant->stock = $newStock;
            $variant->save();
        }
    }

    private function ok(): JsonResponse
    {
        return response()->json(['message' => 'ok'], 200);
    }
}
