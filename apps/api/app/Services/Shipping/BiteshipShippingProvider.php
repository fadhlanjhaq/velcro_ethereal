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
 * - POST /v1/orders (Langkah D2) → { success, id, price, status, courier {
 *   waybill_id, tracking_id, link } }. reference_id unik per order; dipakai
 *   ulang → code 40002060. Memotong saldo Biteship.
 *
 * Setiap panggilan ke Biteship berbayar; throttle & cache ada di level route /
 * controller (lihat ShippingController), bukan di sini.
 *
 * Logging: hanya path, status HTTP, dan potongan body response. Header request
 * (berisi API key) tidak pernah di-log.
 */
class BiteshipShippingProvider implements ShippingProvider
{
    /**
     * Data gudang & kurir aktif dari ShippingSettings (admin → cadangan .env).
     * API key, base URL, dan timeout tetap dari config — rahasia/teknis.
     */
    public function __construct(
        private readonly ShippingSettings $settings,
    ) {}

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
        $originAreaId = (string) $this->settings->origin()['area_id'];

        if ($originAreaId === '') {
            throw new ShippingProviderException(
                'Area gudang belum diisi (halaman Pengaturan Pengiriman maupun BITESHIP_ORIGIN_AREA_ID kosong).'
            );
        }

        $couriers = $this->settings->couriers();

        if ($couriers === []) {
            throw new ShippingProviderException(
                'Kurir aktif belum diisi (halaman Pengaturan Pengiriman maupun BITESHIP_COURIERS kosong).'
            );
        }

        // Nilai pertanggungan = total nilai barang (value × quantity). Dikirim di
        // request yang SAMA dengan cek tarif — tiap request Biteship berbayar,
        // jadi tarif dengan & tanpa asuransi tidak diminta terpisah. Pembeli
        // yang tidak memilih asuransi tetap dapat ongkir dasar (lihat di bawah).
        $insuranceValue = array_sum(array_map(
            static fn (array $item): int => (int) $item['value'] * (int) $item['quantity'],
            $items,
        ));

        $body = $this->send('POST', '/v1/rates/couriers', [
            'origin_area_id' => $originAreaId,
            'destination_area_id' => $destinationAreaId,
            'couriers' => implode(',', $couriers),
            'courier_insurance' => $insuranceValue,
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
            $insuranceAvailable = (bool) ($rate['available_for_insurance'] ?? false);
            $insuranceFee = (int) round((float) ($rate['insurance_fee'] ?? 0));

            // ASUMSI (docs Biteship rates, Okt 2026): karena `courier_insurance`
            // dikirim, `price` SUDAH termasuk `insurance_fee` ("final price ...
            // adding other fees if you have activated insurance"; contoh docs:
            // shipping_fee 32.000 + insurance 1.000 + COD 2.000 = price 35.000).
            // Docs tidak menyatakannya eksplisit untuk request ber-courier_insurance,
            // jadi ongkir dasar (tanpa asuransi) = price − insurance_fee.
            // Verifikasi: bandingkan `price` layanan yang sama dengan & tanpa
            // courier_insurance, atau cek price − insurance_fee == shipping_fee
            // di respons mentah. Lihat docs/decisions/shipping-biteship.md §1.9.
            $baseCost = $insuranceFee > 0 ? $price - $insuranceFee : $price;

            // Guard: hasil ≤ 0 berarti asumsi di atas tidak cocok untuk respons
            // ini. Jangan menagih ongkir 0/negatif — pakai price apa adanya dan
            // matikan asuransi untuk layanan ini.
            if ($baseCost <= 0) {
                Log::warning('Biteship: price − insurance_fee ≤ 0, asuransi dimatikan untuk layanan ini.', [
                    'courier_code' => $rate['courier_code'],
                    'service_code' => $rate['courier_service_code'],
                    'price' => $price,
                    'insurance_fee' => $insuranceFee,
                ]);

                $baseCost = $price;
                $insuranceAvailable = false;
                $insuranceFee = 0;
            }

            // Asuransi hanya ditawarkan kalau kurir mendukung DAN Biteship
            // memberi biaya > 0 — tanpa biaya, kita tidak tahu berapa yang
            // harus ditagih (dan baris Midtrans bernilai 0 tidak bermakna).
            if (! $insuranceAvailable || $insuranceFee <= 0) {
                $insuranceAvailable = false;
                $insuranceFee = 0;
            }

            $result[] = new ShippingRate(
                courierCode: (string) $rate['courier_code'],
                courierName: (string) ($rate['courier_name'] ?? $rate['courier_code']),
                serviceCode: (string) $rate['courier_service_code'],
                serviceName: (string) ($rate['courier_service_name'] ?? $rate['courier_service_code']),
                cost: $baseCost,
                etd: $this->nullableString($rate['duration'] ?? null),
                description: $this->nullableString($rate['description'] ?? null),
                providerCost: $baseCost,
                insuranceAvailable: $insuranceAvailable,
                insuranceFee: $insuranceFee,
            );
        }

        return $result;
    }

