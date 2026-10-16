<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Snapshot layanan kurir yang dipilih pembeli saat checkout (Biteship
     * Langkah C), untuk booking otomatis di Langkah D dan tampilan admin.
     * Kolom `courier` yang sudah ada dipakai untuk courier_code (jne/jnt/...).
     *
     * Semua nullable: shipment lama (kalau ada) dibuat sebelum data ini
     * dikumpulkan dan sengaja TIDAK di-backfill. `cost` disimpan terpisah dari
     * orders.shipping_cost sebagai snapshot tarif kurir — sumber kebenaran
     * nominal yang ditagih tetap orders.shipping_cost.
     */
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->string('courier_name')->nullable()->after('courier');
            $table->string('service_code')->nullable()->after('courier_name');
            $table->string('service_name')->nullable()->after('service_code');
            $table->decimal('cost', 12, 2)->nullable()->after('service_name');
            $table->string('etd')->nullable()->after('cost');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->dropColumn(['courier_name', 'service_code', 'service_name', 'cost', 'etd']);
        });
    }
};
