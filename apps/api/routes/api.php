<?php

use App\Http\Controllers\ProductController;
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
