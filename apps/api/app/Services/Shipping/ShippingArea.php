<?php

namespace App\Services\Shipping;

/**
 * Satu hasil pencarian area tujuan, sudah dinormalisasi dari bentuk provider.
 */
final readonly class ShippingArea
{
    public function __construct(
        public string $id,
        public string $label,
        public ?string $postalCode,
    ) {}

    /**
     * Bentuk JSON publik untuk GET /api/shipping/areas.
     *
     * @return array{id: string, label: string, postal_code: string|null}
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'label' => $this->label,
            'postal_code' => $this->postalCode,
        ];
    }
}
