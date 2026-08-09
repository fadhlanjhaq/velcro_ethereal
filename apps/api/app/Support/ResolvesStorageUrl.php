<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

/**
 * Resolusi nilai kolom "url" jadi URL yang siap dipakai di frontend.
 *
 * Ada dua bentuk nilai yang hidup berdampingan di database:
 *  - Path hasil upload Filament (mis. "products/4/abc.jpg" atau
 *    "site-content/hero/xyz.mp4") — relatif terhadap disk 'public', perlu
 *    di-resolve jadi URL penuh.
 *  - Path warisan yang menunjuk aset statis Next.js (mis.
 *    "/images/product/foo.jpg") atau URL absolut — dikembalikan apa adanya.
 *
 * Dipakai bersama oleh ProductImageResource dan SiteContentResource.
 */
trait ResolvesStorageUrl
{
    protected function resolveStorageUrl(?string $url): ?string
    {
        // Field media di site_contents boleh kosong (belum diisi admin).
        if ($url === null || $url === '') {
            return $url;
        }

        if (str_starts_with($url, 'http://')
            || str_starts_with($url, 'https://')
            || str_starts_with($url, '/')
        ) {
            return $url;
        }

        return Storage::disk('public')->url($url);
    }
}
