<?php

namespace App\Services\Shipping;

use App\Models\ShippingSetting;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Log;

/**
 * Satu sumber kebenaran pengaturan BISNIS pengiriman: data gudang, kurir aktif,
 * allowlist layanan, markup ongkir.
 *
 * Prioritas PER FIELD: nilai di tabel shipping_settings (halaman admin
 * "Pengaturan Pengiriman") kalau terisi; kalau kosong/null → cadangan dari
 * config .env (services.biteship.origin / couriers / allowed_services,
 * services.checkout.shipping_markup). Bentuk kembaliannya sama dengan config
 * lama, jadi pemanggil cukup mengganti sumbernya.
 *
 * Rahasia & teknis (API key, secret webhook, base URL, timeout, trusted proxies,
 * SERVICE_FEE) TIDAK lewat sini — tetap langsung dari config/.env.
 *
 * DB dibaca sekali per request (memo di instance; di-bind `scoped` di
 * AppServiceProvider). Tidak pakai Laravel cache: perubahan di admin harus
 * langsung berlaku di request berikutnya, dan satu query kecil per request
 * cukup murah. Cache key tarif memakai nilai efektif dari sini, jadi perubahan
 * kurir/allowlist/origin otomatis memakai entri cache baru.
 */
class ShippingSettings
{
    private ?ShippingSetting $record = null;

    private bool $loaded = false;

    /**
     * Baris pengaturan (atau null kalau belum pernah disimpan / tabel belum
     * ada). Tabel belum ada = kode sudah ter-deploy tapi migrate belum jalan:
     * jangan bikin checkout error — pakai cadangan .env.
     */
    public function record(): ?ShippingSetting
    {
        if (! $this->loaded) {
            $this->loaded = true;

            try {
                $this->record = ShippingSetting::query()->orderBy('id')->first();
            } catch (QueryException $e) {
                Log::warning('ShippingSettings: tabel shipping_settings tidak bisa dibaca, memakai cadangan .env.', [
                    'error' => $e->getMessage(),
                ]);

                $this->record = null;
            }
        }

        return $this->record;
    }

    /**
     * Lupakan memo — dipanggil setelah admin menyimpan, supaya sisa request
     * yang sama membaca nilai baru.
     */
    public function forget(): void
    {
        $this->record = null;
        $this->loaded = false;
    }

    /**
     * @return array{contact_name: ?string, contact_phone: ?string, address: ?string, area_id: ?string, area_label: ?string, postal_code: ?string}
     */
    public function origin(): array
    {
        $fallback = $this->fallbackOrigin();
        $record = $this->record();

        return [
            'contact_name' => $this->stringOr($record?->origin_contact_name, $fallback['contact_name']),
            'contact_phone' => $this->stringOr($record?->origin_contact_phone, $fallback['contact_phone']),
            'address' => $this->stringOr($record?->origin_address, $fallback['address']),
            'area_id' => $this->stringOr($record?->origin_area_id, $fallback['area_id']),
            // Label hanya ada di DB (config .env tidak menyimpan label area).
            'area_label' => $this->stringOr($record?->origin_area_id !== null ? $record->origin_area_label : null, null),
            'postal_code' => $this->stringOr($record?->origin_postal_code, $fallback['postal_code']),
        ];
    }

    /**
     * Kode kurir aktif, mis. ['jne', 'jnt', 'sicepat'].
     *
     * @return array<int, string>
     */
    public function couriers(): array
    {
        $stored = $this->normalizeList($this->record()?->couriers);

        return $stored !== [] ? $stored : $this->fallbackCouriers();
    }

    /**
     * Allowlist "kurir:layanan" lowercase. Kosong = tidak memfilter (perilaku
     * lama dari .env BITESHIP_ALLOWED_SERVICES=). Dari DB tidak pernah kosong
     * (halaman admin mewajibkan minimal 1); DB kosong → cadangan .env.
     *
     * @return array<int, string>
     */
    public function allowedServices(): array
    {
        $stored = $this->normalizeList($this->record()?->allowed_services);

        return $stored !== [] ? $stored : $this->fallbackAllowedServices();
    }

    /**
     * Markup flat ongkir (rupiah, ≥ 0). 0 di DB adalah nilai sah (bukan
     * "kosong") — hanya null yang jatuh ke cadangan.
     */
    public function shippingMarkup(): int
    {
        $stored = $this->record()?->shipping_markup;

        return $stored !== null ? max(0, (int) $stored) : $this->fallbackShippingMarkup();
    }

    /**
     * Nilai cadangan dari .env yang sedang berlaku — untuk keterangan di
     * halaman admin. Tidak berisi rahasia apa pun.
     *
     * @return array{contact_name: ?string, contact_phone: ?string, address: ?string, area_id: ?string, postal_code: ?string}
     */
    public function fallbackOrigin(): array
    {
        $origin = (array) config('services.biteship.origin');

        return [
            'contact_name' => $this->stringOr($origin['contact_name'] ?? null, null),
            'contact_phone' => $this->stringOr($origin['contact_phone'] ?? null, null),
            'address' => $this->stringOr($origin['address'] ?? null, null),
            'area_id' => $this->stringOr($origin['area_id'] ?? null, null),
            'postal_code' => $this->stringOr($origin['postal_code'] ?? null, null),
        ];
    }

    /**
     * @return array<int, string>
     */
    public function fallbackCouriers(): array
    {
        return $this->normalizeList(config('services.biteship.couriers'));
    }

    /**
     * @return array<int, string>
     */
    public function fallbackAllowedServices(): array
    {
        return $this->normalizeList(config('services.biteship.allowed_services'));
    }

    public function fallbackShippingMarkup(): int
    {
        return max(0, (int) config('services.checkout.shipping_markup'));
    }

    private function stringOr(mixed $value, ?string $fallback): ?string
    {
        $value = is_scalar($value) ? trim((string) $value) : '';

        return $value !== '' ? $value : $fallback;
    }

    /**
     * Array string lowercase, di-trim, tanpa kosong/duplikat.
     *
     * @return array<int, string>
     */
    private function normalizeList(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        $items = array_map(
            static fn ($item): string => is_scalar($item) ? strtolower(trim((string) $item)) : '',
            $value,
        );

        return array_values(array_unique(array_filter($items, static fn (string $item): bool => $item !== '')));
    }
}
