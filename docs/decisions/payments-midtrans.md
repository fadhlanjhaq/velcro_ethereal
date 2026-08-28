# Keputusan Integrasi Pembayaran — Midtrans

**Status:** Aktif. Endpoint `POST /api/orders` (buat order dari cart + minta Snap
token) dan webhook `POST /api/midtrans/notification` (payment notification —
diproses sinkron) sudah jalan. Yang belum: reduksi stok belum di-uji end-to-end
dengan Midtrans sandbox nyata, dan tidak ada mekanisme otomatis untuk
refund/partial_refund maupun oversell (lihat Known Limitations).

**Sifat dokumen:** catatan keputusan teknis & bisnis granular untuk integrasi
Midtrans di `apps/api`. Ini **bukan** changelog per-milestone (itu di
`docs/MILESTONES.md`) dan **bukan** spec tingkat tinggi (itu di `docs/SOT.md`) —
lihat "Alasan struktur" di bagian akhir.

**Cara membaca:** tiga bagian di bawah punya bobot berbeda.

| Bagian | Kalau mau diubah |
|---|---|
| **1. Keputusan Bisnis** | Mengubahnya mengubah behavior / UX / model transaksi → **butuh persetujuan Kapten** dulu. |
| **2. Catatan Keamanan & Integritas** | Menyangkut integritas data dan uang. Jangan dilonggarkan tanpa review khusus. |
| **3. Known Limitations** | Edge case yang **sengaja** belum ditambal. Tiap poin menyebut kondisi kapan perlu direvisit. Bukan bug yang tak disadari. |

---

## 1. Keputusan Bisnis

### 1.1 Stok tidak dikurangi saat order dibuat — hanya divalidasi

Saat `POST /api/orders`, stok tiap varian hanya **dicek cukup/tidak**; angka
`product_variants.stock` tidak diturunkan. Pengurangan stok yang sebenarnya
terjadi nanti saat **webhook `settlement`** masuk (fase berikutnya).

Trade-off yang diterima: kalau dua pembeli meng-checkout stok terakhir yang sama
secara bersamaan, keduanya bisa lolos validasi dan sama-sama dibuatkan order +
Snap token. Untuk sekarang risiko ini diterima karena volume transaksi masih
kecil. Revisit kalau volume order naik (butuh reservasi stok / pengurangan
optimistik saat order dibuat, lalu dikembalikan saat `expire`/`cancel`).

### 1.2 Tidak ada UI pemilihan metode pembayaran — langsung Snap popup

Alur pembayaran disederhanakan: begitu order dibuat, frontend langsung membuka
**Snap popup Midtrans** yang menampilkan semua metode aktif (Virtual Account,
e-wallet, QRIS, kartu) dalam satu popup. Tidak ada halaman/komponen custom untuk
memilih metode sebelum bayar.

Catatan: ini menggantikan simulasi frontend di Milestone 6 yang menampilkan
radio-card VA / E-Wallet / QRIS / Kartu buatan sendiri. Simulasi itu bukan acuan
alur produksi.

### 1.3 `shipping_cost` di-hardcode `0` (sementara)

`OrderController` menetapkan `shipping_cost = 0` dan `total = subtotal`. Biteship
(API ongkir) belum terintegrasi, konsisten dengan catatan yang sudah ada di
`apps/web/src/app/(main)/checkout/page.tsx`.

**Wajib diganti** begitu Biteship terintegrasi — ongkir nyata harus masuk ke
`total`, dan (kalau dipakai) ditambahkan sebagai baris tersendiri di
`item_details` Midtrans supaya `sum(item_details) == gross_amount` tetap terjaga.
Ada `TODO(biteship)` di kode pada titik ini.

### 1.4 Guest checkout only

Belum ada login / registrasi / Laravel Sanctum untuk pembeli. `POST /api/orders`
publik tanpa auth; `orders.user_id` selalu `null`; identitas pembeli diambil dari
`guest_name` / `guest_email` / `phone` di body request. `phone` disimpan di dalam
JSON `orders.shipping_address` karena tabel `orders` tidak punya kolom phone
terpisah.

`docs/SOT.md` §5.1 menyebut akun pembeli + Sanctum sebagai cakupan; itu belum
dikerjakan. Guest-only adalah **keadaan sekarang**, bukan keputusan permanen
menolak fitur akun.

