<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Berat produk (gram) untuk menghitung ongkir via Biteship. Berat disimpan
     * per produk, bukan per varian: ukuran pakaian tidak mengubah berat kirim
     * secara berarti, dan admin cukup mengisi satu angka per produk.
     *
     * - nullable, TANPA default: produk yang sudah live di production belum
     *   punya berat. Default (mis. 0 atau 500) akan diam-diam menghasilkan
     *   ongkir yang salah; lebih aman dibiarkan kosong dan ditolak dengan pesan
     *   jelas saat cek ongkir ("Berat produk X belum diatur.") sampai admin
     *   mengisinya lewat Filament.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->unsignedInteger('weight_grams')->nullable()->after('base_price');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('weight_grams');
        });
    }
};
