<?php

namespace App\Services\Shipping;

use App\Exceptions\ShippingProviderException;

/**
 * Kontrak penyedia ongkir. Satu-satunya implementasi saat ini adalah
 * BiteshipShippingProvider (di-bind di AppServiceProvider).
 *
 * Sengaja tipis — hanya dua method yang benar-benar dipakai sekarang. Tujuannya
 * bukan "siap ganti vendor kapan saja", tapi supaya controller & checkout tidak
 * pernah menyentuh bentuk mentah response Biteship (selalu lewat DTO). Method
 * booking kurir (createShipment) dan webhook menyusul di Langkah D, ditambahkan
 * saat memang dibutuhkan. Lihat docs/decisions/shipping-biteship.md.
 */
interface ShippingProvider
{
    /**
     * Cari area tujuan (kecamatan/kelurahan + kode pos) untuk autocomplete.
     *
     * @return array<int, ShippingArea>
     *
     * @throws ShippingProviderException  provider error / tidak bisa dihubungi
     */
    public function searchAreas(string $query): array;

    /**
     * Ambil tarif semua kurir yang dikonfigurasi dari origin (config) ke area
     * tujuan.
     *
     * @param  array<int, array{name: string, value: int, weight: int, quantity: int}>  $items  hasil ShippingItemsBuilder
     * @return array<int, ShippingRate>
     *
     * @throws ShippingProviderException  konfigurasi kurang / provider error / tidak bisa dihubungi
     */
    public function getRates(string $destinationAreaId, array $items): array;
}