### 1.5 Webhook diproses sinkron di controller (tanpa queue)

`MidtransWebhookController::handle()` menjalankan semua efek (refetch status,
update payment, potong stok, update order) langsung dalam request webhook, bukan
lewat job/queue. Alasan: project ini belum punya worker queue yang jalan di
production (`docker-compose.prod.yml` tidak punya service worker). Kalau
pemrosesan gagal karena hal tak terduga, controller membalas HTTP 500 dan
Midtrans akan retry notifikasi.
**Revisit:** kalau worker queue sudah ada — pindahkan pemrosesan ke job supaya
respons ke Midtrans lebih cepat dan retry jadi tanggung jawab queue.

### 1.6 Stok dipotong SEKALI, saat transisi pertama payment ke "paid"

Stok `product_variants.stock` diturunkan hanya pada saat payment **pertama kali**
berpindah ke status "paid" — yaitu `settlement`, atau `capture` dengan
`fraud_status` = `accept`. `capture` + `challenge` **tidak** dianggap paid (butuh
review manual). Notifikasi ulang untuk status paid yang sama tidak memotong stok
lagi (lihat §2.8). Tidak ada titik lain di sistem yang menyentuh stok saat ini
(pembuatan order tidak, lihat §1.1).
**Revisit:** kalau nanti ada pembatalan/refund otomatis, perlu jalur pengembalian
stok yang juga idempotent.

### 1.7 `refund` / `partial_refund` hanya dicatat statusnya

Saat webhook membawa status resmi `refund` atau `partial_refund`, sistem hanya
menyimpan status itu ke `payments` (plus audit trail). **Tidak ada** logika
otomatis untuk mengembalikan stok, mengembalikan uang, atau mengubah status
order — `mapToOrderStatus()` mengembalikan `null` untuk kedua status ini. Semua
tindak lanjut refund dikerjakan manual oleh admin di fase ini.
**Revisit:** lihat known limitation §3.9.

---

## 2. Catatan Keamanan & Integritas

### 2.1 Harga & nama produk selalu diambil ulang dari database

`OrderController` mengabaikan harga/nama apa pun yang dikirim client. Untuk tiap
`items.*.product_variant_id`, varian + produknya di-fetch dari DB, lalu harga
satuan dihitung `price_override ?? base_price` dan nama diambil dari
`products.name`. `StoreOrderRequest` sengaja tidak punya field harga sama sekali,
dan `->validated()` membuang field ekstra yang mungkin diselundupkan di body.

### 2.2 `gross_amount` divalidasi cocok dengan `item_details` sebelum menyentuh Midtrans

Setelah `item_details` dibangun (harga per baris dibulatkan ke rupiah bulat),
`OrderController` menghitung `sum(price * quantity)` dan membandingkannya persis
dengan `gross_amount` (`(int) round(total)`). Kalau tidak sama — misalnya karena
suatu `price_override` punya pecahan sen — request **tidak dikirim ke Midtrans**;
sebagai gantinya `InvalidOrderTotalException` (HTTP 422, pesan
"Rincian item tidak konsisten dengan total order.") dilempar dan mismatch-nya
di-`report()` ke log. Tujuannya: errornya jelas datang dari sisi kita, bukan
pesan asing dari Midtrans.

### 2.3 Guard `total > 0`

`OrderController` menolak order dengan `total <= 0` (mis. `base_price` 0 karena
salah input admin) lewat `InvalidOrderTotalException` (HTTP 422,
"Total order harus lebih dari 0.") sebelum memanggil Midtrans.

### 2.4 Item duplikat diagregasi sebelum validasi stok

Sebelum stok dicek, baris `items` yang menunjuk `product_variant_id` sama
digabung dan `quantity`-nya dijumlahkan. Tanpa ini, client bisa memecah satu
varian jadi beberapa baris (`qty 3` + `qty 3`) dan lolos validasi stok yang
membandingkan per baris (masing-masing `3 <= 5`) padahal permintaan sebenarnya
`6`. Agregasi juga membuat `order_items` tidak punya baris kembar untuk varian
yang sama.

