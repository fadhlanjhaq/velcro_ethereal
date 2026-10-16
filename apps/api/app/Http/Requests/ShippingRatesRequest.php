<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi body untuk POST /api/shipping/rates (cek ongkir sebelum checkout).
 *
 * Aturan `items` sengaja sama persis dengan StoreOrderRequest: item yang lolos
 * cek ongkir harus juga lolos saat order dibuat (Langkah C menghitung ulang
 * ongkir dari item yang sama). Berat & harga tidak ada di sini — diambil dari
 * DB oleh ShippingItemsBuilder.
 */
class ShippingRatesRequest extends FormRequest
{
    /**
     * Endpoint publik, tidak ada auth (konsisten dengan route lain di project).
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            // ID area dari GET /api/shipping/areas (diteruskan apa adanya ke
            // Biteship). Tidak dicek format — bentuk ID adalah urusan provider.
            'destination_area_id' => ['required', 'string', 'max:100'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ];
    }
}
