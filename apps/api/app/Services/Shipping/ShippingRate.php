<?php

namespace App\Services\Shipping;

/**
 * Satu opsi tarif (kurir + layanan), sudah dinormalisasi dari bentuk provider.
 *
 * Dua angka, sengaja dipisah:
 * - `providerCost` — tarif ASLI dari Biteship. Yang dibayar toko ke Biteship
 *   saat booking kurir (Langkah D). Tidak pernah dikirim ke frontend.
 * - `cost` — ongkir yang DITAMPILKAN dan DITAGIH ke pembeli
 *   = providerCost + markup (ShippingSettings::shippingMarkup()).
 *   Selisihnya margin toko untuk menutup biaya Rates API.
 *
 * Keduanya rupiah bulat — sama dengan satuan gross_amount Midtrans, supaya
 * ongkir bisa langsung jadi baris item_details tanpa pembulatan. Keduanya juga
 * ongkir DASAR, tanpa asuransi.
 *
 * Asuransi (Langkah D1, opsional, dibayar pembeli): `insuranceAvailable` +
 * `insuranceFee` apa adanya dari Biteship, TIDAK kena markup. Ikut di
 * toArray()/fromArray(), jadi ikut ter-cache bersama tarifnya.
 */
final readonly class ShippingRate
{
    public function __construct(
        public string $courierCode,
        public string $courierName,
        public string $serviceCode,
        public string $serviceName,
        public int $cost,
        public ?string $etd,
        public ?string $description,
        public int $providerCost,
        public bool $insuranceAvailable = false,
        public int $insuranceFee = 0,
    ) {}

    /**
     * Kebalikan toArray() — dipakai ShippingQuoteService saat membaca hasil
     * dari cache (yang disimpan array, bukan objek, supaya aman di semua
     * cache driver).
     *
     * Cache menyimpan tarif SEBELUM markup, jadi `cost` di cache = tarif asli
     * dan menjadi providerCost. Markup dipasang sesudahnya lewat withMarkup().
     *
     * Entri cache lama (sebelum D1) tidak punya field asuransi → dianggap
     * tidak tersedia.
     *
     * @param  array{courier_code: string, courier_name: string, service_code: string, service_name: string, cost: int, etd: string|null, description: string|null, insurance_available?: bool, insurance_fee?: int}  $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            courierCode: (string) $data['courier_code'],
            courierName: (string) $data['courier_name'],
            serviceCode: (string) $data['service_code'],
            serviceName: (string) $data['service_name'],
            cost: (int) $data['cost'],
            etd: $data['etd'] ?? null,
            description: $data['description'] ?? null,
            providerCost: (int) $data['cost'],
            insuranceAvailable: (bool) ($data['insurance_available'] ?? false),
            insuranceFee: (int) ($data['insurance_fee'] ?? 0),
        );
    }

    /**
     * Salinan dengan `cost` = providerCost + markup. Selalu dihitung dari
     * providerCost (bukan dari cost), jadi aman dipanggil berulang. Asuransi
     * tidak disentuh — markup hanya untuk ongkir.
     */
    public function withMarkup(int $markup): self
    {
        return new self(
            courierCode: $this->courierCode,
            courierName: $this->courierName,
            serviceCode: $this->serviceCode,
            serviceName: $this->serviceName,
            cost: $this->providerCost + max(0, $markup),
            etd: $this->etd,
            description: $this->description,
            providerCost: $this->providerCost,
            insuranceAvailable: $this->insuranceAvailable,
            insuranceFee: $this->insuranceFee,
        );
    }

    /**
     * Bentuk JSON publik untuk POST /api/shipping/rates — juga bentuk yang
     * disimpan di cache (dipanggil sebelum markup, jadi `cost` = tarif asli).
     * providerCost sengaja TIDAK ikut: pembeli cukup tahu ongkir yang ditagih.
     *
     * @return array{courier_code: string, courier_name: string, service_code: string, service_name: string, cost: int, etd: string|null, description: string|null, insurance_available: bool, insurance_fee: int}
     */
    public function toArray(): array
    {
        return [
            'courier_code' => $this->courierCode,
            'courier_name' => $this->courierName,
            'service_code' => $this->serviceCode,
            'service_name' => $this->serviceName,
            'cost' => $this->cost,
            'etd' => $this->etd,
            'description' => $this->description,
            'insurance_available' => $this->insuranceAvailable,
            'insurance_fee' => $this->insuranceFee,
        ];
    }
}