### 2.5 Signature webhook Midtrans diverifikasi SEBELUM apa pun diproses

`MidtransWebhookController::handle()` langkah pertama menghitung
`hash('sha512', order_id . status_code . gross_amount . server_key)` dan
membandingkannya dengan `signature_key` dari payload pakai `hash_equals()`
(constant-time). Kalau tidak cocok: `Log::warning` dengan `order_id`, IP, dan
payload mentah (potensi spoofing), lalu **balas HTTP 200 tanpa memproses apa
pun** dan tanpa membocorkan alasan gagalnya. Tidak ada satu baris pun status
payment/order/stok yang disentuh sebelum signature lolos. Server key dibaca dari
`config('services.midtrans.server_key')` — sumber yang sama dengan
`MidtransService`.

### 2.6 Status resmi selalu di-refetch dari Midtrans, bukan dari body notification

Setelah signature lolos, controller **mengabaikan** `transaction_status` /
`fraud_status` di body notification dan memanggil
`MidtransService::getTransactionStatus($orderId)` (wrap `Transaction::status()`)
untuk mengambil status resmi terkini. Ini rekomendasi resmi Midtrans dan
membuat handler tahan terhadap notifikasi yang di-retry, telat, atau datang
tidak berurutan. Yang disimpan ke `payments.raw_response` adalah **full response
refetch itu**, bukan body notification. Kalau refetch gagal (Midtrans API
down/error), controller `Log::error` lalu balas HTTP 200 — Midtrans akan retry
notifikasi berikutnya.

### 2.7 Idempotency lewat `lockForUpdate` + cek status final

Pemrosesan status dibungkus `DB::transaction()` dengan `lockForUpdate()` pada row
`Payment` (dan pada tiap `ProductVariant` saat memotong stok). Ini menyerialkan
dua notifikasi retry yang masuk hampir bersamaan untuk order yang sama. Di dalam
lock: kalau `payment.status` **sudah sama** dengan status baru **dan** payment
sudah pernah "paid", efek samping (potong stok, ubah status order) dilewati —
hanya audit trail (`transaction_status`, `fraud_status`, `raw_response`) yang
disegarkan. Potong stok hanya terjadi pada `! wasPaid && willBePaid` (transisi
PERTAMA ke paid), sehingga stok tidak mungkin terpotong dua kali dari webhook.

### 2.8 Status transaksi tak dikenal → gagal keras, bukan diam-diam

`MidtransStatusTranslator::mapToPaymentStatus()` melempar
`UnknownMidtransStatusException` kalau `transaction_status` / `fraud_status` di
luar daftar yang di-handle (mis. Midtrans menambah status baru). Tidak ada
fallback diam-diam ke status mana pun. Controller menangkapnya, `Log::error`
lengkap, dan balas HTTP 200 (retry tidak menolong sampai mapping diperbaiki).

### 2.9 Cross-check `gross_amount` — early-warning, bukan gerbang

Di dalam transaksi webhook, setelah `Payment` di-lock, `gross_amount` dari
response resmi Midtrans (`(int) round((float) $official['gross_amount'])`)
dibandingkan dengan `payments.gross_amount` yang tersimpan. Kalau berbeda:
`Log::warning` dengan `order_id`, `gross_amount_kita`, dan
`gross_amount_midtrans` — sinyal kalau ada `order_id` yang keliru dipakai ulang
atau anomali lain yang perlu investigasi manual.

Ini **sengaja bukan validasi yang menggagalkan proses** dan bukan exception:
signature (§2.5) + refetch status resmi (§2.6) sudah jadi lapisan kepercayaan
utama, jadi cross-check ini hanya jaring pengaman murah. Webhook tetap diproses
seperti biasa apa pun hasil perbandingannya.

---

## 3. Known Limitations (sengaja belum ditambal)

### 3.1 Tabrakan `order_number`

Format `VE-{8 digit terakhir epoch-ms}-{4 digit acak}`. `orders.order_number`
unik, dan `payments.midtrans_order_id` de-facto unik (dipakai sebagai `order_id`
ke Midtrans). Kalau tabrakan terjadi, `Order::create` melempar `QueryException`
→ HTTP 500, transaksi rollback, **tanpa retry**. Probabilitas kecil pada volume
sekarang.
**Revisit:** kalau volume order naik signifikan — ganti ke generator dengan
jaminan keunikan (mis. sequence DB, atau retry-on-collision).

