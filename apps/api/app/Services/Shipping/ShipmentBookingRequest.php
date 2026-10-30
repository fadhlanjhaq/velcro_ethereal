<?php

namespace App\Services\Shipping;

/**
 * Data untuk memesan kurir (ShippingProvider::createShipment), sudah disusun
 * ShipmentBookingService dari order + shipment + config gudang. Bebas dari
 * bentuk payload Biteship — pemetaan ke field API ada di provider.
 */
final readonly class ShipmentBookingRequest
{
    /**
     * @param  array<int, array{name: string, value: int, quantity: int, weight: int}>  $items  weight dalam gram, value rupiah
     * @param  int|null  $insuranceValue  nilai pertanggungan (rupiah); null = tanpa asuransi
     * @param  string  $referenceId  ID unik order di sisi kita (order_number) — pengaman booking ganda
     */
    public function __construct(
        public string $originContactName,
        public string $originContactPhone,
        public string $originAddress,
        public ?string $originPostalCode,
        public ?string $originAreaId,
        public string $destinationContactName,
        public string $destinationContactPhone,
        public string $destinationAddress,
        public ?string $destinationPostalCode,
        public ?string $destinationAreaId,
        public ?string $destinationNote,
        public string $courierCompany,
        public string $courierType,
        public ?int $insuranceValue,
        public string $referenceId,
        public ?string $orderNote,
        public array $items,
    ) {}
}
