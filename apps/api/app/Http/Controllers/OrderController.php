<?php

namespace App\Http\Controllers;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Exceptions\DuplicateIdempotencyKeyException;
use App\Exceptions\InsufficientStockException;
use App\Exceptions\InvalidOrderTotalException;
use App\Exceptions\PaymentGatewayException;
use App\Http\Requests\StoreOrderRequest;
use App\Models\Order;
use App\Models\Payment;
use App\Models\ProductVariant;
use App\Services\MidtransService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class OrderController extends Controller
{
    /**
     * Buat order dari cart + minta Snap token Midtrans, dalam satu transaksi DB.
     *
     * Keputusan yang sudah diambil (lihat docs/decisions/payments-midtrans.md):
     * - Stok TIDAK dikurangi di sini, hanya divalidasi cukup/tidak. Pengurangan
     *   stok nyata terjadi di webhook handler (fase berikutnya).
     * - Harga & nama produk diambil ULANG dari database berdasarkan
     *   product_variant_id; nilai dari body request tidak dipercaya.
     * - shipping_cost di-hardcode 0 (Biteship belum terintegrasi).
     * - Guest checkout only, tanpa auth (konsisten dengan route lain).
     * - Idempotent per `idempotency_key`: klik ganda / retry jaringan dari satu
     *   percobaan checkout (page load /checkout yang sama) tidak membuat order +
     *   Snap token ganda. Reload halaman = key baru = percobaan baru yang sah.
     */
    public function store(StoreOrderRequest $request, MidtransService $midtrans): JsonResponse
    {
        $data = $request->validated();

        // Idempotency (cek aplikasi, sebelum transaksi). Kalau key ini sudah
        // pernah diproses, kembalikan response yang sama tanpa memanggil Midtrans
        // atau membuat order baru. Race condition di-cover terpisah oleh unique
        // index DB (lihat createOrderWithSnapToken()).
        $existing = Order::query()
            ->where('idempotency_key', $data['idempotency_key'])
            ->with('payment')
            ->first();

        if ($existing !== null) {
            return $this->respondForExistingOrder($existing);
        }

        try {
            $payload = DB::transaction(
                fn (): array => $this->createOrderWithSnapToken($data, $midtrans),
            );
        } catch (DuplicateIdempotencyKeyException $e) {
            // Request lain dengan key yang sama menang balapan INSERT; transaksi
            // kita sudah ter-rollback. Ambil order pemenangnya dan replay
            // response-nya (atau 409 kalau belum lengkap).
            $winner = Order::query()
                ->where('idempotency_key', $data['idempotency_key'])
                ->with('payment')
                ->first();

            return $this->respondForExistingOrder($winner);
        } catch (PaymentGatewayException $e) {
            // Order + items + payment yang barusan dibuat sudah ter-rollback
            // oleh DB::transaction() saat exception ini keluar dari closure.
            report($e);

            return response()->json(
                ['message' => 'Gagal menghubungi payment gateway, coba lagi.'],
                502,
            );
        }

        return response()->json(['data' => $payload], 201);
    }

    /**
     * Response untuk idempotency-hit (order dengan key ini sudah ada):
     * - payment + snap_token lengkap → 200 dengan body yang sama persis seperti
     *   jalur normal (bukan 201 — ini bukan resource baru).
     * - selain itu (payment/snap_token belum lengkap, atau order pemenang belum
     *   sempat commit penuh) → 409, kondisi transient yang jelas, bukan 500.
     */
    private function respondForExistingOrder(?Order $order): JsonResponse
    {
        $payment = $order?->payment;

        if (
            $order !== null
            && $payment !== null
            && $payment->snap_token !== null
            && $payment->snap_token !== ''
        ) {
            return response()->json([
                'data' => [
                    'order_number' => $order->order_number,
                    'snap_token' => $payment->snap_token,
                    'gross_amount' => (int) $payment->gross_amount,
                ],
            ], 200);
        }

        if ($order !== null) {
            Log::warning('POST /api/orders idempotency-hit tapi payment/snap_token belum lengkap.', [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'has_payment' => $payment !== null,
            ]);
        }

        return response()->json(
            ['message' => 'Order ini sedang diproses, coba beberapa saat lagi.'],
            409,
        );
    }

    /**
     * Isi transaksi: agregasi item, validasi stok & ketersediaan produk,
     * snapshot harga, guard nominal, buat order/items/payment, lalu minta Snap
     * token. Dipanggil di dalam DB::transaction().
     *
     * @param  array<string, mixed>  $data  hasil StoreOrderRequest::validated()
     * @return array{order_number: string, snap_token: string, gross_amount: int}
     *
     * @throws InsufficientStockException        stok kurang / produk non-aktif (→ 422, rollback)
     * @throws InvalidOrderTotalException        total <= 0 atau item_details != gross_amount (→ 422, rollback)
     * @throws PaymentGatewayException           Snap token gagal (→ 502, rollback)
     * @throws DuplicateIdempotencyKeyException  key sudah dipakai order lain (race → replay/409, rollback)
     */
    private function createOrderWithSnapToken(array $data, MidtransService $midtrans): array
    {
        // Gabungkan baris item yang menunjuk product_variant_id sama: quantity
        // dijumlahkan lebih dulu, supaya (a) validasi stok membandingkan TOTAL
        // permintaan per varian (bukan per baris — kalau tidak, qty 3 + qty 3
        // untuk stok 5 lolos dua-duanya), dan (b) order_items tidak menghasilkan
        // baris kembar untuk varian yang sama.
        $requestedQtyByVariant = [];

        foreach ($data['items'] as $line) {
            $variantId = (int) $line['product_variant_id'];
            $requestedQtyByVariant[$variantId] =
                ($requestedQtyByVariant[$variantId] ?? 0) + (int) $line['quantity'];
        }

        // Untuk tiap varian: ambil ulang varian + produk dari DB, cek produk
        // masih aktif & stok cukup, lalu kumpulkan snapshot (harga & nama dari
        // DB, bukan dari request).
        $snapshots = [];

        foreach ($requestedQtyByVariant as $variantId => $quantity) {
            /** @var ProductVariant $variant */
            $variant = ProductVariant::query()
                ->with('product')
                ->findOrFail($variantId);

            // Produk sudah dinonaktifkan admin (tidak tampil di storefront):
            // diperlakukan sama seperti stok kurang → 422, bukan checkout diam-diam.
            if ($variant->product->is_active === false) {
                throw new InsufficientStockException(
                    "Produk {$variant->product->name} ukuran {$variant->size} sudah tidak tersedia."
                );
            }

            if ($variant->stock < $quantity) {
                throw new InsufficientStockException(
                    "Stok tidak mencukupi untuk {$variant->product->name} ukuran {$variant->size} "
                    ."(tersedia {$variant->stock}, diminta {$quantity})."
                );
            }

            // Harga satuan: override varian kalau ada, kalau tidak harga dasar produk.
            $unitPrice = $variant->price_override ?? $variant->product->base_price;

            $snapshots[] = [
                'product_variant_id' => $variant->id,
                'sku' => $variant->sku,
                'product_name' => $variant->product->name,
                'size' => $variant->size,
                'price' => (float) $unitPrice,
                'quantity' => $quantity,
            ];
        }

        // subtotal dari snapshot.
        $subtotal = array_sum(array_map(
            static fn (array $s): float => $s['price'] * $s['quantity'],
            $snapshots,
        ));

        // total. shipping_cost hardcoded 0.
        // TODO(biteship): ganti dengan ongkir nyata setelah Biteship terintegrasi
        // (lihat catatan di apps/web/src/app/(main)/checkout/page.tsx).
        $shippingCost = 0;
        $total = $subtotal + $shippingCost;
        $grossAmount = (int) round($total);

        // Guard: Midtrans menolak gross_amount <= 0 (mis. base_price 0 / salah
        // input admin). Tahan di sini dengan pesan yang jelas.
        if ($total <= 0) {
            throw new InvalidOrderTotalException('Total order harus lebih dari 0.');
        }

        // item_details — dibangun sebelum menulis apa pun ke DB supaya
        // ketidakcocokan nominal ketahuan tanpa INSERT+rollback.
        $itemDetails = array_map(static fn (array $s): array => [
            'id' => $s['sku'],
            'price' => (int) round($s['price']),
            'quantity' => $s['quantity'],
            'name' => mb_substr($s['product_name'].' - '.$s['size'], 0, 50),
        ], $snapshots);

        // Guard: sum(item_details.price * quantity) HARUS persis sama dengan
        // gross_amount atau Midtrans menolak transaksinya. Kalau meleset
        // (mis. price_override dengan pecahan sen), gagalkan dari sisi kita
        // dengan pesan jelas — jangan sampai request menyentuh Midtrans.
        $itemDetailsSum = array_sum(array_map(
            static fn (array $item): int => $item['price'] * $item['quantity'],
            $itemDetails,
        ));

        if ($itemDetailsSum !== $grossAmount) {
            report(new RuntimeException(
                "gross_amount mismatch: grossAmount={$grossAmount}, itemDetailsSum={$itemDetailsSum}"
            ));

            throw new InvalidOrderTotalException('Rincian item tidak konsisten dengan total order.');
        }

        // Nomor order unik — padanan PHP dari generateOrderNumber() frontend.
        $orderNumber = $this->generateOrderNumber();

        // Order. Guest checkout → user_id null. phone ikut disimpan di
        // shipping_address karena tabel orders tidak punya kolom phone.
        //
        // Race condition: kalau request lain dengan idempotency_key yang sama
        // menang duluan INSERT, unique index `orders.idempotency_key` menolak
        // yang ini. Laravel melempar UniqueConstraintViolationException; kalau
        // yang dilanggar memang `idempotency_key` (bukan mis. tabrakan
        // order_number — itu error lain yang harus tetap naik), ubah jadi
        // DuplicateIdempotencyKeyException supaya store() bisa replay response
        // order pemenang.
        try {
            $order = Order::create([
                'order_number' => $orderNumber,
                'idempotency_key' => $data['idempotency_key'],
                'user_id' => null,
                'guest_email' => $data['guest_email'],
                'guest_name' => $data['guest_name'],
                'shipping_address' => [
                    'name' => $data['guest_name'],
                    'phone' => $data['phone'],
                    'address' => $data['address'],
                ],
                'subtotal' => $subtotal,
                'shipping_cost' => $shippingCost,
                'total' => $total,
                'status' => OrderStatus::Pending,
            ]);
        } catch (UniqueConstraintViolationException $e) {
            if (str_contains($e->getMessage(), 'idempotency_key')) {
                throw new DuplicateIdempotencyKeyException(
                    'idempotency_key sudah dipakai order lain (race condition).',
                    previous: $e,
                );
            }

            throw $e;
        }

        // OrderItem per snapshot (satu baris per varian — sudah diagregasi di atas).
        foreach ($snapshots as $s) {
            $order->items()->create([
                'product_variant_id' => $s['product_variant_id'],
                'product_name' => $s['product_name'],
                'size' => $s['size'],
                'price' => $s['price'],
                'quantity' => $s['quantity'],
            ]);
        }

        // midtrans_order_id = order_number (1:1 untuk sekarang; belum ada logic
        // retry/regenerate token — di luar scope fase ini).
        $payment = Payment::create([
            'order_id' => $order->id,
            'midtrans_order_id' => $orderNumber,
            'status' => PaymentStatus::Pending,
            'amount' => $total,
            'gross_amount' => $grossAmount,
        ]);

        $snapToken = $midtrans->createSnapToken([
            'transaction_details' => [
                'order_id' => $payment->midtrans_order_id,
                'gross_amount' => $grossAmount,
            ],
            'item_details' => $itemDetails,
            'customer_details' => [
                'first_name' => $data['guest_name'],
                'email' => $data['guest_email'],
                'phone' => $data['phone'],
            ],
        ]);

        // Simpan snap_token yang berhasil didapat.
        $payment->update(['snap_token' => $snapToken]);

        return [
            'order_number' => $order->order_number,
            'snap_token' => $snapToken,
            'gross_amount' => $grossAmount,
        ];
    }

    /**
     * "VE-" + 8 digit terakhir epoch milidetik + 4 digit acak.
     * Padanan PHP dari generateOrderNumber() di apps/web/src/lib/order.ts.
     */
    private function generateOrderNumber(): string
    {
        $ms = substr((string) (int) (microtime(true) * 1000), -8);

        return sprintf('VE-%s-%d', $ms, random_int(1000, 9999));
    }
}
