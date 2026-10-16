<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu baris pengaturan bisnis pengiriman (halaman admin "Pengaturan
 * Pengiriman"). Jangan dibaca langsung untuk logika ongkir/booking — pakai
 * App\Services\Shipping\ShippingSettings, yang menggabungkan nilai di sini
 * dengan cadangan dari .env.
 */
#[Fillable([
    'origin_contact_name', 'origin_contact_phone', 'origin_address',
    'origin_area_id', 'origin_area_label', 'origin_postal_code',
    'couriers', 'allowed_services', 'shipping_markup', 'updated_by',
])]
class ShippingSetting extends Model
{
    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'couriers' => 'array',
            'allowed_services' => 'array',
            'shipping_markup' => 'integer',
        ];
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
