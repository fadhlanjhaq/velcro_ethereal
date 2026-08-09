<?php

namespace App\Http\Resources;

use App\Support\ResolvesStorageUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Konten 5 section landing page dalam satu objek, satu key per section.
 *
 * Resource ini membungkus array rakitan SiteContentController (bukan model),
 * dengan bentuk:
 *   ['contents' => [section => [key => value]],
 *    'items'    => [section => [group_key => [data, ...]]]]
 *
 * Kolom admin (`type`, `sort_order`) sengaja TIDAK diekspos: `type` cuma
 * penentu widget di panel Filament, dan urutan sudah tercermin dari urutan
 * array (controller yang meng-`orderBy('sort_order')`).
 *
 * Section/field yang belum ada isinya di database dikembalikan `null` (atau
 * array kosong untuk repeater), bukan hilang dari response — supaya bentuk
 * payload selalu sama dan frontend tidak perlu guard keberadaan key.
 */
class SiteContentResource extends JsonResource
{
    use ResolvesStorageUrl;

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'announcement_bar' => [
                'items' => array_map(
                    fn (array $item): array => [
                        'text' => $item['text'] ?? null,
                    ],
                    $this->items('announcement_bar', 'announcement_items'),
                ),
            ],

            'hero' => [
                'eyebrow' => $this->value('hero', 'eyebrow'),
                'headline_upright' => $this->value('hero', 'headline_upright'),
                'headline_italic' => $this->value('hero', 'headline_italic'),
                'tagline' => $this->value('hero', 'tagline'),
                'scroll_cue' => $this->value('hero', 'scroll_cue'),
                'video_url' => $this->resolveStorageUrl($this->value('hero', 'video_url')),
                'poster_image' => $this->resolveStorageUrl($this->value('hero', 'poster_image')),
            ],

            'brand_story' => [
                'eyebrow' => $this->value('brand_story', 'eyebrow'),
                'heading' => $this->value('brand_story', 'heading'),
                // Nomor pilar ("01", "02", ...) tidak dikirim — di-derive dari
                // urutan array ini saat render.
                'pillars' => array_map(
                    fn (array $item): array => [
                        'title' => $item['title'] ?? null,
                        'body' => $item['body'] ?? null,
                    ],
                    $this->items('brand_story', 'pillars'),
                ),
            ],

            'craftsmanship' => [
                'eyebrow' => $this->value('craftsmanship', 'eyebrow'),
                'heading' => $this->value('craftsmanship', 'heading'),
                'body' => $this->value('craftsmanship', 'body'),
                'images' => array_map(
                    fn (array $item): array => [
                        'url' => $this->resolveStorageUrl($item['url'] ?? null),
                        'parallax_speed' => isset($item['parallax_speed'])
                            ? (int) $item['parallax_speed']
                            : null,
                        'role' => $item['role'] ?? null,
                    ],
                    $this->items('craftsmanship', 'craftsmanship_images'),
                ),
            ],

            'closing_cta' => [
                'eyebrow' => $this->value('closing_cta', 'eyebrow'),
                'heading' => $this->value('closing_cta', 'heading'),
                'secondary_line' => $this->value('closing_cta', 'secondary_line'),
                'cta_label' => $this->value('closing_cta', 'cta_label'),
                'cta_href' => $this->value('closing_cta', 'cta_href'),
            ],
        ];
    }

    /** Satu field skalar dari site_contents. */
    private function value(string $section, string $key): ?string
    {
        return $this->resource['contents'][$section][$key] ?? null;
    }

    /**
     * Isi satu grup repeater dari site_content_items, sudah urut sort_order.
     *
     * @return array<int, array<string, mixed>>
     */
    private function items(string $section, string $groupKey): array
    {
        return $this->resource['items'][$section][$groupKey] ?? [];
    }
}
