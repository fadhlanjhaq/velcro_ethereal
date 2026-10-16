<?php

namespace App\Services\Shipping;

/**
 * Hasil ShippingQuoteService::quote(): tarif kurir (sudah termasuk markup) +
 * harga produk dari DB untuk ringkasan checkout.
 *
 * `items` dan `subtotal` dikirim di meta POST /api/shipping/rates supaya
 * /checkout menampilkan angka backend, bukan harga yang tersimpan di cart saat
 * item ditambahkan (bisa basi kalau admin mengubah harga).
 */
final readonly class ShippingQuote
{
    /**
     * @param  array<int, ShippingRate>  $rates  sudah difilter allowlist + markup, urut cost naik
     * @param  array<int, array{product_variant_id: int, unit_price: int, quantity: int, line_total: int}>  $items
     * @param  int  $subtotal  rupiah bulat, dihitung dengan CheckoutPricing — identik dengan OrderController
     */
    public function __construct(
        public array $rates,
        public array $items,
        public int $subtotal,
    ) {}
}
