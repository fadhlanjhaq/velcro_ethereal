<?php

namespace App\Services\Shipping;

use App\Models\Shipment;

/**
 * Hasil ShipmentBookingService::book() yang sukses, untuk notifikasi admin.
 *
 * `expectedPrice` = provider_cost + insurance_fee (yang dihitung saat
 * checkout); `bookedPrice` = harga yang benar-benar ditagih Biteship. Selisih ≠ 0
 * tidak menggagalkan booking (pembeli sudah bayar) — hanya dilaporkan.
 */
final readonly class ShipmentBookingOutcome
{
    public function __construct(
        public Shipment $shipment,
        public int $expectedPrice,
        public int $bookedPrice,
    ) {}

    /**
     * Positif = Biteship menagih LEBIH mahal dari perkiraan (selisih ditanggung
     * toko); negatif = lebih murah.
     */
    public function priceDifference(): int
    {
        return $this->bookedPrice - $this->expectedPrice;
    }
}
