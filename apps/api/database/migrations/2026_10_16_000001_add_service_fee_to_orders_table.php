<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Biaya layanan per order (env SERVICE_FEE) — terpisah dari shipping_cost
     * supaya laporan ongkir vs pendapatan biaya layanan tidak tercampur.
     *
     * Default 0 (bukan nullable): order lama di production memang tidak punya
     * biaya layanan, jadi 0 adalah nilai yang BENAR untuk mereka, dan
     * `total = subtotal + shipping_cost + service_fee` tetap konsisten tanpa
     * backfill.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('service_fee', 12, 2)->default(0)->after('shipping_cost');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('service_fee');
        });
    }
};
