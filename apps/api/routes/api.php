<?php

use App\Http\Controllers\MidtransWebhookController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ProductController;
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

// Payment notification dari Midtrans (server-to-server, bukan browser). Publik,
// tanpa middleware — keasliannya diverifikasi lewat signature di controller.
Route::post('/midtrans/notification', [MidtransWebhookController::class, 'handle']);
