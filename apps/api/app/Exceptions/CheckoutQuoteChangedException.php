<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Dilempar dari OrderController saat angka yang dilihat pembeli di /checkout
 * tidak lagi sama dengan hasil hitung ulang backend: layanan kurir hilang /
 * di luar allowlist, ongkir berubah, atau total berubah.
 *
 * Keputusan bisnis: pembeli TIDAK BOLEH ditagih angka yang berbeda dari yang
 * dilihatnya, jadi order ditolak (bukan disesuaikan diam-diam) dan frontend
 * diminta memuat ulang tarif. Punya render() sendiri supaya jadi 422 — pola
 * yang sama dengan InsufficientStockException. Kalau dilempar dari dalam
 * DB::transaction(), order yang mungkin sudah dibuat ikut ter-rollback.
 *
 * Body selalu punya `message` (siap tampil) dan `code` (untuk logika
 * frontend), plus angka baru kalau relevan.
 */
class CheckoutQuoteChangedException extends RuntimeException
{
    /**
     * @param  array<string, int>  $extra  field tambahan di body (mis. shipping_cost baru)
     */
    private function __construct(
        string $message,
        public readonly string $errorCode,
        public readonly array $extra = [],
    ) {
        parent::__construct($message);
    }

    public static function shippingUnavailable(): self
    {
        return new self(
            'Layanan pengiriman ini sudah tidak tersedia. Silakan pilih layanan lain.',
            'shipping_unavailable',
        );
    }

    public static function shippingCostChanged(int $shippingCost): self
    {
        return new self(
            'Ongkir berubah menjadi '.self::rupiah($shippingCost).'. Silakan periksa kembali pilihan pengiriman.',
            'shipping_cost_changed',
            ['shipping_cost' => $shippingCost],
        );
    }

    public static function totalChanged(int $total): self
    {
        return new self(
            'Total pembayaran berubah menjadi '.self::rupiah($total).'. Silakan periksa kembali pesanan Anda.',
            'total_changed',
            ['total' => $total],
        );
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
            'code' => $this->errorCode,
            ...$this->extra,
        ], 422);
    }

    /**
     * Format sama dengan formatRupiah() di frontend: "Rp 25.000".
     */
    private static function rupiah(int $amount): string
    {
        return 'Rp '.number_format($amount, 0, ',', '.');
    }
}
