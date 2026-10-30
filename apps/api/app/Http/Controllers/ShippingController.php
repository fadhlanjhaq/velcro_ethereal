<?php

namespace App\Http\Controllers;

use App\Exceptions\InvalidShippingItemException;
use App\Exceptions\ShippingProviderException;
use App\Http\Requests\ShippingRatesRequest;
use App\Services\Shipping\ShippingAreaSearch;
use App\Services\Shipping\ShippingQuoteService;
use App\Services\Shipping\ShippingRate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Endpoint publik ongkir: autocomplete area tujuan + cek tarif kurir.
 *
 * Setiap panggilan ke Biteship berbayar, jadi selain throttle per IP (named
 * limiter di AppServiceProvider) hasilnya di-cache di store cache bawaan
 * config. Yang di-cache hanya hasil SUKSES (array siap-JSON, bukan objek DTO,
 * supaya aman di semua cache driver); exception tidak pernah ikut tersimpan.
 * Cache & alur tarif ada di ShippingQuoteService (dipakai juga OrderController);
 * cache area di ShippingAreaSearch (dipakai juga halaman admin Pengaturan
 * Pengiriman).
 * Lihat docs/decisions/shipping-biteship.md.
 */
class ShippingController extends Controller
{
    /**
     * GET /api/shipping/areas?q=
     */
    public function areas(Request $request, ShippingAreaSearch $areaSearch): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:3', 'max:100'],
        ]);

        try {
            $areas = $areaSearch->search($validated['q']);
        } catch (ShippingProviderException $e) {
            report($e);

            return response()->json(
                ['message' => 'Gagal mencari area, coba lagi.'],
                502,
            );
        }

        return response()->json(['data' => $areas]);
    }

    /**
     * POST /api/shipping/rates
     *
     * Tarif lewat ShippingQuoteService — jalur yang SAMA dengan hitung ulang di
     * POST /api/orders, jadi angka yang dilihat pembeli = angka yang dicek
     * saat order dibuat (ongkir sudah termasuk markup toko).
     *
     * `meta` membawa angka backend untuk ringkasan checkout: harga produk
     * efektif dari DB (`items`, `subtotal`) dan `service_fee`. Frontend
     * menghitung "Total Tagihan" = meta.subtotal + ongkir + service_fee — rumus
     * yang sama dengan gross_amount di OrderController — sehingga harga lama di
     * cart tidak bisa membuat total_changed berulang.
     *
     * @throws InvalidShippingItemException  produk nonaktif / berat kosong (→ 422 via render())
     */
    public function rates(ShippingRatesRequest $request, ShippingQuoteService $quotes): JsonResponse
    {
        $data = $request->validated();

        try {
            $quote = $quotes->quote($data['destination_area_id'], $data['items']);
        } catch (ShippingProviderException $e) {
            report($e);

            return response()->json(
                ['message' => 'Gagal mengambil ongkir, coba lagi.'],
                502,
            );
        }

        return response()->json([
            'data' => array_map(static fn (ShippingRate $rate): array => $rate->toArray(), $quote->rates),
            'meta' => [
                'service_fee' => (int) config('services.checkout.service_fee'),
                'items' => $quote->items,
                'subtotal' => $quote->subtotal,
            ],
        ]);
    }
}
