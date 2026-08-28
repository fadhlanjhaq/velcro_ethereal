<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Di dev/production, request storefront utama lewat proxy Next.js (rewrites
    | di next.config.ts) / nginx reverse proxy (Milestone 2), sehingga dari
    | sisi browser terlihat same-origin dan CORS tidak ikut main. Konfigurasi
    | ini adalah FALLBACK keamanan untuk kasus request cross-origin langsung ke
    | Laravel — karena itu origin dibatasi eksplisit ke dev server Next.js,
    | BUKAN wildcard '*' (default Laravel terlalu longgar untuk dibiarkan).
    |
    */

    'paths' => ['api/*'],

    'allowed_methods' => ['GET', 'POST', 'OPTIONS'],

    // Origin dev Next.js (localhost:3000). Tambahkan origin production nyata
    // saat deploy kalau storefront pernah memanggil Laravel lintas-origin.
    'allowed_origins' => [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['Accept', 'Content-Type', 'X-Requested-With'],

    'exposed_headers' => [],

    'max_age' => 0,

    // Katalog produk bersifat publik & read-only; tidak ada cookie/kredensial.
    'supports_credentials' => false,

];
