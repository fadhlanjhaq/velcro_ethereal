<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Tarif ASLI kurir dari Biteship, terpisah dari `cost` (ongkir yang
     * ditagih ke pembeli = tarif asli + SHIPPING_MARKUP). Booking kurir di
     * Langkah D membayar Biteship sebesar provider_cost; selisihnya margin toko.
     *
     * Nullable: shipment yang dibuat sebelum markup ada tidak punya nilai ini
     * dan sengaja TIDAK di-backfill (tanpa markup, tarif aslinya = `cost`).
     */
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->decimal('provider_cost', 12, 2)->nullable()->after('cost');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->dropColumn('provider_cost');
        });
    }
};
