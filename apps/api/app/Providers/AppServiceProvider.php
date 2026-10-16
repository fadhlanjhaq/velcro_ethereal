<?php

namespace App\Providers;

use App\Services\Shipping\BiteshipShippingProvider;
use App\Services\Shipping\ShippingProvider;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Satu-satunya provider ongkir saat ini. Lihat docs/decisions/shipping-biteship.md.
        $this->app->bind(ShippingProvider::class, BiteshipShippingProvider::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Endpoint ongkir publik memicu panggilan Biteship yang berbayar per
        // request (kalau cache miss), jadi wajib dibatasi per IP. Autocomplete
        // area lebih longgar karena dipanggil saat pembeli mengetik.
        RateLimiter::for('shipping-areas', fn (Request $request) => Limit::perMinute(30)->by($request->ip()));
        RateLimiter::for('shipping-rates', fn (Request $request) => Limit::perMinute(20)->by($request->ip()));
    }
}
