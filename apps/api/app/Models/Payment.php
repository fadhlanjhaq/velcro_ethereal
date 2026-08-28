<?php

namespace App\Models;

use App\Enums\PaymentStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'order_id', 'midtrans_transaction_id', 'midtrans_order_id', 'snap_token',
    'payment_method', 'status', 'transaction_status', 'fraud_status',
    'amount', 'gross_amount', 'paid_at', 'raw_response', 'expiry_time',
])]
class Payment extends Model
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
            'status' => PaymentStatus::class,
            'amount' => 'decimal:2',
            'gross_amount' => 'integer',
            'paid_at' => 'datetime',
            'raw_response' => 'array',
            'expiry_time' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
