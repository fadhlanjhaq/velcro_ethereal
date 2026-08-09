<?php

namespace App\Http\Resources;

use App\Support\ResolvesStorageUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Kontrak MockProductImage: hanya url + sort_order.
 */
class ProductImageResource extends JsonResource
{
    use ResolvesStorageUrl;

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'url' => $this->resolveStorageUrl($this->url),
            'sort_order' => $this->sort_order,
        ];
    }
}
