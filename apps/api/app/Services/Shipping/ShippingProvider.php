<?php

namespace App\Services\Shipping;

use App\Exceptions\ShippingProviderException;

/**
 * Kontrak penyedia ongkir. Satu-satunya implementasi saat ini adalah
 * BiteshipShippingProvider (di-bind di AppServiceProvider).
 *
 * Sengaja tipis — hanya method yang benar-benar dipakai. Tujuannya bukan "siap
 * ganti vendor kapan saja", tapi supaya controller, checkout, dan admin tidak
 * pernah menyentuh bentuk mentah response Biteship (selalu lewat DTO).
 * createShipment ditambahkan di Langkah D2 (tombol "Siap Kirim"); update status
 * resi otomatis (webhook/polling) masih ditunda. Lihat
 * docs/decisions/shipping-biteship.md.
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

    /**
     * Pesan kurir (buat order pengiriman) — memotong saldo provider.
     *
     * @throws ShippingProviderException  provider menolak (saldo kurang, data tidak valid,
     *                                    reference_id sudah dipakai, ...) / tidak bisa dihubungi
     */
    public function createShipment(ShipmentBookingRequest $request): ShipmentBookingResult;
}
