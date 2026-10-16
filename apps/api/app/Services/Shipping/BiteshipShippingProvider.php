<?php

namespace App\Services\Shipping;

use App\Exceptions\ShippingProviderException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Implementasi ShippingProvider di atas Biteship REST API, memakai Laravel HTTP
 * client (tanpa SDK — Biteship tidak punya SDK PHP resmi, dan dua endpoint ini
 * cukup sederhana).
 *
 * Diverifikasi ke https://biteship.com/en/docs (Oktober 2026):
 * - Auth: header `authorization: <API_KEY>` — key mentah, TANPA "Bearer".
 * - Base URL sama untuk test & live; mode ditentukan oleh prefix key
 *   (biteship_test. / biteship_live.).
 * - GET  /v1/maps/areas?countries=ID&input=<q>&type=single → { success, areas[] }
 * - POST /v1/rates/couriers → { success, pricing[] }; weight dalam gram,
 *   value dalam rupiah, couriers string dipisah koma.
 *
 * Setiap panggilan ke Biteship berbayar; throttle & cache ada di level route /
 * controller (lihat ShippingController), bukan di sini.
 *
 * Logging: hanya path, status HTTP, dan potongan body response. Header request
 * (berisi API key) tidak pernah di-log.
 */
class BiteshipShippingProvider implements ShippingProvider
{
    public function searchAreas(string $query): array
    {
        $body = $this->send('GET', '/v1/maps/areas', [
            'countries' => 'ID',
            'input' => $query,
            'type' => 'single',
        ]);

        $areas = is_array($body['areas'] ?? null) ? $body['areas'] : [];

        $result = [];

        foreach ($areas as $area) {
            // Area tanpa id tidak bisa dipakai untuk cek tarif — lewati saja.
            if (! is_array($area) || ! isset($area['id']) || (string) $area['id'] === '') {
                continue;
            }

            // `postal_code` dikirim Biteship sebagai angka; 0/kosong = tidak ada.
            $postalCode = $area['postal_code'] ?? null;

            $result[] = new ShippingArea(
                id: (string) $area['id'],
                // `name` dari Biteship sudah berupa label lengkap
                // (kelurahan, kecamatan, kota, provinsi, kode pos).
                label: (string) ($area['name'] ?? $area['id']),
                postalCode: $postalCode === null || $postalCode === '' || $postalCode === 0
                    ? null
                    : (string) $postalCode,
            );
        }

        return $result;
    }

    public function getRates(string $destinationAreaId, array $items): array
    {
        $originAreaId = (string) config('services.biteship.origin.area_id');

        if ($originAreaId === '') {
            throw new ShippingProviderException(
                'Konfigurasi origin Biteship belum diisi (BITESHIP_ORIGIN_AREA_ID kosong).'
            );
        }

        $couriers = (array) config('services.biteship.couriers');

        if ($couriers === []) {
            throw new ShippingProviderException(
                'Konfigurasi kurir Biteship belum diisi (BITESHIP_COURIERS kosong).'
            );
        }

        $body = $this->send('POST', '/v1/rates/couriers', [
            'origin_area_id' => $originAreaId,
            'destination_area_id' => $destinationAreaId,
            'couriers' => implode(',', $couriers),
            'items' => array_map(static fn (array $item): array => [
                'name' => $item['name'],
                'value' => $item['value'],
                'weight' => $item['weight'],
                'quantity' => $item['quantity'],
            ], $items),
        ]);

        $pricing = is_array($body['pricing'] ?? null) ? $body['pricing'] : [];

        $result = [];

        foreach ($pricing as $rate) {
            // Tanpa harga atau kode layanan, opsi ini tidak bisa dipilih/di-booking.
            if (
                ! is_array($rate)
                || ! isset($rate['price'], $rate['courier_code'], $rate['courier_service_code'])
            ) {
                continue;
            }

            // `price` = harga final dari Biteship (sudah termasuk diskon/surcharge
            // custom rate, asuransi, COD) — bukan `shipping_fee`. Di sini cost =
            // providerCost; markup toko dipasang ShippingQuoteService, bukan provider.
            $price = (int) round((float) $rate['price']);

            $result[] = new ShippingRate(
                courierCode: (string) $rate['courier_code'],
                courierName: (string) ($rate['courier_name'] ?? $rate['courier_code']),
                serviceCode: (string) $rate['courier_service_code'],
                serviceName: (string) ($rate['courier_service_name'] ?? $rate['courier_service_code']),
                cost: $price,
                etd: $this->nullableString($rate['duration'] ?? null),
                description: $this->nullableString($rate['description'] ?? null),
                providerCost: $price,
            );
        }

        return $result;
    }

    /**
     * Kirim request ke Biteship dan kembalikan body JSON yang sudah dipastikan
     * sukses. Semua jenis gagal (koneksi/timeout, HTTP non-2xx, body bukan JSON,
     * `success` bukan true) dinormalisasi jadi ShippingProviderException.
     *
     * @param  array<string, mixed>  $payload  query string (GET) atau body JSON (POST)
     * @return array<string, mixed>
     *
     * @throws ShippingProviderException
     */
    private function send(string $method, string $path, array $payload): array
    {
        try {
            $response = $method === 'GET'
                ? $this->client()->get($path, $payload)
                : $this->client()->post($path, $payload);
        } catch (ConnectionException $e) {
            Log::warning('Biteship tidak bisa dihubungi.', [
                'method' => $method,
                'path' => $path,
                'error' => $e->getMessage(),
            ]);

            throw new ShippingProviderException(
                "Biteship tidak bisa dihubungi ({$method} {$path}).",
                previous: $e,
            );
        }

        $body = $response->json();

        if (! $response->successful() || ! is_array($body) || ($body['success'] ?? false) !== true) {
            $this->logFailure($method, $path, $response);

            $reason = is_array($body) ? (string) ($body['error'] ?? $body['message'] ?? '') : '';

            throw new ShippingProviderException(
                "Biteship menolak request ({$method} {$path}, HTTP {$response->status()})"
                .($reason !== '' ? ": {$reason}" : '.'),
            );
        }

        return $body;
    }

    private function client(): PendingRequest
    {
        $apiKey = (string) config('services.biteship.api_key');

        if ($apiKey === '') {
            throw new ShippingProviderException('BITESHIP_API_KEY belum diisi.');
        }

        return Http::baseUrl(rtrim((string) config('services.biteship.base_url'), '/'))
            ->withHeaders(['authorization' => $apiKey])
            ->acceptJson()
            ->asJson()
            ->timeout((int) config('services.biteship.timeout', 10));
    }

    /**
     * Log response gagal tanpa header request. Body dipotong supaya log tidak
     * membengkak kalau Biteship membalas HTML (mis. halaman error gateway).
     */
    private function logFailure(string $method, string $path, Response $response): void
    {
        $body = $response->json();

        Log::warning('Biteship membalas error.', [
            'method' => $method,
            'path' => $path,
            'status' => $response->status(),
            'code' => is_array($body) ? ($body['code'] ?? null) : null,
            'error' => is_array($body) ? ($body['error'] ?? $body['message'] ?? null) : null,
            'body' => mb_substr($response->body(), 0, 1000),
        ]);
    }

    private function nullableString(mixed $value): ?string
    {
        if (! is_scalar($value)) {
            return null;
        }

        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }
}
