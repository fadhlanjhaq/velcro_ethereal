<?php

namespace App\Services\Shipping;

use App\Exceptions\ShippingProviderException;
use Illuminate\Support\Facades\Cache;

/**
 * Pencarian area Biteship dengan cache — dipakai GET /api/shipping/areas
 * (autocomplete checkout) dan halaman admin "Pengaturan Pengiriman" (area
 * gudang), supaya keduanya berbagi cache yang sama: setiap cache miss memicu
 * panggilan Biteship berbayar.
 */
class ShippingAreaSearch
{
    /**
     * Area jarang berubah → cache panjang.
     */
    private const TTL_SECONDS = 60 * 60 * 24;

    public function __construct(
        private readonly ShippingProvider $provider,
    ) {}

    /**
     * "  Cilandak " dan "cilandak" → satu cache entry (dan satu request
     * berbayar ke Biteship).
     */
    public static function normalize(string $query): string
    {
        return mb_strtolower(trim((string) preg_replace('/\s+/u', ' ', $query)));
    }

    /**
     * @return array<int, array{id: string, label: string, postal_code: string|null}>
     *
     * @throws ShippingProviderException
     */
    public function search(string $query): array
    {
        $query = self::normalize($query);

        return Cache::remember(
            'shipping:areas:'.sha1($query),
            self::TTL_SECONDS,
            fn (): array => array_map(
                static fn (ShippingArea $area): array => $area->toArray(),
                $this->provider->searchAreas($query),
            ),
        );
    }
}