### 3.2 Idempotency / double-submit — **prioritas tinggi fase berikutnya**

Klik ganda tombol bayar atau retry jaringan dari client bisa membuat **dua order
+ dua Snap token terpisah** untuk maksud beli yang sama. Belum ada dedupe key
atau lock.
**Revisit:** sebelum traffic production riil jalan. Ini **bukan** limitation yang
boleh dilupakan selamanya — masuk backlog fase berikutnya bersama webhook
handler. Kandidat solusi: idempotency key dari client, atau nolak order baru
selama masih ada payment `pending` untuk `guest_email` + isi cart yang sama.

### 3.3 Transaksi "nyangkut" di Midtrans

Kalau Snap token berhasil didapat tapi `payment->update(['snap_token' => ...])`
gagal (mis. koneksi DB putus tepat setelah call Midtrans), seluruh order
ter-rollback — tapi transaksi itu **sudah tercatat di dashboard Midtrans** dengan
`order_id` tsb dan tanpa padanan lokal. Karena `order_id` Midtrans tidak bisa
dipakai ulang, retry butuh `order_number` baru; sisa transaksi lama menggantung.
**Revisit:** perlu proses rekonsiliasi manual berkala (bandingkan transaksi
Midtrans vs tabel `payments`), atau job otomatis di masa depan.

### 3.4 `quantity` tanpa batas atas eksplisit

Validasi hanya `integer, min:1`. Tidak ada `max`. Efektifnya dibatasi oleh stok
yang tersedia (varian berstok 5 tidak bisa dipesan 1.000.000). Belum ada batas
kewajaran per order maupun proteksi terhadap `gross_amount` yang melebihi batas
maksimum Midtrans.
**Revisit:** kalau muncul kebutuhan batas kuantitas bisnis, atau saat hardening
pra-production.

### 3.5 Nama item dipotong ke 50 karakter

`item_details[].name` dipotong `mb_substr(..., 0, 50)` demi limit Midtrans.
Murni kosmetik pada invoice/riwayat di sisi Midtrans — **tidak** memengaruhi
nominal, `order_items` lokal menyimpan `product_name` penuh.
**Revisit:** hanya kalau tampilan nama di dashboard / invoice Midtrans jadi
masalah nyata.

### 3.6 `customer_details.first_name` menampung nama lengkap

`guest_name` dikirim utuh ke `first_name`; tidak dipecah `first_name` /
`last_name`. Kosmetik, tidak memengaruhi fungsi pembayaran.
**Revisit:** kalau butuh format nama rapi di invoice Midtrans.

### 3.7 Belum ada rate limiting di `POST /api/orders`

Route publik tanpa middleware `throttle` (konsisten dengan route publik lain saat
ini). `docs/SOT.md` §5.8 menyebut rate limiting API publik sebagai kebutuhan.
Setiap request yang lolos validasi memicu satu panggilan ke Midtrans. Catatan:
`POST /api/midtrans/notification` juga tanpa throttle — memanggil
`Transaction::status()` per hit; signature check menahan pemrosesan tapi bukan
jumlah request.
**Revisit:** bersama hardening pra-production / saat webhook handler dikerjakan.

### 3.8 Oversell: stok di-clamp ke 0, deficit hanya di log

Kalau dua pembeli meng-checkout stok terakhir yang sama dan dua-duanya bayar
(race yang sudah diterima di §1.1), transisi-ke-paid kedua akan mencoba memotong
stok lebih dari yang tersedia. `decrementStock()` menghitung nilai final
`max(0, stock_sebelum - quantity)` dan menyimpannya langsung (`$variant->stock =
$newStock; save()`, bukan `decrement()`), jadi `stock` **di-clamp ke 0** dan
kolom `product_variants.stock` tetap `unsignedInteger` — tidak perlu migration.
Webhook **sengaja tidak digagalkan** (uang sudah masuk, tidak bisa dibatalkan
sepihak).

