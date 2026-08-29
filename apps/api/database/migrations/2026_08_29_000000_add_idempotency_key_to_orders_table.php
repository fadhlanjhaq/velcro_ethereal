<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Idempotency key untuk POST /api/orders. Satu percobaan checkout dari
     * frontend (satu page load `/checkout`) memakai key yang sama untuk semua
     * retry-nya, jadi klik ganda / retry jaringan tidak menghasilkan order +
     * Snap token ganda.
     *
     * - nullable: order yang dibuat sebelum fase ini tidak punya nilai dan
     *   sengaja TIDAK di-backfill (MySQL & SQLite mengizinkan banyak NULL di
     *   index unique).
     * - unique: proteksi race condition di level DB — dua request dengan key
     *   sama yang sama-sama lolos cek aplikasi tetap tidak bisa dua-duanya
     *   INSERT.
     * - panjang 100 mengikuti rule `max:100` di StoreOrderRequest dan menjaga
     *   index tetap ramping (UUID hanya 36 karakter).
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('idempotency_key', 100)->nullable()->unique()->after('order_number');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropUnique(['idempotency_key']);
            $table->dropColumn('idempotency_key');
        });
    }
};
