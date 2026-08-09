<?php

namespace App\Http\Controllers;

use App\Http\Resources\SiteContentResource;
use App\Models\SiteContent;
use App\Models\SiteContentItem;
use Illuminate\Support\Collection;

class SiteContentController extends Controller
{
    /**
     * Seluruh konten landing page dalam satu response.
     *
     * Cukup 2 query untuk semua section — tabelnya kecil (belasan baris), jadi
     * pengelompokan per section dikerjakan di memori, bukan query per section.
     *
     * Tidak ada firstOrFail/404 di sini: ini bukan lookup by identifier, tapi
     * "ambil semua konten". Section yang datanya belum ada di database tetap
     * muncul di response dengan nilai null / array kosong (lihat
     * SiteContentResource).
     */
    public function index(): SiteContentResource
    {
        $contents = SiteContent::all()
            ->groupBy('section')
            ->map(fn (Collection $rows): array => $rows->pluck('value', 'key')->all())
            ->all();

        $items = SiteContentItem::query()
            ->orderBy('sort_order')
            ->get()
            ->groupBy(['section', 'group_key'])
            ->map(fn (Collection $groups): array => $groups
                ->map(fn (Collection $rows): array => $rows->pluck('data')->all())
                ->all())
            ->all();

        return new SiteContentResource([
            'contents' => $contents,
            'items' => $items,
        ]);
    }
}
