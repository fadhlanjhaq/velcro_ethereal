<?php

namespace App\Services\Shipping;

use App\Exceptions\InvalidShippingItemException;
use App\Exceptions\ShippingProviderException;
use App\Services\CheckoutPricing;
use Illuminate\Support\Facades\Cache;

/**
 * Satu-satunya jalur untuk mendapatkan tarif kurir: susun item dari DB →
 * cache → Biteship → filter allowlist → urut termurah → markup toko.
 *
 * Dipakai BERSAMA oleh POST /api/shipping/rates (tarif yang dilihat pembeli)
 * dan POST /api/orders (hitung ulang saat order dibuat). Karena cache key,
 * allowlist, dan urutannya sama persis, angka yang dihitung ulang identik
 * dengan yang ditampilkan — kecuali cache-nya sudah kedaluwarsa dan Biteship
 * memberi harga baru; kasus itu ditolak di OrderController (shipping_cost_changed).
 *
 * Markup ongkir (ShippingSettings::shippingMarkup(), admin → cadangan .env
 * SHIPPING_MARKUP) dipasang SETELAH data
 * dibaca dari cache: cache tetap berisi tarif asli Biteship, jadi perubahan
 * SHIPPING_MARKUP langsung berlaku tanpa menunggu TTL, dan tarif asli tetap
 * tersedia sebagai ShippingRate::$providerCost untuk booking di Langkah D.
 */
class ShippingQuoteService
{
    /**
     * Tarif kurir bisa berubah (promo, surcharge) → cache pendek, cukup untuk
     * menahan pembeli yang bolak-balik di halaman checkout.
     */
    private const RATES_TTL_SECONDS = 60 * 10;

    public function __construct(
        private readonly ShippingItemsBuilder $itemsBuilder,
        private readonly ShippingProvider $provider,
        private readonly ShippingServiceAllowlist $allowlist,
        private readonly ShippingSettings $settings,
    ) {}

    /**
     * @param  array<int, array{product_variant_id: int|string, quantity: int|string}>  $lines  isi cart
     *
     * @throws InvalidShippingItemException  produk nonaktif / berat kosong (→ 422)
     * @throws ShippingProviderException     Biteship gagal / konfigurasi kurang
     */
    public function quote(string $destinationAreaId, array $lines): ShippingQuote
    {
        // Item disusun dari DB (harga & berat) SETIAP request — bukan dari
        // cache — sudah diagregasi + diurutkan per varian → deterministik untuk
        // cache key. Berat ikut di key, jadi begitu admin mengubah berat produk,
        // cache lama otomatis tidak terpakai. Allowlist layanan juga ikut di key
        // supaya perubahan BITESHIP_ALLOWED_SERVICES langsung berlaku tanpa
        // menunggu TTL.
        $resolved = $this->itemsBuilder->resolve($lines);
        $items = $this->itemsBuilder->toProviderItems($resolved);

        // `v` dinaikkan setiap bentuk data yang di-cache berubah. v2 (D1):
        // request kini membawa courier_insurance dan tarif menyimpan field
        // asuransi — entri lama tidak dipakai lagi.
        $cacheKey = 'shipping:rates:'.hash('sha256', json_encode([
            'v' => 2,
            // Nilai EFEKTIF (admin → cadangan .env): mengganti area gudang /
            // kurir di admin otomatis memakai entri cache baru.
            'origin' => (string) $this->settings->origin()['area_id'],
            'couriers' => $this->settings->couriers(),
            'destination' => $destinationAreaId,
            'items' => $items,
            'allowed_services' => $this->allowlist->entries(),
        ]));

        $rows = Cache::remember(
            $cacheKey,
            self::RATES_TTL_SECONDS,
            function () use ($destinationAreaId, $items): array {
                // Filter SEBELUM masuk cache: yang tersimpan hanya layanan
                // yang boleh dijual, dengan tarif ASLI (tanpa markup).
                $rates = $this->allowlist->filter($this->provider->getRates($destinationAreaId, $items));

                usort($rates, static fn (ShippingRate $a, ShippingRate $b): int => $a->cost <=> $b->cost);

                return array_map(static fn (ShippingRate $rate): array => $rate->toArray(), $rates);
            },
        );

        // Markup flat per order. Urutan termurah tidak berubah karena semua
        // layanan mendapat markup yang sama.
        $markup = $this->settings->shippingMarkup();

        $rates = array_map(
            static fn (array $row): ShippingRate => ShippingRate::fromArray($row)->withMarkup($markup),
            $rows,
        );

        // Harga produk untuk ringkasan checkout — rumus yang sama dengan
        // OrderController (CheckoutPricing), dari data DB yang baru di-resolve.
        $priced = array_map(static fn (array $line): array => [
            'product_variant_id' => $line['variant']->id,
            'unit_price' => CheckoutPricing::toRupiah($line['price']),
            'quantity' => $line['quantity'],
            'line_total' => CheckoutPricing::toRupiah(
                CheckoutPricing::subtotal([['price' => $line['price'], 'quantity' => $line['quantity']]]),
            ),
        ], $resolved);

        $subtotal = CheckoutPricing::toRupiah(CheckoutPricing::subtotal(array_map(
            static fn (array $line): array => ['price' => $line['price'], 'quantity' => $line['quantity']],
            $resolved,
        )));

        return new ShippingQuote($rates, $priced, $subtotal);
    }

    /**
     * Cari layanan pilihan pembeli di hasil quote(). `null` kalau tidak ada
     * lagi, atau di luar allowlist (dicek ulang eksplisit — jangan bergantung
     * pada filter di cache saja).
     *
     * @param  array<int, ShippingRate>  $rates
     */
    public function find(array $rates, string $courierCode, string $serviceCode): ?ShippingRate
    {
        if (! $this->allowlist->allows($courierCode, $serviceCode)) {
            return null;
        }

        foreach ($rates as $rate) {
            if (
                strtolower($rate->courierCode) === strtolower($courierCode)
                && strtolower($rate->serviceCode) === strtolower($serviceCode)
            ) {
                return $rate;
            }
        }

        return null;
    }
}
