<?php

namespace App\Exceptions;

use RuntimeException;
use Throwable;

/**
 * Dilempar dari ShippingProvider (mis. BiteshipShippingProvider) saat provider
 * ongkir menolak request, membalas success:false, tidak bisa dihubungi, atau
 * konfigurasinya belum lengkap.
 *
 * Sengaja TANPA render(): pesan exception berisi detail teknis untuk log, bukan
 * untuk pembeli. ShippingController menangkapnya, me-report(), lalu membalas
 * 502 dengan pesan generik — pola yang sama dengan PaymentGatewayException di
 * OrderController. Di panel admin (booking kurir, Langkah D2) pesannya memang
 * ditampilkan ke admin, karena di sana alasan gagal perlu terlihat.
 *
 * `providerCode` / `providerMessage` = `code` / `error` dari body Biteship
 * (kalau ada), supaya pemanggil bisa mengenali error tertentu (mis. 40002060,
 * reference_id sudah dipakai) tanpa mem-parsing teks pesan.
 */
class ShippingProviderException extends RuntimeException
{
    public function __construct(
        string $message = '',
        public readonly int|string|null $providerCode = null,
        public readonly ?string $providerMessage = null,
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }
}
