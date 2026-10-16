<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi body untuk POST /api/orders (guest checkout).
 *
 * Hanya memvalidasi BENTUK payload. Harga & nama produk sengaja tidak ada di
 * sini — OrderController mengambilnya ulang dari database berdasarkan
 * product_variant_id, jadi apa pun yang dikirim client soal harga diabaikan.
 *
 * `expected_shipping_cost` / `expected_total` BUKAN harga yang dipercaya:
 * keduanya hanya angka yang DILIHAT pembeli, untuk dibandingkan dengan hasil
 * hitung ulang backend. Kalau berbeda, order ditolak (lihat
 * CheckoutQuoteChangedException) — tidak pernah dipakai sebagai nominal tagihan.
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
            // Idempotency: 1 percobaan checkout = 1 key (di-generate sekali per
            // page load frontend). Cukup string bebas — tidak dipaksa format UUID
            // supaya cara generate di frontend bebas berubah.
            'idempotency_key' => ['required', 'string', 'max:100'],
            'guest_name' => ['required', 'string', 'max:255'],
            'guest_email' => ['required', 'email'],
            'phone' => ['required', 'string', 'max:30'],
            // Alamat terstruktur (Biteship Langkah C). Batas panjang sama dengan
            // field di /checkout.
            'address_detail' => ['required', 'string', 'max:500'],
            'courier_note' => ['nullable', 'string', 'max:200'],
            // Yang menentukan tarif hanya destination_area_id (dikirim ke
            // Biteship). area_label & postal_code sekadar data tampilan / label
            // untuk admin & kurir — tidak dipakai menghitung apa pun.
            'destination_area_id' => ['required', 'string', 'max:100'],
            'area_label' => ['required', 'string', 'max:255'],
            'postal_code' => ['nullable', 'string', 'max:10'],
            // Layanan kurir pilihan pembeli; dicocokkan ulang dengan hasil quote.
            'courier_code' => ['required', 'string', 'max:50'],
            'service_code' => ['required', 'string', 'max:50'],
            // Angka yang dilihat pembeli — pembanding, bukan sumber nominal.
            'expected_shipping_cost' => ['required', 'integer', 'min:0'],
            'expected_total' => ['required', 'integer', 'min:1'],
            // Asuransi pengiriman (Langkah D1): opsional, dipilih & dibayar
            // pembeli. expected_insurance_fee = biaya yang DILIHAT pembeli —
            // pembanding, sama seperti expected_shipping_cost.
            'with_insurance' => ['required', 'boolean'],
            'expected_insurance_fee' => ['required_if:with_insurance,true', 'nullable', 'integer', 'min:0'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ];
    }
}
