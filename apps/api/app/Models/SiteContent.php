<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Field skalar tunggal per section landing page (eyebrow, heading, tagline,
 * URL video/gambar, label CTA, dst). Konten yang berulang/berstruktur —
 * pilar Filosofi, item announcement bar, gambar parallax Craftsmanship —
 * ada di SiteContentItem, bukan di sini.
 */
#[Fillable(['section', 'key', 'value', 'type'])]
class SiteContent extends Model
{
    use HasFactory;
}
