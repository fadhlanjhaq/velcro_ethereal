<?php

namespace App\Services;

use App\Exceptions\PaymentGatewayException;
use Midtrans\Config;
use Midtrans\Snap;
use Midtrans\Transaction;
use Throwable;

/**
 * Wrapper tipis di atas package midtrans/midtrans-php.
 *
 * Dibuat terpisah dari controller karena akan dipakai lagi di webhook handler
 * fase berikutnya (verifikasi signature memakai server_key yang sama), jadi
 * konfigurasi kredensial Midtrans terpusat di satu tempat.
 *
 * Config Midtrans bersifat static global; di-set di constructor supaya setiap
 * kali service ini di-resolve dari container, nilainya dipastikan konsisten
 * dengan config('services.midtrans').
 */
class MidtransService
{
    public function __construct()
    {
        Config::$serverKey = (string) config('services.midtrans.server_key');
        Config::$isProduction = (bool) config('services.midtrans.is_production');
        Config::$isSanitized = true;
        Config::$is3ds = true;
    }

    /**
     * Minta Snap token untuk satu transaksi.
     *
     * @param  array<string, mixed>  $params  payload Snap (transaction_details, item_details, customer_details, ...)
     *
     * @throws PaymentGatewayException  kalau Midtrans menolak / tidak bisa dihubungi
     */
    public function createSnapToken(array $params): string
    {
        try {
            return Snap::getSnapToken($params);
        } catch (Throwable $e) {
            throw new PaymentGatewayException(
                'Gagal meminta Snap token dari Midtrans: '.$e->getMessage(),
                previous: $e,
            );
        }
    }

    /**
     * Ambil status RESMI satu transaksi langsung dari Midtrans (bukan dari body
     * notification). Dipakai webhook handler: rekomendasi resmi Midtrans, dan
     * aman terhadap notifikasi yang retry / telat / tidak berurutan.
     *
     * @return array<string, mixed>  full response Transaction::status(), sebagai array assoc
     *
     * @throws PaymentGatewayException  kalau Midtrans tidak bisa dihubungi / balas error
     */
    public function getTransactionStatus(string $orderId): array
    {
        try {
            $status = Transaction::status($orderId);
        } catch (Throwable $e) {
            throw new PaymentGatewayException(
                'Gagal mengambil status transaksi dari Midtrans: '.$e->getMessage(),
                previous: $e,
            );
        }

        // Transaction::status() mengembalikan stdClass; ubah ke array assoc
        // (rekursif) supaya konsisten disimpan ke kolom json `raw_response`.
        return json_decode(json_encode($status), true);
    }
}
