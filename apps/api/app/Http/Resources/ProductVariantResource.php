<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Kontrak MockProductVariant: id/size/sku/stock (product_id, price_override,
 * timestamps tidak diekspos).
 *
 * `id` diekspos karena checkout frontend butuh mengirim `product_variant_id`
 * ke `POST /api/orders` (StoreOrderRequest mewajibkan `exists:product_variants,id`).
 * Tetap read-only — harga/nama tetap di-resolve ulang dari DB di backend.
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
        ];
    }
}