    public function createShipment(ShipmentBookingRequest $request): ShipmentBookingResult
    {
        // Field kosong (null) dibuang supaya tidak terkirim sebagai `null` —
        // Biteship cukup salah satu dari postal_code / area_id per sisi.
        // postal_code bertipe number di docs Biteship.
        $payload = array_filter([
            'origin_contact_name' => $request->originContactName,
            'origin_contact_phone' => $request->originContactPhone,
            'origin_address' => $request->originAddress,
            'origin_postal_code' => $this->postalCode($request->originPostalCode),
            'origin_area_id' => $request->originAreaId,
            'destination_contact_name' => $request->destinationContactName,
            'destination_contact_phone' => $request->destinationContactPhone,
            'destination_address' => $request->destinationAddress,
            'destination_postal_code' => $this->postalCode($request->destinationPostalCode),
            'destination_area_id' => $request->destinationAreaId,
            'destination_note' => $request->destinationNote,
            'courier_company' => $request->courierCompany,
            'courier_type' => $request->courierType,
            // Asuransi hanya kalau pembeli membayarnya (shipments.insurance_value).
            'courier_insurance' => $request->insuranceValue,
            // Jemput sekarang (bukan terjadwal) — tombol "Siap Kirim" ditekan
            // saat paket memang sudah siap di gudang.
            'delivery_type' => 'now',
            // Pengaman booking ganda di sisi Biteship: reference_id yang sama
            // ditolak dengan code 40002060.
            'reference_id' => $request->referenceId,
            'order_note' => $request->orderNote,
            'items' => $request->items,
        ], static fn ($value): bool => $value !== null && $value !== '');

        try {
            $body = $this->send('POST', '/v1/orders', $payload);
        } catch (ShippingProviderException $e) {
            if ((string) $e->providerCode === '40002060') {
                throw new ShippingProviderException(
                    'Order ini sudah tercatat di Biteship (nomor referensi sama). Cek dashboard Biteship sebelum mencoba lagi.',
                    $e->providerCode,
                    $e->providerMessage,
                    $e,
                );
            }

            // Timeout / koneksi putus: status di Biteship TIDAK diketahui —
            // order bisa saja sudah terbuat. Coba Lagi tetap aman (reference_id
            // sama → 40002060), tapi admin perlu tahu untuk mengecek dulu.
            if ($e->getPrevious() instanceof ConnectionException) {
                throw new ShippingProviderException(
                    'Biteship tidak bisa dihubungi atau tidak menjawab tepat waktu. Booking mungkin sudah tercatat — cek dashboard Biteship sebelum mencoba lagi.',
                    previous: $e,
                );
            }

            // Pesan untuk admin: alasan dari Biteship apa adanya (mis. saldo
            // kurang, nomor telepon tidak valid). Tanpa header / API key.
            throw new ShippingProviderException(
                'Booking kurir ditolak Biteship'
                .($e->providerMessage !== null && $e->providerMessage !== ''
                    ? ": {$e->providerMessage}"
                    : ' ('.$e->getMessage().')'),
                $e->providerCode,
                $e->providerMessage,
                $e,
            );
        }

        $orderId = $this->nullableString($body['id'] ?? null);

        // Tanpa ID order Biteship, booking tidak bisa dilacak / dibatalkan —
        // anggap gagal supaya admin mengecek dashboard, jangan diam-diam sukses.
        if ($orderId === null) {
            Log::warning('Biteship: response POST /v1/orders tanpa id.', [
                'reference_id' => $request->referenceId,
                'body' => mb_substr((string) json_encode($body), 0, 1000),
            ]);

            throw new ShippingProviderException(
                'Biteship tidak mengembalikan ID order. Cek dashboard Biteship sebelum mencoba lagi.'
            );
        }

        $courier = is_array($body['courier'] ?? null) ? $body['courier'] : [];

        return new ShipmentBookingResult(
            providerOrderId: $orderId,
            waybillId: $this->nullableString($courier['waybill_id'] ?? null),
            trackingId: $this->nullableString($courier['tracking_id'] ?? null),
            trackingLink: $this->nullableString($courier['link'] ?? null),
            price: (int) round((float) ($body['price'] ?? 0)),
            status: $this->nullableString($body['status'] ?? null),
        );
    }

    /**
     * Kode pos sebagai number (tipe di docs Biteship); null kalau kosong / bukan
     * angka — area_id tetap jadi patokan lokasi.
     */
    private function postalCode(?string $postalCode): ?int
    {
        $digits = $postalCode === null ? '' : trim($postalCode);

        return ctype_digit($digits) ? (int) $digits : null;
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
            $code = is_array($body) ? ($body['code'] ?? null) : null;

            throw new ShippingProviderException(
                "Biteship menolak request ({$method} {$path}, HTTP {$response->status()})"
                .($reason !== '' ? ": {$reason}" : '.'),
                is_int($code) || is_string($code) ? $code : null,
                $reason !== '' ? $reason : null,
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
