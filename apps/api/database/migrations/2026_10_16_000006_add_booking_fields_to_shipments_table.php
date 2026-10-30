<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Hasil booking kurir lewat tombol "Siap Kirim" di admin (Biteship Langkah
     * D2). biteship_order_id & tracking_number (= waybill_id) sudah ada sejak
     * awal; kolom di sini melengkapinya.
     *
     * - booked_at: waktu booking SUKSES.
     * - booking_attempted_at + booking_error: percobaan terakhir yang GAGAL.
     *   "Booking gagal" = booking_error terisi DAN biteship_order_id null.
     * - biteship_tracking_id, tracking_link: untuk lacak (update status resi
     *   otomatis ditunda).
     * - booked_price: harga yang benar-benar ditagih Biteship, dibandingkan
     *   dengan perkiraan (provider_cost + insurance_fee).
     *
     * Semua nullable, tanpa backfill: shipment lama memang belum pernah
     * dibooking lewat sistem. Kolom enum `status` sengaja tidak diubah.
     */
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->timestamp('booked_at')->nullable()->after('status');
            $table->timestamp('booking_attempted_at')->nullable()->after('booked_at');
            $table->text('booking_error')->nullable()->after('booking_attempted_at');
            $table->string('biteship_tracking_id')->nullable()->after('biteship_order_id');
            $table->string('tracking_link')->nullable()->after('biteship_tracking_id');
            $table->decimal('booked_price', 12, 2)->nullable()->after('insurance_fee');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->dropColumn([
                'booked_at',
                'booking_attempted_at',
                'booking_error',
                'biteship_tracking_id',
                'tracking_link',
                'booked_price',
            ]);
        });
    }
};
