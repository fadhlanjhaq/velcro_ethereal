<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Kontrak MockProductVariant: hanya size/sku/stock (product_id, price_override,
 * timestamps tidak diekspos).
 */
class ProductVariantResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'size' => $this->size,
            'sku' => $this->sku,
            'stock' => $this->stock,
        ];
    }
}
