<?php

namespace App\Services\Shipping;

use App\Enums\OrderStatus;
use App\Enums\ShipmentStatus;
use App\Exceptions\ShipmentBookingException;
use App\Exceptions\ShippingProviderException;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Shipment;
use App\Services\CheckoutPricing;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Booking kurir ke Biteship dari tombol "Siap Kirim" di admin (Langkah D2).
 *
 * Keputusan (lihat docs/decisions/shipping-biteship.md §1.10):
 * - SEMI-OTOMATIS & SINKRON: admin menekan tombol, backend langsung memesan
 *   kurir dan hasilnya tampil seketika. Tanpa queue/worker — production belum
 *   punya worker, dan booking memang menunggu keputusan manusia (paket siap).
 * - Pengaman klik ganda / dua admin: baris order + shipment dikunci
 *   (lockForUpdate) selama booking dan biteship_order_id dicek ulang setelah
 *   kunci didapat; di sisi Biteship, reference_id = order_number ditolak kalau
 *   dipakai ulang (40002060).
 * - Gagal: alasan disimpan di shipments.booking_error (+ booking_attempted_at)
 *   lalu exception dilempar ulang ke UI. Status order/shipment tidak berubah,
 *   jadi admin bisa "Coba Lagi" dengan aksi yang sama.
 * - Harga booking ≠ perkiraan: booking TETAP jalan (pembeli sudah bayar);
 *   selisihnya di-log dan dikembalikan ke UI.
 */
class ShipmentBookingService
{
    public function __construct(
        private readonly ShippingProvider $provider,
        private readonly ShippingSettings $settings,
    ) {}

    /**
     * Syarat tombol "Siap Kirim" tampil: order paid, punya shipment, belum
     * dibooking. Dicek ulang (di bawah kunci) oleh book().
     */
    public static function canBook(Order $order): bool
    {
        return $order->status === OrderStatus::Paid
            && $order->shipment !== null
            && ! $order->shipment->isBooked();
    }

    /**
     * @throws ShipmentBookingException   syarat tidak terpenuhi / data kita belum lengkap
     * @throws ShippingProviderException  Biteship menolak / tidak bisa dihubungi
     */
    public function book(Order $order): ShipmentBookingOutcome
    {
        // Transaksi menahan kunci baris SELAMA panggilan Biteship (≤ timeout
        // HTTP). Disengaja: aksi admin yang jarang, dan kunci inilah yang
        // mencegah dua booking berbayar untuk order yang sama.
        $outcome = DB::transaction(function () use ($order): ShipmentBookingOutcome|Throwable {
            /** @var Order $lockedOrder */
            $lockedOrder = Order::query()->whereKey($order->getKey())->lockForUpdate()->firstOrFail();

            /** @var Shipment|null $shipment */
            $shipment = Shipment::query()->where('order_id', $lockedOrder->getKey())->lockForUpdate()->first();

            // Syarat dasar — tidak dicatat sebagai booking_error (bukan
            // percobaan booking yang gagal, tombolnya memang tidak relevan).
            if ($lockedOrder->status !== OrderStatus::Paid) {
                throw new ShipmentBookingException(
                    "Order {$lockedOrder->order_number} belum bisa dikirim: status sekarang \"{$lockedOrder->status->value}\", harus \"paid\"."
                );
            }

            if ($shipment === null) {
                throw new ShipmentBookingException('Order ini tidak punya data pengiriman (shipment).');
            }

            // Cek ulang SETELAH kunci: klik kedua / admin lain yang menunggu kunci
            // berhenti di sini, tidak membooking dua kali.
            if ($shipment->isBooked()) {
                throw new ShipmentBookingException(
                    "Order ini sudah dibooking ke Biteship (ID {$shipment->biteship_order_id})."
                );
            }

            try {
                $request = $this->buildRequest($lockedOrder, $shipment);
                $result = $this->provider->createShipment($request);
            } catch (ShipmentBookingException|ShippingProviderException $e) {
                // Dicatat lalu DIKEMBALIKAN (bukan dilempar di dalam transaksi),
                // supaya catatan gagal ikut ter-commit — kalau dilempar di sini,
                // update ini ikut ter-rollback.
                $shipment->update([
                    'booking_error' => $e->getMessage(),
                    'booking_attempted_at' => now(),
                ]);

                return $e;
            }

            $shipment->update([
                'biteship_order_id' => $result->providerOrderId,
                'tracking_number' => $result->waybillId,
                'biteship_tracking_id' => $result->trackingId,
                'tracking_link' => $result->trackingLink,
                'booked_price' => $result->price,
                'booked_at' => now(),
                'booking_attempted_at' => now(),
                'booking_error' => null,
                'status' => ShipmentStatus::Processing,
            ]);

            $lockedOrder->update(['status' => OrderStatus::Processing]);

            return new ShipmentBookingOutcome($shipment, $shipment->expectedBookingPrice(), $result->price);
        });

        if ($outcome instanceof Throwable) {
            throw $outcome;
        }

        if ($outcome->priceDifference() !== 0) {
            Log::warning('Booking Biteship: harga berbeda dari perkiraan checkout.', [
                'order_id' => $order->getKey(),
                'order_number' => $order->order_number,
                'biteship_order_id' => $outcome->shipment->biteship_order_id,
                'expected_price' => $outcome->expectedPrice,
                'booked_price' => $outcome->bookedPrice,
                'difference' => $outcome->priceDifference(),
            ]);
        }

        return $outcome;
    }

