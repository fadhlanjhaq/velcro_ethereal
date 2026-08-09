<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('site_content_items', function (Blueprint $table) {
            $table->id();
            $table->string('section');
            // Nama grup repeater di dalam section, mis. 'pillars',
            // 'announcement_items', 'craftsmanship_images'.
            $table->string('group_key');
            $table->unsignedInteger('sort_order')->default(0);
            // Bentuk isi berbeda-beda per grup (pillar: title+body; gambar:
            // url+parallax_speed+role) — sengaja JSON supaya grup baru tidak
            // perlu migration tambahan.
            $table->json('data');
            $table->timestamps();

            // Query utama selalu "ambil satu grup, urut" — indeks ini yang
            // dipakai, bukan unique (item dalam satu grup boleh berulang).
            $table->index(['section', 'group_key', 'sort_order']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('site_content_items');
    }
};
