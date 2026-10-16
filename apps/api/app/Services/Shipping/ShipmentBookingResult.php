<?php

namespace App\Services\Shipping;

/**
 * Hasil memesan kurir, sudah dinormalisasi dari response provider.
 *
 * `waybillId` (nomor resi) bisa null: untuk sebagian kurir resi baru terbit
 * setelah order diproses provider. `price` = harga yang benar-benar ditagih
 * provider (rupiah bulat), untuk dibandingkan dengan perkiraan saat checkout.
 */
final readonly class ShipmentBookingResult
{
    public function __construct(
        public string $providerOrderId,
        public ?string $waybillId,
        public ?string $trackingId,
        public ?string $trackingLink,
        public int $price,
        public ?string $status,
    ) {}
}
