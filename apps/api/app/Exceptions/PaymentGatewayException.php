<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Dilempar oleh MidtransService saat panggilan ke Midtrans gagal (curl error,
 * respons error dari Midtrans, dsb). Ditangkap di OrderController untuk
 * mengembalikan 502 dengan pesan generik; karena dilempar dari dalam
 * DB::transaction(), order yang barusan dibuat otomatis ter-rollback.
 */
class PaymentGatewayException extends RuntimeException
{
}
