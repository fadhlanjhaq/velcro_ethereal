<?php

namespace App\Services\Shipping;

use App\Exceptions\InvalidShippingItemException;
use App\Models\ProductVariant;
use App\Services\CheckoutPricing;

/**
 * Menyusun daftar item untuk ShippingProvider::getRates() dari isi keranjang
 * [{product_variant_id, quantity}], sekaligus harga produk yang ditampilkan di
 * ringkasan checkout (meta POST /api/shipping/rates).
 *
 * Dipakai lewat ShippingQuoteService, baik saat pembeli melihat tarif maupun
 * saat POST /api/orders menghitung ulang ongkir — item disusun dengan cara yang
 * PERSIS sama, jadi ongkir yang dibayar = yang ditampilkan.
 *
 * Sama seperti OrderController: harga, nama, dan berat selalu diambil dari DB
 * berdasarkan product_variant_id (setiap request, bukan dari cache); apa pun
 * yang dikirim client soal itu diabaikan. Rumus harga lewat CheckoutPricing.
 */
class ShippingItemsBuilder
{
    /**
     * Agregasi + ambil dari DB + validasi (produk aktif, berat terisi).
     *
     * @param  array<int, array{product_variant_id: int|string, quantity: int|string}>  $lines
     * @return array<int, array{variant: ProductVariant, quantity: int, price: float}>  urut product_variant_id
     *
     * @throws InvalidShippingItemException  produk nonaktif / berat belum diisi (→ 422)
     */
    public function resolve(array $lines): array
    {
        // Gabungkan baris dengan product_variant_id sama (pola yang sama dengan
        // OrderController) supaya hasilnya deterministik — penting karena
        // daftar item ini juga jadi bagian dari cache key tarif.
        $quantityByVariant = [];

        foreach ($lines as $line) {
            $variantId = (int) $line['product_variant_id'];
            $quantityByVariant[$variantId] =
                ($quantityByVariant[$variantId] ?? 0) + (int) $line['quantity'];
        }

        ksort($quantityByVariant);

        $variants = ProductVariant::query()
            ->with('product')
            ->whereIn('id', array_keys($quantityByVariant))
            ->get()
            ->keyBy('id');

        $resolved = [];

        foreach ($quantityByVariant as $variantId => $quantity) {
            // `exists:product_variants,id` di FormRequest sudah menyaring ID
            // fiktif; cek ini hanya jaring pengaman kalau varian terhapus di
            // antara validasi dan query.
            /** @var ProductVariant|null $variant */
            $variant = $variants->get($variantId);

            if ($variant === null) {
                throw new InvalidShippingItemException('Produk di keranjang sudah tidak tersedia.');
            }

            $product = $variant->product;

            if ($product->is_active === false) {
                throw new InvalidShippingItemException(
                    "Produk {$product->name} ukuran {$variant->size} sudah tidak tersedia."
                );
            }

            // Kolom weight_grams nullable untuk produk lama (lihat migration).
            // Jangan menebak berat — ongkir yang salah lebih merugikan daripada
            // menolak dengan pesan jelas sampai admin mengisinya.
            if ($product->weight_grams === null || $product->weight_grams < 1) {
                throw new InvalidShippingItemException("Berat produk {$product->name} belum diatur.");
            }

            $resolved[] = [
                'variant' => $variant,
                'quantity' => $quantity,
                // Harga satuan efektif (price_override ?? base_price) — rumus
                // yang sama dengan OrderController lewat CheckoutPricing.
                'price' => CheckoutPricing::unitPrice($variant),
            ];
        }

        return $resolved;
    }

    /**
     * Item untuk Biteship dari hasil resolve(). Bentuk ini juga bagian dari
     * cache key tarif, jadi jangan diubah tanpa alasan.
     *
     * @param  array<int, array{variant: ProductVariant, quantity: int, price: float}>  $resolved
     * @return array<int, array{name: string, value: int, weight: int, quantity: int}>
     */
    public function toProviderItems(array $resolved): array
    {
        return array_map(static fn (array $line): array => [
            'name' => mb_substr($line['variant']->product->name.' - '.$line['variant']->size, 0, 100),
            // Nilai barang (asuransi / J&T Cargo), rupiah bulat.
            'value' => CheckoutPricing::toRupiah($line['price']),
            'weight' => $line['variant']->product->weight_grams,
            'quantity' => $line['quantity'],
        ], $resolved);
    }

    /**
     * @param  array<int, array{product_variant_id: int|string, quantity: int|string}>  $lines
     * @return array<int, array{name: string, value: int, weight: int, quantity: int}>
     *
     * @throws InvalidShippingItemException  produk nonaktif / berat belum diisi (→ 422)
     */
    public function build(array $lines): array
    {
        return $this->toProviderItems($this->resolve($lines));
    }
}
