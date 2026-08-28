<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Dilempar MidtransStatusTranslator saat transaction_status / fraud_status dari
 * Midtrans tidak ada di mapping kita — sinyal bahwa Midtrans mungkin menambah
 * status baru yang belum di-handle. Sengaja TIDAK silent-fallback ke status
 * mana pun.
 *
 * Ditangkap di MidtransWebhookController: di-log sebagai error dan webhook tetap
 * dibalas 200 (retry tidak akan menolong sampai mapping-nya diperbaiki).
 */
class UnknownMidtransStatusException extends RuntimeException
{
}
