<?php

namespace App\Http\Resources;

use App\Services\CheckoutPricing;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Kontrak MockProductVariant: id/size/sku/stock/price (product_id,
 * price_override, timestamps tidak diekspos).
 *
 * `id` diekspos karena checkout frontend butuh mengirim `product_variant_id`
 * ke `POST /api/orders` (StoreOrderRequest mewajibkan `exists:product_variants,id`).
 * Tetap read-only — harga/nama tetap di-resolve ulang dari DB di backend.
 *
 * `price` = harga satuan EFEKTIF varian (price_override ?? base_price), string
 * decimal seperti base_price ("850000.00"). Dipakai cart supaya varian dengan
 * price_override tidak tampil dengan harga dasar produk. `price_override`
 * sendiri tetap tidak diekspos — frontend cukup tahu harga akhirnya.
 */
class ProductVariantResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'size' => $this->size,
            'sku' => $this->sku,
            'stock' => $this->stock,
            // Butuh relasi `product` (fallback base_price). ProductController
            // eager-load `variants.product` supaya tidak N+1.
            'price' => CheckoutPricing::unitPriceString($this->resource),
        ];
    }
}
