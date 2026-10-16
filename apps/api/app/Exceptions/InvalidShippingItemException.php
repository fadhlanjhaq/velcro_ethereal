<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Dilempar dari ShippingItemsBuilder saat item keranjang tidak bisa dihitung
 * ongkirnya: produk sudah nonaktif, atau berat produk belum diisi admin.
 *
 * Punya render() sendiri supaya jadi response 422 (bukan 500) — sama seperti
 * InsufficientStockException. Pesannya memang ditujukan ke pembeli/admin
 * (mis. "Berat produk X belum diatur."), jadi aman ditampilkan apa adanya.
 */
class InvalidShippingItemException extends RuntimeException
{
    public function render(Request $request): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], 422);
    }
}
