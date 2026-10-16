<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'midtrans' => [
        'server_key' => env('MIDTRANS_SERVER_KEY'),
        'client_key' => env('MIDTRANS_CLIENT_KEY'),
        'merchant_id' => env('MIDTRANS_MERCHANT_ID'),
        'is_production' => (bool) env('MIDTRANS_IS_PRODUCTION', false),
    ],

    // Biteship (ongkir). Mode test/live ditentukan oleh jenis API key
    // (biteship_test. / biteship_live.), base URL sama. Lihat
    // docs/decisions/shipping-biteship.md.
    'biteship' => [
        'api_key' => env('BITESHIP_API_KEY'),
        'base_url' => env('BITESHIP_BASE_URL', 'https://api.biteship.com'),
        'timeout' => (int) env('BITESHIP_TIMEOUT', 10),
        // "jne, jnt,,sicepat" → ['jne', 'jnt', 'sicepat']. Paket Starter
        // maksimal 3 kurir aktif.
        'couriers' => array_values(array_filter(
            array_map('trim', explode(',', (string) env('BITESHIP_COURIERS', 'jne,jnt,sicepat'))),
            static fn (string $code): bool => $code !== '',
        )),
        // Allowlist LAYANAN (bukan kurir), format "kurir:layanan". Satu kurir
        // punya layanan yang tidak cocok untuk pakaian — mis. JNE Trucking
        // (jne:jtr, minimum 10 kg) — jadi yang difilter per layanan.
        // - env tidak di-set → default di bawah.
        // - env di-set string kosong (BITESHIP_ALLOWED_SERVICES=) → array kosong
        //   → TIDAK memfilter, semua layanan dari Biteship ditampilkan. Berguna
        //   untuk melihat kode layanan apa saja yang tersedia di sandbox.
        'allowed_services' => array_values(array_filter(
            array_map(
                static fn (string $entry): string => strtolower(trim($entry)),
                explode(',', (string) env('BITESHIP_ALLOWED_SERVICES', 'jne:reg,jne:yes,jnt:ez,sicepat:reg,sicepat:best')),
            ),
            static fn (string $entry): bool => $entry !== '',
        )),
        'origin' => [
            'area_id' => env('BITESHIP_ORIGIN_AREA_ID'),
            'postal_code' => env('BITESHIP_ORIGIN_POSTAL_CODE'),
            'contact_name' => env('BITESHIP_ORIGIN_CONTACT_NAME'),
            'contact_phone' => env('BITESHIP_ORIGIN_CONTACT_PHONE'),
            'address' => env('BITESHIP_ORIGIN_ADDRESS'),
        ],
    ],

    // Aturan checkout milik toko (bukan milik satu vendor), dipakai bersama
    // POST /api/shipping/rates (meta) dan POST /api/orders (hitung ulang).
    'checkout' => [
        // Biaya layanan per order, rupiah bulat. 0 = tidak ditampilkan di UI
        // dan tidak ada baris SERVICE_FEE di item_details Midtrans. Dipaksa
        // >= 0 supaya salah isi env tidak berubah jadi diskon diam-diam.
        // Tidak dipakai (biarkan 0): Kapten memilih markup ongkir
        // (shipping_markup di bawah) — lihat docs/decisions/shipping-biteship.md §1.6.
        'service_fee' => max(0, (int) env('SERVICE_FEE', 0)),
        // Markup flat per order di atas tarif kurir Biteship, rupiah bulat —
        // keputusan Kapten untuk menutup biaya Rates API (rencana 500 di
        // production). Dipasang ShippingQuoteService setelah cache, jadi
        // ongkir yang tampil = yang ditagih = tarif asli + markup. >= 0.
        'shipping_markup' => max(0, (int) env('SHIPPING_MARKUP', 0)),
    ],

];
