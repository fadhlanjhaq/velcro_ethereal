<?php

use App\Http\Controllers\BiteshipWebhookController;
use App\Http\Controllers\MidtransWebhookController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ShippingController;
use App\Http\Controllers\SiteContentController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Endpoint publik katalog produk. Semua route di file ini otomatis diberi
| prefix "/api" oleh bootstrap/app.php. Bentuk JSON response mengikuti kontrak
| di apps/web/src/lib/mock-products.ts (lihat App\Http\Resources\*).
|
*/

Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/{slug}', [ProductController::class, 'show']);
Route::get('/site-content', [SiteContentController::class, 'index']);

// Checkout: buat order dari cart + minta Snap token Midtrans. Publik (guest
// checkout), tanpa middleware — konsisten dengan route di atas.
Route::post('/orders', [OrderController::class, 'store']);

// Ongkir (Biteship): autocomplete area tujuan + cek tarif kurir. Publik (guest
// checkout), tapi WAJIB throttle per IP — tiap request yang lolos cache memicu
// panggilan Biteship berbayar. Limiter didefinisikan di AppServiceProvider.
Route::get('/shipping/areas', [ShippingController::class, 'areas'])
    ->middleware('throttle:shipping-areas');
Route::post('/shipping/rates', [ShippingController::class, 'rates'])
    ->middleware('throttle:shipping-rates');

// Payment notification dari Midtrans (server-to-server, bukan browser). Publik,
// tanpa middleware — keasliannya diverifikasi lewat signature di controller.
Route::post('/midtrans/notification', [MidtransWebhookController::class, 'handle']);

// Webhook status pengiriman dari Biteship (server-to-server). Publik, tapi
// keasliannya diverifikasi lewat header rahasia di controller (fail closed).
// Throttle longgar terpisah — hanya rem kalau ada banjir request, bukan
// pembatas normal (Biteship bisa mengirim beberapa event per order).
Route::post('/biteship/webhook', [BiteshipWebhookController::class, 'handle'])
    ->middleware('throttle:biteship-webhook');
