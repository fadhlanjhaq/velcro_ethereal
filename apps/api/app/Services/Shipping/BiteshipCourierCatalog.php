<?php

namespace App\Services\Shipping;

/**
 * Katalog kurir & layanan Biteship untuk kotak centang di halaman admin
 * "Pengaturan Pengiriman".
 *
 * Sengaja daftar statis di kode (bukan GET /v1/couriers): halaman admin tidak
 * perlu memanggil API berbayar hanya untuk menampilkan pilihan, dan daftarnya
 * jarang berubah. Kode dicocokkan dengan docs Biteship "Couriers" (Okt 2026):
 * jne reg/yes/jtr, jnt ez, sicepat reg/best/gokil, anteraja reg/same_day.
 *
 * `jne:oke` dan `anteraja:next_day` TIDAK tercantum di docs Biteship (next_day
 * hanya untuk pos) tapi diminta ada di katalog — ditandai UNDOCUMENTED supaya
 * admin tahu kodenya belum terkonfirmasi. Layanan kargo ditandai CARGO (berat
 * minimum tinggi, tidak cocok untuk pakaian satuan).
 *
 * Nilai allowlist tersimpan yang tidak ada di sini tetap dipertahankan dan
 * ditampilkan sebagai "kode lain" (lihat ShippingSettingsPage).
 */
final class BiteshipCourierCatalog
{
    /**
     * @var array<string, array{name: string, services: array<string, string>}>
     */
    public const COURIERS = [
        'jne' => [
            'name' => 'JNE',
            'services' => [
                'reg' => 'Reguler',
                'yes' => 'YES (besok sampai)',
                'oke' => 'OKE (ekonomis)',
                'jtr' => 'JTR (trucking)',
            ],
        ],
        'jnt' => [
            'name' => 'J&T Express',
            'services' => [
                'ez' => 'EZ (reguler)',
            ],
        ],
        'sicepat' => [
            'name' => 'SiCepat',
            'services' => [
                'reg' => 'Reguler',
                'best' => 'BEST (besok sampai)',
                'gokil' => 'GOKIL',
            ],
        ],
        'anteraja' => [
            'name' => 'AnterAja',
            'services' => [
                'reg' => 'Reguler',
                'next_day' => 'Next Day',
                'same_day' => 'Same Day (area Jakarta)',
            ],
        ],
    ];

    /** Layanan kargo — minimum berat tinggi (jne:jtr min 10 kg). */
    public const CARGO = ['jne:jtr', 'sicepat:gokil'];

    /** Diminta ada di katalog, tapi kodenya tidak tercantum di docs Biteship. */
    public const UNDOCUMENTED = ['jne:oke', 'anteraja:next_day'];

    /**
     * @return array<string, string>  kode kurir => nama
     */
    public static function courierOptions(): array
    {
        return array_map(static fn (array $courier): string => $courier['name'], self::COURIERS);
    }

    /**
     * Label kotak centang layanan, dengan penanda kargo / belum terdokumentasi.
     *
     * @return array<string, string>  kode layanan => label
     */
    public static function serviceOptions(string $courierCode): array
    {
        $options = [];

        foreach (self::COURIERS[$courierCode]['services'] ?? [] as $code => $name) {
            $entry = "{$courierCode}:{$code}";
            $label = "{$name} — {$code}";

            if (in_array($entry, self::CARGO, true)) {
                $label .= $entry === 'jne:jtr' ? ' · kargo, min 10 kg' : ' · kargo';
            }

            if (in_array($entry, self::UNDOCUMENTED, true)) {
                $label .= ' · belum ada di docs Biteship';
            }

            $options[$code] = $label;
        }

        return $options;
    }

    /**
     * Entri "kurir:layanan" ada di katalog.
     */
    public static function has(string $entry): bool
    {
        [$courier, $service] = array_pad(explode(':', $entry, 2), 2, '');

        return isset(self::COURIERS[$courier]['services'][$service]);
    }
}
