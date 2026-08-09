<?php

namespace Database\Seeders;

use App\Models\SiteContent;
use App\Models\SiteContentItem;
use Illuminate\Database\Seeder;

/**
 * Konten 5 section landing page, disalin PERSIS dari yang sekarang masih
 * hardcode di apps/web (Hero.tsx, SiteHeader.tsx, BrandStory.tsx,
 * Craftsmanship.tsx, ClosingCta.tsx) — seeder ini adalah titik pindah dari
 * copy hardcode ke CMS, jadi kata-katanya sengaja tidak diubah sedikit pun.
 *
 * Idempoten: field skalar pakai updateOrCreate (bersandar pada unique
 * section+key), item repeater dihapus per-grup dulu supaya seeding ulang
 * tidak menumpuk duplikat.
 */
class SiteContentSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->seedContents();
        $this->seedItems();
    }

    private function seedContents(): void
    {
        $contents = [
            'hero' => [
                ['eyebrow', 'Heritage Collection — 2026', 'text'],
                ['headline_upright', 'Velcro', 'text'],
                ['headline_italic', 'Ethereal', 'text'],
                ['tagline', 'Every Creation Holds Meaning', 'text'],
                ['scroll_cue', 'Scroll down', 'text'],
                ['video_url', '/videos/asset_video03.mp4', 'video'],
                ['poster_image', '/images/brand/hero-poster.jpg', 'image'],
            ],
            'brand_story' => [
                ['eyebrow', 'Filosofi', 'text'],
                ['heading', 'Tiga prinsip yang menjahit setiap helai.', 'text'],
            ],
            'craftsmanship' => [
                ['eyebrow', 'Craftsmanship', 'text'],
                ['heading', 'Ditenun perlahan, dijahit untuk bertahan.', 'text'],
                ['body', 'Setiap potong melewati tangan pengrajin — dari benang yang dipilih, simpul yang diikat, hingga bordir yang menutup cerita. Bukan produksi massal, melainkan waktu yang dijahitkan ke dalam kain.', 'richtext'],
            ],
            'closing_cta' => [
                ['eyebrow', 'Velcro Ethereal', 'text'],
                ['heading', 'Kenakan warisan yang dirancang untuk abadi.', 'text'],
                ['secondary_line', 'Jumlah terbatas per motif. Setiap potong bernomor, tak terulang.', 'text'],
                ['cta_label', 'Jelajahi Koleksi', 'text'],
                ['cta_href', '/shop', 'url'],
            ],
        ];

        foreach ($contents as $section => $rows) {
            foreach ($rows as [$key, $value, $type]) {
                SiteContent::updateOrCreate(
                    ['section' => $section, 'key' => $key],
                    ['value' => $value, 'type' => $type],
                );
            }
        }
    }

    private function seedItems(): void
    {
        $groups = [
            // Announcement bar: 3 item, dirender berderet dipisah separator "·".
            ['announcement_bar', 'announcement_items', [
                ['text' => 'Worldwide Shipping'],
                ['text' => 'Limited Production'],
                ['text' => 'Authenticity Guaranteed for Every Piece'],
            ]],

            // Pilar Filosofi. Nomor urut ("01"/"02"/"03") sengaja TIDAK
            // disimpan — bisa diturunkan dari sort_order saat render, supaya
            // tambah/hapus/reorder pilar tidak bikin nomornya bentrok.
            ['brand_story', 'pillars', [
                ['title' => 'Heritage', 'body' => 'Setiap simpul bordir membawa cerita — motif yang diwariskan turun-temurun, bukan sekadar hiasan permukaan.'],
                ['title' => 'Artisan', 'body' => 'Dikerjakan dengan tangan oleh para pengrajin. Waktu dan ketelitian, bukan mesin, yang menentukan mutunya.'],
                ['title' => 'Eternal', 'body' => 'Dibuat untuk melampaui tren. Pakaian yang menua dengan anggun dan tetap relevan lintas musim.'],
            ]],

            // Gambar Craftsmanship: `parallax_speed` = nilai data-parallax di
            // JSX, `role` membedakan foto mood (kolom besar) dari inset tekstur.
            ['craftsmanship', 'craftsmanship_images', [
                ['url' => '/images/brand/asset_06.jpg', 'parallax_speed' => 7, 'role' => 'mood'],
                ['url' => '/images/product/asset_05.jpg', 'parallax_speed' => 4, 'role' => 'texture'],
            ]],
        ];

        foreach ($groups as [$section, $groupKey, $items]) {
            SiteContentItem::where('section', $section)
                ->where('group_key', $groupKey)
                ->delete();

            foreach ($items as $sortOrder => $data) {
                SiteContentItem::create([
                    'section' => $section,
                    'group_key' => $groupKey,
                    'sort_order' => $sortOrder,
                    'data' => $data,
                ]);
            }
        }
    }
}
