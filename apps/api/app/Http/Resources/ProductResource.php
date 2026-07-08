<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Bentuk JSON produk. Sengaja dibuat PERSIS mengikuti kontrak di
 * apps/web/src/lib/mock-products.ts (interface MockProduct): field snake_case,
 * base_price string decimal ("850000.00"), relasi category/images/variants
 * sebagai nested object/array. Jangan ubah tanpa menyelaraskan mock + frontend.
 */
class ProductResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'story' => $this->story,
            // decimal:2 cast → string di JSON, mis. "850000.00".
            'base_price' => $this->base_price,
            'category' => new CategoryResource($this->whenLoaded('category')),
            'images' => ProductImageResource::collection($this->whenLoaded('images')),
            'variants' => ProductVariantResource::collection($this->whenLoaded('variants')),
        ];
    }
}
