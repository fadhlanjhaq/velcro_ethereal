<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Status pengiriman dari webhook Biteship (Langkah E2).
     *
     * - provider_status (+ _at): status mentah terakhir dari Biteship (mis.
     *   picked, delivered, on_hold). Disimpan APA ADANYA — termasuk status
     *   "bermasalah" yang tidak punya padanan di enum shipments.status (enum
     *   sengaja tidak diubah).
     * - shipped_at / delivered_at: kapan paket pertama kali dijemput / sampai.
     * - provider_final_price: harga akhir dari event order.price (mis. setelah
     *   berat aktual ditimbang kurir), dibandingkan dengan booked_price.
     * - last_webhook_payload: payload terakhir, untuk investigasi.
     *
     * Semua nullable, tanpa backfill: shipment lama belum pernah menerima webhook.
     */
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->string('provider_status')->nullable()->after('status');
            $table->timestamp('provider_status_at')->nullable()->after('provider_status');
            $table->timestamp('shipped_at')->nullable()->after('booked_at');
            $table->timestamp('delivered_at')->nullable()->after('shipped_at');
            $table->decimal('provider_final_price', 12, 2)->nullable()->after('booked_price');
            $table->json('last_webhook_payload')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->dropColumn([
                'provider_status',
                'provider_status_at',
                'shipped_at',
                'delivered_at',
                'provider_final_price',
                'last_webhook_payload',
            ]);
        });
    }
};
