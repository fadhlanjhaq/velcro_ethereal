<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Dilempar dari OrderController saat nominal order tidak valid untuk dikirim ke
 * Midtrans — total <= 0, atau rincian item_details tidak menjumlah persis ke
 * gross_amount. Kedua kondisi ditahan di sisi kita supaya errornya jelas,
 * bukan pesan asing dari Midtrans.
 *
 * Punya render() sendiri (→ 422) dengan pola yang sama seperti
 * InsufficientStockException. Dilempar dari dalam DB::transaction() sehingga
 * apa pun yang sudah dibuat ikut ter-rollback.
 */
class InvalidOrderTotalException extends RuntimeException
{
    public function render(Request $request): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], 422);
    }
}
