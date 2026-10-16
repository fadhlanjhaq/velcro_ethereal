<?php

namespace App\Services;

use App\Models\ProductVariant;

/**
 * Satu-satunya rumus harga checkout: harga satuan efektif varian dan subtotal.
 *
 * Dipakai bersama oleh OrderController (snapshot + gross_amount),
 * ShippingItemsBuilder (nilai barang ke Biteship + harga yang dikirim di meta
 * POST /api/shipping/rates), dan ProductVariantResource. Tujuannya: subtotal
 * yang ditampilkan di /checkout identik dengan yang dihitung saat order dibuat,
 * jadi `expected_total` pembeli = `gross_amount` — tidak ada lagi
 * total_changed "buntu" karena dua tempat menghitung dengan cara berbeda.
 */
final class CheckoutPricing
{
    /**
     * Harga satuan efektif: override varian kalau ada, kalau tidak harga dasar
     * produk. String decimal "850000.00" (bentuk cast decimal:2), sama dengan
     * `base_price` di API produk.
     */
    public static function unitPriceString(ProductVariant $variant): string
    {
        return (string) ($variant->price_override ?? $variant->product->base_price);
    }

    public static function unitPrice(ProductVariant $variant): float
    {
        return (float) self::unitPriceString($variant);
    }

    /**
     * Subtotal dalam rupiah (boleh pecahan sen, untuk kolom orders.subtotal).
     *
     * Dijumlahkan dalam SEN bulat, bukan float langsung: hasilnya tidak
     * bergantung pada urutan baris (OrderController mengikuti urutan request,
     * ShippingItemsBuilder diurutkan per varian) dan tidak ada sisa pembulatan
     * float yang bisa menggeser round() di batas .5.
     *
     * @param  array<int, array{price: float, quantity: int}>  $lines
     */
    public static function subtotal(array $lines): float
    {
        $cents = 0;

        foreach ($lines as $line) {
            $cents += (int) round($line['price'] * 100) * (int) $line['quantity'];
        }

        return $cents / 100;
    }

    /**
     * Pembulatan ke rupiah bulat — sama dengan gross_amount Midtrans.
     */
    public static function toRupiah(float $amount): int
    {
        return (int) round($amount);
    }
}
