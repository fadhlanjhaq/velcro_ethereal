<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Kolom-kolom Midtrans. Semua nullable: baris payment dibuat lebih dulu
     * (saat order dibuat), lalu dilengkapi bertahap ketika Snap token
     * digenerate dan ketika notification webhook masuk.
     *
     * `transaction_status` / `fraud_status` menyimpan nilai MENTAH dari
     * Midtrans dan sengaja terpisah dari kolom `status` (enum PaymentStatus)
     * yang sudah ada — `status` adalah representasi domain internal, kolom
     * baru ini adalah audit trail apa adanya dari gateway.
     */
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            // order_id yang dikirim ke Midtrans — BEDA dari orders.order_number
            // internal. Harus unik per attempt karena Midtrans menolak reuse
            // order_id yang sama, jadi belum tentu 1:1 dengan order.
            $table->string('midtrans_order_id')->nullable()->after('midtrans_transaction_id');
            $table->string('snap_token')->nullable()->after('midtrans_order_id');

            // Nilai mentah dari Midtrans: capture/settlement/pending/deny/
            // cancel/expire/failure/refund/partial_refund/authorize.
            $table->string('transaction_status')->nullable()->after('status');
            // accept/deny/challenge
            $table->string('fraud_status')->nullable()->after('transaction_status');

            // Nominal yang dikirim ke Midtrans dalam rupiah bulat (Midtrans
            // tidak menerima pecahan desimal seperti kolom `amount`).
            $table->integer('gross_amount')->nullable()->after('amount');

            // Payload notification mentah, disimpan apa adanya untuk audit &
            // rekonsiliasi.
            $table->json('raw_response')->nullable()->after('paid_at');
            $table->timestamp('expiry_time')->nullable()->after('raw_response');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn([
                'midtrans_order_id',
                'snap_token',
                'transaction_status',
                'fraud_status',
                'gross_amount',
                'raw_response',
                'expiry_time',
            ]);
        });
    }
};
