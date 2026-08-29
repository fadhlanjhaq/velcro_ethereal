<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Dilempar dari OrderController::createOrderWithSnapToken() saat Order::create()
 * kena unique violation pada kolom `idempotency_key` — artinya request lain
 * dengan key yang sama menang duluan INSERT-nya (race).
 *
 * Ditangkap di OrderController::store(): transaksi sudah ter-rollback, lalu
 * order pemenang di-re-fetch dan response-nya di-replay (200), atau dibalas 409
 * kalau order pemenang itu belum lengkap.
 */
class DuplicateIdempotencyKeyException extends RuntimeException
{
}
