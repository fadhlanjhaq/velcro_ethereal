<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Dilempar dari ShippingProvider (mis. BiteshipShippingProvider) saat provider
 * ongkir menolak request, membalas success:false, tidak bisa dihubungi, atau
 * konfigurasinya belum lengkap.
 *
 * Sengaja TANPA render(): pesan exception berisi detail teknis untuk log, bukan
 * untuk pembeli. ShippingController menangkapnya, me-report(), lalu membalas
 * 502 dengan pesan generik — pola yang sama dengan PaymentGatewayException di
 * OrderController.
 */
class ShippingProviderException extends RuntimeException
{
}
