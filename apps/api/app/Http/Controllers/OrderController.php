<?php

namespace App\Http\Controllers;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\ShipmentStatus;
use App\Exceptions\CheckoutQuoteChangedException;
use App\Exceptions\DuplicateIdempotencyKeyException;
use App\Exceptions\InsufficientStockException;
use App\Exceptions\InvalidOrderTotalException;
use App\Exceptions\InvalidShippingItemException;
use App\Exceptions\PaymentGatewayException;
use App\Exceptions\ShippingProviderException;
use App\Http\Requests\StoreOrderRequest;
use App\Models\Order;
use App\Models\Payment;
use App\Models\ProductVariant;
use App\Services\CheckoutPricing;
use App\Services\MidtransService;
use App\Services\Shipping\ShippingQuoteService;
use App\Services\Shipping\ShippingRate;
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
     * - Ongkir dihitung ULANG di backend lewat ShippingQuoteService — jalur yang
     *   sama dengan POST /api/shipping/rates (lihat
     *   docs/decisions/shipping-biteship.md). Quote diambil SEBELUM
     *   DB::transaction supaya transaksi DB tidak tertahan menunggu Biteship.
     * - Pembeli tidak boleh ditagih angka yang berbeda dari yang dilihatnya:
     *   layanan hilang / di luar allowlist, ongkir berubah, atau total berubah
     *   → order DITOLAK 422 (CheckoutQuoteChangedException), tidak disesuaikan
     *   diam-diam.
     * - total = subtotal + shipping_cost + service_fee (config
     *   services.checkout.service_fee, 0 = tidak ada).
     * - Guest checkout only, tanpa auth (konsisten dengan route lain).
     * - Idempotent per `idempotency_key`: klik ganda / retry jaringan dari satu
     *   percobaan checkout (page load /checkout yang sama) tidak membuat order +
     *   Snap token ganda. Reload halaman = key baru = percobaan baru yang sah.
     *   Konsekuensi yang disengaja: replay dengan key yang sudah punya order
     *   mengembalikan order LAMA apa adanya, walaupun kurir/alamat di request
     *   baru berbeda. Order yang DITOLAK (422) tidak tersimpan, jadi pembeli
     *   bisa memilih ulang dan submit lagi dengan key yang sama.
     *
     * @throws InvalidShippingItemException   produk nonaktif / berat kosong (→ 422)
     * @throws CheckoutQuoteChangedException  shipping_unavailable / shipping_cost_changed / total_changed (→ 422)
     */
    public function store(
        StoreOrderRequest $request,
        MidtransService $midtrans,
        ShippingQuoteService $quotes,
    ): JsonResponse {
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

        // Hitung ulang ongkir SEBELUM transaksi DB (panggilan Biteship bisa
        // makan waktu sampai timeout; jangan menahan lock/transaksi selama itu).
        // InvalidShippingItemException (produk nonaktif / berat kosong) dibiarkan
        // naik → 422 via render(), sama seperti di POST /api/shipping/rates.
        try {
            $quote = $quotes->quote($data['destination_area_id'], $data['items']);
        } catch (ShippingProviderException $e) {
            report($e);

            return response()->json(
                ['message' => 'Gagal mengambil ongkir, coba lagi.'],
                502,
            );
        }

        // Tarif di quote sudah termasuk markup (jalur yang sama dengan endpoint
        // rates), jadi dibandingkan apel-ke-apel dengan expected_shipping_cost.
        $rate = $quotes->find($quote->rates, $data['courier_code'], $data['service_code']);

        if ($rate === null) {
            throw CheckoutQuoteChangedException::shippingUnavailable();
        }

        if ($rate->cost !== (int) $data['expected_shipping_cost']) {
            throw CheckoutQuoteChangedException::shippingCostChanged($rate->cost);
        }

        try {
            $payload = DB::transaction(
                fn (): array => $this->createOrderWithSnapToken($data, $rate, $midtrans),
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
     * snapshot harga, guard nominal, buat order/items/shipment/payment, lalu
     * minta Snap token. Dipanggil di dalam DB::transaction().
     *
     * @param  array<string, mixed>  $data  hasil StoreOrderRequest::validated()
     * @param  ShippingRate  $rate  layanan pilihan pembeli yang sudah lolos cek di store()
     * @return array{order_number: string, snap_token: string, gross_amount: int}
     *
     * @throws InsufficientStockException        stok kurang / produk non-aktif (→ 422, rollback)
     * @throws InvalidOrderTotalException        total <= 0 atau item_details != gross_amount (→ 422, rollback)
     * @throws CheckoutQuoteChangedException     total != expected_total (→ 422 total_changed, rollback)
     * @throws PaymentGatewayException           Snap token gagal (→ 502, rollback)
     * @throws DuplicateIdempotencyKeyException  key sudah dipakai order lain (race → replay/409, rollback)
     */
    private function createOrderWithSnapToken(array $data, ShippingRate $rate, MidtransService $midtrans): array
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

            // Harga satuan: override varian kalau ada, kalau tidak harga dasar
            // produk. Lewat CheckoutPricing — rumus yang sama dengan meta
            // POST /api/shipping/rates yang ditampilkan di /checkout.
            $snapshots[] = [
                'product_variant_id' => $variant->id,
                'sku' => $variant->sku,
                'product_name' => $variant->product->name,
                'size' => $variant->size,
                'price' => CheckoutPricing::unitPrice($variant),
                'quantity' => $quantity,
            ];
        }

        // subtotal dari snapshot — CheckoutPricing::subtotal(), fungsi yang sama
        // yang menghasilkan meta.subtotal di POST /api/shipping/rates.
        $subtotal = CheckoutPricing::subtotal($snapshots);

        // total = subtotal + ongkir (hasil hitung ulang, sudah dicocokkan dengan
        // yang dilihat pembeli di store()) + biaya layanan (config, bisa 0).
        // Keduanya rupiah bulat, jadi tidak menambah pecahan ke total.
        $shippingCost = $rate->cost;
        $serviceFee = (int) config('services.checkout.service_fee');
        $total = $subtotal + $shippingCost + $serviceFee;
        // = toRupiah(subtotal) + ongkir + biaya layanan, karena dua yang
        // terakhir sudah bulat — persis rumus Total Tagihan di /checkout.
        $grossAmount = CheckoutPricing::toRupiah($total);

        // Guard: Midtrans menolak gross_amount <= 0 (mis. base_price 0 / salah
        // input admin). Tahan di sini dengan pesan yang jelas.
        if ($total <= 0) {
            throw new InvalidOrderTotalException('Total order harus lebih dari 0.');
        }

        // Guard: total yang akan ditagih harus PERSIS sama dengan "Total
        // Tagihan" yang dilihat pembeli (mis. harga produk / biaya layanan
        // berubah setelah halaman checkout dibuka). Di sini, bukan di store(),
        // karena subtotal baru diketahui dari snapshot DB di atas.
        if ($grossAmount !== (int) $data['expected_total']) {
            throw CheckoutQuoteChangedException::totalChanged($grossAmount);
        }

        // item_details — dibangun sebelum menulis apa pun ke DB supaya
        // ketidakcocokan nominal ketahuan tanpa INSERT+rollback.
        $itemDetails = array_map(static fn (array $s): array => [
            'id' => $s['sku'],
            'price' => (int) round($s['price']),
            'quantity' => $s['quantity'],
            'name' => mb_substr($s['product_name'].' - '.$s['size'], 0, 50),
        ], $snapshots);

        // Ongkir & biaya layanan sebagai baris tersendiri supaya
        // sum(item_details) == gross_amount tetap terjaga (dicek di bawah) dan
        // rinciannya terlihat di dashboard Midtrans. Biaya layanan 0 = tidak
        // ada baris sama sekali.
        $itemDetails[] = [
            'id' => 'SHIPPING',
            'price' => $shippingCost,
            'quantity' => 1,
            'name' => mb_substr("Ongkir {$rate->courierName} {$rate->serviceName}", 0, 50),
        ];

        if ($serviceFee > 0) {
            $itemDetails[] = [
                'id' => 'SERVICE_FEE',
                'price' => $serviceFee,
                'quantity' => 1,
                'name' => 'Biaya layanan',
            ];
        }

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
        // shipping_address menyimpan alamat TERSTRUKTUR (untuk booking kurir
        // otomatis di Langkah D) plus `address` gabungan siap tampil, supaya
        // tampilan yang membaca `address` (order lama hanya punya
        // name/phone/address) tetap jalan.
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
                    'address' => $this->composeDisplayAddress($data),
                    'address_detail' => $data['address_detail'],
                    'courier_note' => $data['courier_note'] ?? null,
                    'area_id' => $data['destination_area_id'],
                    'area_label' => $data['area_label'],
                    'postal_code' => $data['postal_code'] ?? null,
                ],
                'subtotal' => $subtotal,
                'shipping_cost' => $shippingCost,
                'service_fee' => $serviceFee,
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

        // Shipment: snapshot layanan kurir pilihan pembeli, satu baris per order,
        // di transaksi yang sama (ikut rollback kalau Snap token gagal). Belum
        // di-booking ke Biteship — itu Langkah D, setelah payment settlement.
        $order->shipment()->create([
            'courier' => $rate->courierCode,
            'courier_name' => $rate->courierName,
            'service_code' => $rate->serviceCode,
            'service_name' => $rate->serviceName,
            // cost = ongkir yang ditagih (= orders.shipping_cost, termasuk
            // markup); provider_cost = tarif asli Biteship yang dibayar toko saat
            // booking (Langkah D). Selisihnya margin toko.
            'cost' => $rate->cost,
            'provider_cost' => $rate->providerCost,
            'etd' => $rate->etd,
            'status' => ShipmentStatus::Pending,
        ]);

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
     * Alamat gabungan siap tampil: alamat detail, label area, lalu catatan
     * kurir (kalau ada) — satu per baris. Bentuk yang sama dengan yang dulu
     * dikirim frontend di field `address` (sebelum Langkah C).
     *
     * @param  array<string, mixed>  $data  hasil StoreOrderRequest::validated()
     */
    private function composeDisplayAddress(array $data): string
    {
        $parts = [trim((string) $data['address_detail']), (string) $data['area_label']];

        $note = trim((string) ($data['courier_note'] ?? ''));

        if ($note !== '') {
            $parts[] = "Catatan kurir: {$note}";
        }

        return implode("\n", $parts);
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
