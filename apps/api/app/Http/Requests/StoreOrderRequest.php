<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi body untuk POST /api/orders (guest checkout).
 *
 * Hanya memvalidasi BENTUK payload. Harga & nama produk sengaja tidak ada di
 * sini — OrderController mengambilnya ulang dari database berdasarkan
 * product_variant_id, jadi apa pun yang dikirim client soal harga diabaikan.
 */
class StoreOrderRequest extends FormRequest
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
            'guest_name' => ['required', 'string', 'max:255'],
            'guest_email' => ['required', 'email'],
            'phone' => ['required', 'string', 'max:30'],
            'address' => ['required', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ];
    }
}
