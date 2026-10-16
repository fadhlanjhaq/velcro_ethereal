<?php

namespace App\Models;

use App\Enums\ShipmentStatus;
use App\Services\Shipping\BiteshipOrderStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'order_id', 'courier', 'courier_name', 'service_code', 'service_name', 'cost', 'provider_cost', 'etd',
    'insurance_value', 'insurance_fee',
    'tracking_number', 'biteship_order_id', 'biteship_tracking_id', 'tracking_link', 'status',
    'booked_at', 'booking_attempted_at', 'booking_error', 'booked_price',
    'provider_status', 'provider_status_at', 'shipped_at', 'delivered_at',
    'provider_final_price', 'last_webhook_payload',
])]
class Shipment extends Model
{
    use HasFactory;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'cost' => 'decimal:2',
            'provider_cost' => 'decimal:2',
            'insurance_value' => 'decimal:2',
            'insurance_fee' => 'decimal:2',
            'booked_price' => 'decimal:2',
            'booked_at' => 'datetime',
            'booking_attempted_at' => 'datetime',
            'provider_status_at' => 'datetime',
            'shipped_at' => 'datetime',
            'delivered_at' => 'datetime',
            'provider_final_price' => 'decimal:2',
            'last_webhook_payload' => 'array',
            'status' => ShipmentStatus::class,
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * Sudah dibooking ke Biteship (tombol "Siap Kirim" sukses).
     */
    public function isBooked(): bool
    {
        return $this->biteship_order_id !== null;
    }

    /**
     * Percobaan booking terakhir gagal dan belum ada booking yang sukses.
     */
    public function bookingFailed(): bool
    {
        return ! $this->isBooked() && $this->booking_error !== null;
    }

    /**
     * Status kurir terakhir dari webhook termasuk kelompok "bermasalah"
     * (cancelled, on_hold, returned, ...). Lihat BiteshipOrderStatus.
     */
    public function hasProviderProblem(): bool
    {
        return BiteshipOrderStatus::isProblem($this->provider_status);
    }

    /**
     * Harga akhir dari Biteship (event order.price) berbeda dari harga saat
     * booking — selisihnya ditanggung toko.
     */
    public function finalPriceChanged(): bool
    {
        return $this->provider_final_price !== null
            && $this->booked_price !== null
            && (int) round((float) $this->provider_final_price) !== (int) round((float) $this->booked_price);
    }

    /**
     * Perkiraan harga booking = tarif asli kurir + biaya asuransi (kalau
     * diasuransikan), rupiah bulat. Markup toko tidak ikut — itu bukan bagian
     * yang dibayar ke Biteship. Shipment sebelum markup tidak punya
     * provider_cost; saat itu tarif asli = cost.
     */
    public function expectedBookingPrice(): int
    {
        $providerCost = $this->provider_cost ?? $this->cost ?? 0;

        return (int) round((float) $providerCost + (float) ($this->insurance_fee ?? 0));
    }
}
