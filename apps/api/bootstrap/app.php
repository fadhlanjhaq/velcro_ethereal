<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Trusted proxies: OPT-IN lewat env TRUSTED_PROXIES, MATI secara default.
        //
        // Production: browser → nginx host VPS (TLS) → nginx container → php-fpm.
        // Selama mati, $request->ip() = IP nginx container, jadi throttle "per
        // IP" (shipping-areas / shipping-rates) berlaku untuk seluruh toko
        // sekaligus — terlalu ketat, tapi tidak bisa diakali.
        //
        // Daftar proxy SENGAJA tidak di-set di sini (`at:` tidak dipakai):
        // callback ini dijalankan saat HTTP kernel dibentuk, sebelum config
        // dimuat, dan env() mengembalikan null setelah `config:cache`. Middleware
        // global TrustProxies membaca config('trustedproxy.proxies') sendiri
        // pada setiap request — lihat config/trustedproxy.php.
        //
        // Yang di-set di sini hanya header yang dipercaya: X-Forwarded-For saja.
        // Host/Port/Proto sengaja TIDAK dipercaya: HTTPS sudah di-set lewat
        // fastcgi_param di nginx container, dan mempercayai Host bisa mengubah
        // URL yang di-generate Laravel. Header ini baru berpengaruh kalau
        // TRUSTED_PROXIES diisi.
        //
        // Mengisi TRUSTED_PROXIES TANPA nginx host VPS menyetel X-Forwarded-For
        // membuat IP bisa dipalsukan: nginx meneruskan header kiriman klien apa
        // adanya, dan throttle jadi bisa diakali. Lihat
        // docs/decisions/shipping-biteship.md §2.2.
        $middleware->trustProxies(headers: Request::HEADER_X_FORWARDED_FOR);
    })
    // Nilai "percayai semua" di TRUSTED_PROXIES (*, REMOTE_ADDR, 0.0.0.0/0, ...)
    // sudah dibuang di config/trustedproxy.php; di sini hanya diberi tahu lewat
    // log. Di `booted` (bukan di file config) karena logger baru tersedia
    // setelah aplikasi boot, dan file config hanya dievaluasi sekali saat
    // `config:cache`.
    ->booted(function (): void {
        $rejected = (array) config('trustedproxy.rejected');

        if ($rejected !== []) {
            Log::warning('TRUSTED_PROXIES berisi nilai "percayai semua" yang ditolak dan diabaikan.', [
                'rejected' => $rejected,
            ]);
        }
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
    })->create();
