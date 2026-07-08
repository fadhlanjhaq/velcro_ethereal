<?php

namespace App\Http\Controllers;

use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProductController extends Controller
{
    /**
     * Daftar semua produk aktif. Eager load category/variants/images untuk
     * menghindari N+1 query (relasi images sudah orderBy sort_order di model).
     */
    public function index(): AnonymousResourceCollection
    {
        $products = Product::query()
            ->where('is_active', true)
            ->with(['category', 'variants', 'images'])
            ->orderBy('id')
            ->get();

        return ProductResource::collection($products);
    }

    /**
     * Detail satu produk berdasarkan slug. 404 (JSON) kalau slug tidak ada
     * atau produknya tidak aktif.
     */
    public function show(string $slug): ProductResource
    {
        $product = Product::query()
            ->where('slug', $slug)
            ->where('is_active', true)
            ->with(['category', 'variants', 'images'])
            ->firstOrFail();

        return new ProductResource($product);
    }
}
