<?php

namespace App\Services\Shipping;

/**
 * Menyaring tarif ke layanan yang boleh dijual (ShippingSettings: halaman admin
 * Pengaturan Pengiriman → cadangan .env BITESHIP_ALLOWED_SERVICES; format
 * "kurir:layanan").
 *
 * Sengaja kelas terpisah, bukan di dalam BiteshipShippingProvider maupun
 * inline di controller:
 * - Bukan urusan provider: ini kebijakan toko ("layanan mana yang cocok untuk
 *   pakaian"), bukan detail API Biteship. Provider tetap mengembalikan semua
 *   tarif apa adanya.
 * - Dipakai ulang di Langkah C: POST /api/orders harus menolak layanan di luar
 *   allowlist dengan aturan yang PERSIS sama dengan yang ditampilkan ke
 *   pembeli, dan ikut membentuk cache key tarif yang sama.
 */
class ShippingServiceAllowlist
{
    public function __construct(
        private readonly ShippingSettings $settings,
    ) {}

    /**
     * @return array<int, string>  daftar "kurir:layanan" lowercase; kosong = tidak memfilter
     */
    public function entries(): array
    {
        return $this->settings->allowedServices();
    }

    /**
     * @param  array<int, ShippingRate>  $rates
     * @return array<int, ShippingRate>
     */
    public function filter(array $rates): array
    {
        $allowed = $this->entries();

        // Allowlist kosong (env di-set string kosong) = sengaja tampilkan semua.
        if ($allowed === []) {
            return $rates;
        }

        return array_values(array_filter(
            $rates,
            fn (ShippingRate $rate): bool => $this->allows($rate->courierCode, $rate->serviceCode, $allowed),
        ));
    }

    /**
     * @param  array<int, string>|null  $allowed
     */
    public function allows(string $courierCode, string $serviceCode, ?array $allowed = null): bool
    {
        $allowed ??= $this->entries();

        if ($allowed === []) {
            return true;
        }

        return in_array(strtolower($courierCode).':'.strtolower($serviceCode), $allowed, true);
    }
}
