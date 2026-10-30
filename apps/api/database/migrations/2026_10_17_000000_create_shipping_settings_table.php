<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Pengaturan BISNIS pengiriman yang bisa diubah admin tanpa akses server
     * (halaman "Pengaturan Pengiriman"): data gudang, kurir aktif, layanan yang
     * ditampilkan, markup ongkir. Satu baris saja.
     *
     * Semua nullable: kolom kosong = pakai nilai cadangan dari .env (config
     * services.biteship / services.checkout), jadi deploy sebelum halaman ini
     * diisi tidak mengubah perilaku apa pun. Rahasia (API key, secret webhook)
     * sengaja TIDAK ada di sini — tetap di .env.
     */
    public function up(): void
    {
        Schema::create('shipping_settings', function (Blueprint $table) {
            $table->id();
            $table->string('origin_contact_name')->nullable();
            $table->string('origin_contact_phone')->nullable();
            $table->text('origin_address')->nullable();
            $table->string('origin_area_id')->nullable();
            $table->string('origin_area_label')->nullable();
            $table->string('origin_postal_code', 10)->nullable();
            $table->json('couriers')->nullable();
            $table->json('allowed_services')->nullable();
            $table->unsignedInteger('shipping_markup')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('shipping_settings');
    }
};
