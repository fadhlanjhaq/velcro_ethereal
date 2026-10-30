<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Biaya asuransi pengiriman per order (Biteship Langkah D1) — opsional,
     * dipilih & dibayar pembeli, terpisah dari shipping_cost supaya laporan
     * ongkir vs asuransi tidak tercampur.
     *
     * Default 0 (bukan nullable): order lama memang tidak diasuransikan, jadi
     * 0 adalah nilai yang BENAR untuk mereka, dan
     * `total = subtotal + shipping_cost + service_fee + insurance_fee` tetap
     * konsisten tanpa backfill.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('insurance_fee', 12, 2)->default(0)->after('service_fee');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('insurance_fee');
        });
    }
};
