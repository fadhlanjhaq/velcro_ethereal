<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Data asuransi pengiriman yang dipilih pembeli (Biteship Langkah D1), untuk
     * booking kurir di Langkah D2: insurance_value dikirim sebagai
     * `courier_insurance` saat membuat order Biteship.
     *
     * Nullable, dan null = TIDAK diasuransikan (termasuk semua shipment lama —
     * sengaja tidak di-backfill). insurance_fee di sini snapshot biaya dari
     * Biteship; nominal yang ditagih tetap orders.insurance_fee.
     */
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->decimal('insurance_value', 12, 2)->nullable()->after('provider_cost');
            $table->decimal('insurance_fee', 12, 2)->nullable()->after('insurance_value');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->dropColumn(['insurance_value', 'insurance_fee']);
        });
    }
};