    /**
     * Susun request booking dari config gudang + alamat order + item order.
     *
     * @throws ShipmentBookingException  konfigurasi gudang / alamat / berat belum lengkap
     */
    private function buildRequest(Order $order, Shipment $shipment): ShipmentBookingRequest
    {
        // Data gudang efektif: halaman admin Pengaturan Pengiriman → cadangan .env.
        $origin = $this->settings->origin();

        $originName = trim((string) ($origin['contact_name'] ?? ''));
        $originPhone = trim((string) ($origin['contact_phone'] ?? ''));
        $originAddress = trim((string) ($origin['address'] ?? ''));
        $originPostalCode = trim((string) ($origin['postal_code'] ?? ''));
        $originAreaId = trim((string) ($origin['area_id'] ?? ''));

        // Nama field di halaman admin + nama env cadangannya disebut langsung
        // supaya admin / pemegang VPS tahu apa yang harus diisi (nilainya tidak
        // pernah ditampilkan).
        $missing = array_keys(array_filter([
            'nama kontak (BITESHIP_ORIGIN_CONTACT_NAME)' => $originName === '',
            'telepon (BITESHIP_ORIGIN_CONTACT_PHONE)' => $originPhone === '',
            'alamat (BITESHIP_ORIGIN_ADDRESS)' => $originAddress === '',
            'area / kode pos (BITESHIP_ORIGIN_AREA_ID / _POSTAL_CODE)' => $originPostalCode === '' && $originAreaId === '',
        ]));

        if ($missing !== []) {
            throw new ShipmentBookingException(
                'Data gudang belum lengkap — isi di halaman Pengaturan Pengiriman: '.implode(', ', $missing).'.'
            );
        }

        $address = (array) $order->shipping_address;

        $destinationName = trim((string) ($address['name'] ?? $order->guest_name ?? ''));
        $destinationPhone = trim((string) ($address['phone'] ?? ''));

        // Alamat untuk kurir: detail + label area (kelurahan/kecamatan/kota/kode
        // pos). Order sebelum alamat terstruktur hanya punya `address` gabungan.
        $detail = trim((string) ($address['address_detail'] ?? ''));
        $areaLabel = trim((string) ($address['area_label'] ?? ''));
        $destinationAddress = $detail !== ''
            ? implode(', ', array_filter([$detail, $areaLabel]))
            : trim((string) ($address['address'] ?? ''));

        $destinationAreaId = trim((string) ($address['area_id'] ?? ''));
        $destinationPostalCode = trim((string) ($address['postal_code'] ?? ''));

        if ($destinationName === '' || $destinationPhone === '' || $destinationAddress === '') {
            throw new ShipmentBookingException('Nama, telepon, atau alamat penerima di order ini kosong.');
        }

        if ($destinationAreaId === '' && $destinationPostalCode === '') {
            throw new ShipmentBookingException('Order ini tidak punya area tujuan maupun kode pos penerima.');
        }

        $items = $this->buildItems($order);

        $courierNote = trim((string) ($address['courier_note'] ?? ''));

        return new ShipmentBookingRequest(
            originContactName: $originName,
            originContactPhone: $originPhone,
            originAddress: $originAddress,
            originPostalCode: $originPostalCode !== '' ? $originPostalCode : null,
            originAreaId: $originAreaId !== '' ? $originAreaId : null,
            destinationContactName: $destinationName,
            destinationContactPhone: $destinationPhone,
            destinationAddress: $destinationAddress,
            destinationPostalCode: $destinationPostalCode !== '' ? $destinationPostalCode : null,
            destinationAreaId: $destinationAreaId !== '' ? $destinationAreaId : null,
            destinationNote: $courierNote !== '' ? $courierNote : null,
            courierCompany: (string) $shipment->courier,
            courierType: (string) $shipment->service_code,
            // Hanya kalau pembeli membayar asuransi saat checkout (D1).
            insuranceValue: $shipment->insurance_value !== null
                ? CheckoutPricing::toRupiah((float) $shipment->insurance_value)
                : null,
            referenceId: $order->order_number,
            orderNote: null,
            items: $items,
        );
    }

    /**
     * Item dari order_items: nama + ukuran & harga dari SNAPSHOT order (yang
     * dibayar pembeli), berat dari produk SAAT INI (order_items tidak
     * menyimpan berat).
     *
     * @return array<int, array{name: string, value: int, quantity: int, weight: int}>
     *
     * @throws ShipmentBookingException  item tanpa berat / produknya sudah dihapus
     */
    private function buildItems(Order $order): array
    {
        $orderItems = $order->items()->with('productVariant.product')->get();

        if ($orderItems->isEmpty()) {
            throw new ShipmentBookingException('Order ini tidak punya item.');
        }

        return $orderItems->map(function (OrderItem $item): array {
            $label = "{$item->product_name} ({$item->size})";
            $product = $item->productVariant?->product;

            if ($product === null) {
                throw new ShipmentBookingException(
                    "Produk {$label} sudah dihapus, jadi beratnya tidak diketahui. Booking manual lewat dashboard Biteship."
                );
            }

            if ($product->weight_grams === null || $product->weight_grams < 1) {
                throw new ShipmentBookingException("Berat produk {$product->name} belum diatur.");
            }

            return [
                'name' => mb_substr("{$item->product_name} - {$item->size}", 0, 100),
                'value' => CheckoutPricing::toRupiah((float) $item->price),
                'quantity' => (int) $item->quantity,
                'weight' => (int) $product->weight_grams,
            ];
        })->values()->all();
    }
}
