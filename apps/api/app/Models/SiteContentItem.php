<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Konten berulang per section (repeater): pilar Filosofi, item announcement
 * bar, gambar parallax Craftsmanship. Bentuk `data` berbeda per group_key —
 * lihat SiteContentSeeder untuk kontrak tiap grup.
 */
#[Fillable(['section', 'group_key', 'sort_order', 'data'])]
class SiteContentItem extends Model
{
    use HasFactory;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'data' => 'array',
        ];
    }
}
