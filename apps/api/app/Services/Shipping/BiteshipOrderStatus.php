<?php

namespace App\Services\Shipping;

/**
 * Pengelompokan status order Biteship (field `status` di webhook order.status).
 *
 * Daftar status diverifikasi ke docs Biteship Orders (Okt 2026): confirmed,
 * scheduled, allocated, picking_up, picked, cancelled, on_hold, in_transit,
 * dropping_off, return_in_transit, returned, rejected, disposed,
 * courier_not_found, delivered. Status di luar daftar → null (tidak dikenal):
 * dicatat di provider_status, tapi tidak mengubah status enum apa pun.
 *
 * Satu sumber untuk webhook controller, model Shipment, dan tabel/filter admin,
 * supaya "bermasalah" berarti hal yang sama di semua tempat.
 */
final class BiteshipOrderStatus
{
    /** Kurir belum memegang paket — shipment tetap `processing`. */
    public const PROCESSING = ['confirmed', 'scheduled', 'allocated', 'picking_up'];

    /** Paket sudah dijemput & dalam perjalanan — shipment `shipped`, order `shipped`. */
    public const SHIPPED = ['picked', 'in_transit', 'dropping_off'];

    /** Paket sampai — shipment `delivered`, order `completed`. */
    public const DELIVERED = ['delivered'];

    /**
     * Perlu perhatian admin. Status enum TIDAK diubah (tidak ada padanannya,
     * dan sebagian bisa pulih, mis. on_hold); cukup tercatat di provider_status
     * dan tampil "Bermasalah" di admin.
     */
    public const PROBLEM = [
        'cancelled', 'rejected', 'courier_not_found', 'on_hold',
        'return_in_transit', 'returned', 'disposed',
    ];

    public const GROUP_PROCESSING = 'processing';

    public const GROUP_SHIPPED = 'shipped';

    public const GROUP_DELIVERED = 'delivered';

    public const GROUP_PROBLEM = 'problem';

    /**
     * @return self::GROUP_*|null  null = status tidak dikenal
     */
    public static function group(?string $status): ?string
    {
        $status = strtolower(trim((string) $status));

        return match (true) {
            in_array($status, self::PROCESSING, true) => self::GROUP_PROCESSING,
            in_array($status, self::SHIPPED, true) => self::GROUP_SHIPPED,
            in_array($status, self::DELIVERED, true) => self::GROUP_DELIVERED,
            in_array($status, self::PROBLEM, true) => self::GROUP_PROBLEM,
            default => null,
        };
    }

    public static function isProblem(?string $status): bool
    {
        return self::group($status) === self::GROUP_PROBLEM;
    }
}
