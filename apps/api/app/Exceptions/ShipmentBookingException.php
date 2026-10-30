<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Dilempar dari ShipmentBookingService saat booking kurir (tombol "Siap Kirim"
 * di admin, Biteship Langkah D2) tidak bisa dilakukan karena kondisi di sisi
 * kita: order belum dibayar, shipment tidak ada / sudah dibooking, konfigurasi
 * alamat gudang belum lengkap, atau berat produk kosong.
 *
 * Pesannya berbahasa Indonesia dan ditujukan ke ADMIN (ditampilkan di
 * notifikasi Filament & disimpan sebagai shipments.booking_error), jadi harus
 * menjelaskan apa yang perlu dibereskan.
 */
class ShipmentBookingException extends RuntimeException
{
}
