<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Dilempar dari OrderController saat stok salah satu item tidak mencukupi.
 *
 * Punya render() sendiri supaya jadi response 422 (bukan 500) tanpa perlu
 * daftar handler di bootstrap/app.php. Dilempar dari dalam DB::transaction()
 * sehingga order/items/payment yang mungkin sudah dibuat ikut ter-rollback.
 */
class InsufficientStockException extends RuntimeException
{
    public function render(Request $request): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], 422);
    }
}
