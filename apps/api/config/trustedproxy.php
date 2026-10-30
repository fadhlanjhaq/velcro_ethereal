<?php

/*
|--------------------------------------------------------------------------
| Trusted Proxies (opt-in, MATI secara default)
|--------------------------------------------------------------------------
|
| Dibaca oleh middleware global Illuminate\Http\Middleware\TrustProxies lewat
| config('trustedproxy.proxies') pada SETIAP request (Laravel 13), bukan saat
| bootstrap/app.php dievaluasi — jadi tetap jalan setelah `config:cache`
| (env() di luar file config mengembalikan null begitu config di-cache).
|
| TRUSTED_PROXIES = daftar IP/CIDR dipisah koma, mis. "172.16.0.0/12".
| - Kosong / tidak di-set → array kosong → TIDAK ada proxy yang dipercaya;
|   $request->ip() = REMOTE_ADDR, persis seperti sebelum Langkah B Biteship.
|   Sengaja selalu array (bukan null): untuk null, Laravel otomatis memakai
|   '*' di host Laravel Cloud / Forge / Vapor.
| - Isi HANYA setelah nginx host VPS dipastikan MENYETEL (bukan meneruskan)
|   header X-Forwarded-For. Kalau tidak, nginx meneruskan X-Forwarded-For
|   kiriman klien apa adanya, IP bisa dipalsukan, dan throttle per IP
|   (shipping-areas / shipping-rates) bisa diakali.
|
| Nilai "percayai semua" ditolak dan diabaikan (lihat `rejected`, di-log
| sebagai warning oleh callback `booted` di bootstrap/app.php). Lihat
| docs/decisions/shipping-biteship.md §2.2.
|
*/

$wildcards = ['*', '**', 'REMOTE_ADDR', '0.0.0.0/0', '::/0'];

$entries = array_values(array_filter(
    array_map('trim', explode(',', (string) env('TRUSTED_PROXIES', ''))),
    static fn (string $entry): bool => $entry !== '',
));

return [

    'proxies' => array_values(array_filter(
        $entries,
        static fn (string $entry): bool => ! in_array(strtoupper($entry), $wildcards, true),
    )),

    'rejected' => array_values(array_filter(
        $entries,
        static fn (string $entry): bool => in_array(strtoupper($entry), $wildcards, true),
    )),

];