Konsekuensi yang diterima: begitu di-clamp ke 0, angka stok tidak lagi
membedakan **"pas habis"** dari **"oversell"**. Deficit sebenarnya (`quantity`
diminta vs `stock_before`) **hanya tercatat di `Log::warning`** — bukan di kolom
`stock` — bersama `order_id`, `order_number`, `product_variant_id`, `sku`,
`stock_before`, `quantity_requested`, dan `deficit`. Tidak ada notifikasi/aksi
otomatis; admin harus **memeriksa log** kalau curiga ada oversell, lalu restock /
menghubungi pembeli manual.
**Revisit:** kalau oversell cukup sering hingga butuh jejak terstruktur (mis.
tabel `stock_adjustments` / kolom deficit), atau kalau §1.1 (reservasi stok saat
order dibuat) jadi dikerjakan sehingga oversell tidak lagi mungkin.

### 3.9 `refund` / `partial_refund` tidak mengubah status order otomatis

Webhook mencatat status `refund` / `partial_refund` di `payments` tapi **tidak**
mengembalikan stok, tidak menyentuh `orders.status`, dan tidak memicu
pengembalian dana (lihat §1.7). Untuk sekarang seluruh proses refund —
menyetujui di dashboard Midtrans, mengembalikan stok, mengubah status order,
memberi tahu pembeli — dikerjakan **manual oleh admin**.
**Revisit:** kalau frekuensi refund cukup tinggi untuk butuh otomasi. Perlu
desain jalur pengembalian stok yang idempotent (kebalikan dari §1.6) dan
kebijakan status order untuk refund penuh vs sebagian.

---

## Referensi kode

| Hal | Lokasi |
|---|---|
| Endpoint & orkestrasi transaksi | `apps/api/app/Http/Controllers/OrderController.php` |
| Validasi request | `apps/api/app/Http/Requests/StoreOrderRequest.php` |
| Wrapper Midtrans (config + Snap token + refetch status) | `apps/api/app/Services/MidtransService.php` |
| Webhook handler (signature, refetch, idempotency, potong stok) | `apps/api/app/Http/Controllers/MidtransWebhookController.php` |
| Terjemahan status Midtrans → enum domain | `apps/api/app/Services/MidtransStatusTranslator.php` |
| Exception → 422 (stok / produk non-aktif) | `apps/api/app/Exceptions/InsufficientStockException.php` |
| Exception → 422 (nominal tidak valid) | `apps/api/app/Exceptions/InvalidOrderTotalException.php` |
| Exception → 502 (gateway gagal, rollback) | `apps/api/app/Exceptions/PaymentGatewayException.php` |
| Exception (status Midtrans tak dikenal, webhook) | `apps/api/app/Exceptions/UnknownMidtransStatusException.php` |
| Route | `apps/api/routes/api.php` (`POST /orders`, `POST /midtrans/notification`) |
| Kredensial | `apps/api/config/services.php` (`midtrans`), `apps/api/.env.example` |
| Kolom Midtrans di `payments` | `apps/api/database/migrations/2026_08_28_000000_add_midtrans_fields_to_payments_table.php` |

---

## Alasan struktur dokumen ini

`docs/MILESTONES.md` adalah log progres **per milestone** (append-only, "apa yang
dikerjakan kapan") dan `docs/SOT.md` adalah spec **tingkat tinggi** (model bisnis,
tech stack, cakupan fitur). Keputusan implementasi granular seperti "kenapa stok
tidak dikurangi di sini" atau "known limitation X, revisit kalau Y" tidak cocok
di keduanya: akan tenggelam di changelog, dan terlalu detail untuk SOT.

Karena itu dibuat `docs/decisions/` sebagai tempat catatan keputusan berumur
panjang. Ketiga kategori yang diminta (bisnis / keamanan / known limitations)
digabung dalam **satu file per area integrasi** (`payments-midtrans.md`) dengan
tiga section bertanda governance masing-masing — bukan tiga file terpisah —
supaya ada satu titik masuk untuk "semua soal keputusan integrasi Midtrans" dan
tidak ada tiga berkas kecil yang gampang lepas sinkron. Pola ini mengikuti
kecenderungan project yang memakai sedikit dokumen substansial ketimbang banyak
berkas mikro. Integrasi berikutnya (mis. Biteship) bisa memakai file sendiri
`docs/decisions/shipping-biteship.md` dengan pola yang sama.
