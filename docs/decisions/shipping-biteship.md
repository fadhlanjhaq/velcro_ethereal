# Keputusan Integrasi Pengiriman — Biteship

**Status:** **Langkah A, B, dan C selesai di kode.** A dan B sudah
diverifikasi manual; C belum.

- **A** — fondasi backend: `products.weight_grams`, config `services.biteship`,
  `ShippingProvider` + implementasi Biteship, `GET /api/shipping/areas`,
  `POST /api/shipping/rates`.
- **B** — `/checkout` memakai autocomplete area + tarif kurir asli; allowlist
  layanan (§1.5); trusted proxies opt-in, **mati secara default** (§2.2).
- **C** — `POST /api/orders` menghitung ulang ongkir di backend lewat jalur yang
  sama dengan endpoint rates, menolak order kalau angka yang dilihat pembeli
  berubah (§1.7), dan memasukkan ongkir (+ biaya layanan opsional) ke `total`,
  `gross_amount`, dan `item_details` Midtrans (§3 C). Butuh dua migrasi baru.
- **Perbaikan setelah C** (selesai di kode, belum diverifikasi) — markup ongkir
  `SHIPPING_MARKUP` sebagai penutup biaya Rates API (§1.6), tarif asli kurir
  disimpan terpisah (`shipments.provider_cost`), dan ringkasan checkout memakai
  harga produk dari backend sehingga `total_changed` tidak lagi "buntu" (§1.8).
  Butuh satu migrasi baru.

> ⚠ **B dan C dirilis bersamaan** (B tanpa C menampilkan ongkir yang tidak
> ditagih). Lihat **Checklist Pra-Deploy**.
>
> ⚠ **Tanpa Langkah D, booking kurir MANUAL.** Setelah B + C live, order yang
> sudah dibayar menyimpan kurir/layanan pilihan pembeli di tabel `shipments`
> (status `pending`, tanpa resi), tapi **tidak ada** yang mem-booking kurir ke
> Biteship. Admin harus membuat order pengiriman sendiri lewat dashboard
> Biteship (kurir & layanan sesuai data shipment di admin Filament) dan
> mengisi resi manual, sampai Langkah D dikerjakan.

Belum dikerjakan: Langkah **D** (booking kurir otomatis), **E**. Dokumen ini
tidak mencatat key atau isi `.env`.

**Sifat & cara membaca:** sama dengan `payments-midtrans.md` — catatan keputusan
granular, bukan changelog (`docs/MILESTONES.md`) dan bukan spec (`docs/SOT.md`).

| Bagian | Kalau mau diubah |
|---|---|
| **1. Keputusan Bisnis** | Mengubah behavior / UX / biaya → **butuh persetujuan Kapten** dulu. |
| **2. Catatan Keamanan & Integritas** | Menyangkut uang (ongkir & biaya API). Jangan dilonggarkan tanpa review khusus. |
| **3. Rencana Langkah B–E** | Arah yang sudah disepakati; detail bisa berubah saat dikerjakan. |
| **4. Known Limitations** | Edge case yang **sengaja** belum ditambal, dengan kondisi revisit. |

---

## 1. Keputusan Bisnis

### 1.1 Abstraksi provider tipis, satu implementasi

`App\Services\Shipping\ShippingProvider` hanya punya dua method —
`searchAreas(string $query)` dan `getRates(string $destinationAreaId, array
$items)` — dengan satu implementasi, `BiteshipShippingProvider`, di-bind di
`AppServiceProvider`. Hasilnya selalu DTO readonly (`ShippingArea`,
`ShippingRate`), dan endpoint publik hanya mengirim bentuk ternormalisasi itu.

Alasan dibuat **tipis**: tujuannya bukan "siap ganti vendor", tapi (a) frontend
dan checkout tidak pernah bergantung pada bentuk mentah response Biteship, dan
(b) satu titik untuk auth, timeout, logging, dan normalisasi error. Method yang
belum dipakai (`createShipment`, webhook tracking) **tidak** dibuat sekarang —
ditambahkan di Langkah D saat bentuk kebutuhannya jelas.

### 1.2 Berat per produk, nullable, ditolak kalau kosong

Kolom `products.weight_grams` (`unsignedInteger`, nullable, tanpa default).
Berat per **produk**, bukan per varian: ukuran pakaian tidak mengubah berat
kirim secara berarti, dan admin cukup mengisi satu angka.

- **Nullable tanpa default** karena produk yang sudah live belum punya berat.
  Default (0 / 500 g) akan diam-diam menghasilkan ongkir yang salah.
- Di Filament, field "Berat (gram)" **wajib** (integer, min 1) — produk baru atau
  yang diedit pasti terisi. Admin diminta mengisi berat produk + kemasan.
- Tabel produk di admin menampilkan **"Belum diisi"** untuk berat null.
- Guard di cek ongkir **dan** saat order dibuat (Langkah C, jalur yang sama):
  `ShippingItemsBuilder` menolak dengan 422 **"Berat produk {nama} belum
  diatur."** Tidak ada tebakan.

**Tindakan wajib sebelum Langkah B live:** isi berat semua produk aktif lewat
admin.

### 1.3 Kurir: `jne`, `jnt`, `sicepat` — tanpa kurir instan

Kurir yang diminta ke Biteship berasal dari `BITESHIP_COURIERS` (default
`jne,jnt,sicepat`). Paket **Starter** Biteship membatasi **maksimal 3 kurir
aktif**, jadi jangan menambah kode tanpa naik paket. Kurir instan (Gojek, Grab,
dsb.) **tidak** dipakai: butuh koordinat origin/destination dan alur pickup yang
berbeda, di luar kebutuhan toko sekarang.

Harga yang dipakai adalah `price` dari Biteship (harga final setelah
diskon/surcharge custom rate, asuransi, COD), dibulatkan ke rupiah bulat.

### 1.4 Setiap request API Biteship berbayar → throttle & cache wajib

Biteship menagih per panggilan API. Endpoint ongkir publik (guest checkout,
tanpa auth), jadi tanpa pembatasan siapa pun bisa menghabiskan saldo. Karena itu
**dua lapis wajib** (lihat §2.2, §2.3): throttle per IP dan cache hasil sukses.

### 1.5 Allowlist LAYANAN, bukan kurir

Satu kurir punya layanan yang tidak cocok untuk pakaian — di sandbox muncul
**JNE Trucking** (`jne:jtr`, minimum 10 kg). Karena itu filternya per layanan:
`BITESHIP_ALLOWED_SERVICES`, format `kurir:layanan` dipisah koma (lowercase,
di-trim). Default: `jne:reg,jne:yes,jnt:ez,sicepat:reg,sicepat:best`.

- env **tidak di-set** → default di atas;
- env di-set **string kosong** (`BITESHIP_ALLOWED_SERVICES=`) → **tidak memfilter**,
  semua layanan ditampilkan (berguna untuk melihat kode layanan yang tersedia).

Filter ada di `ShippingServiceAllowlist` (kelas kecil terpisah), dipanggil
`ShippingQuoteService` **sebelum** hasil disimpan ke cache, dan daftar allowlist
ikut membentuk cache key tarif — perubahan env langsung berlaku tanpa menunggu
TTL. Bukan di provider karena ini kebijakan toko, bukan detail API Biteship.
Di Langkah C, `POST /api/orders` mengecek ulang layanan pilihan pembeli ke
allowlist yang sama (`ShippingQuoteService::find()`); di luar allowlist →
`shipping_unavailable`.

### 1.6 Biaya cek ongkir — markup ongkir `SHIPPING_MARKUP` (diputuskan Kapten)

Setiap panggilan Rates API memotong saldo Biteship (termasuk di sandbox), dan
biaya itu muncul per pembeli yang **melihat** ongkir — bukan hanya yang jadi
membeli. Opsi yang dipertimbangkan:

| Opsi | Cara | Status |
|---|---|---|
| **A — markup ongkir** | env `SHIPPING_MARKUP` (rupiah flat per order) ditambahkan ke tarif kurir. Ongkir yang tampil = yang ditagih = tarif asli + markup. | **Dipilih Kapten.** Rencana `500` di production. |
| B — `SERVICE_FEE` | Baris "Biaya layanan" terpisah di checkout + `item_details` Midtrans. | Tetap ada di kode, **tidak dipakai** (`0`). |
| C — diserap ke harga produk | Tidak ada perubahan. | Perilaku kalau kedua env `0`. |

**Kenapa bukan custom rates Biteship:** dokumentasinya hanya untuk plugin
Shopify, fiturnya **mengganti** tarif kurir dengan tarif tetap (bukan menambah
markup di atas tarif asli), dan paket Starter hanya mengizinkan 1 aturan.

**Di mana markup diterapkan:** `ShippingQuoteService::quote()`, **setelah**
tarif dibaca dari cache (`ShippingRate::withMarkup()`). Cache tetap menyimpan
tarif **asli** Biteship, jadi perubahan `SHIPPING_MARKUP` langsung berlaku tanpa
menunggu TTL. Karena endpoint rates dan `POST /api/orders` sama-sama lewat
`quote()`, cek `shipping_cost_changed` tetap membandingkan angka yang sama.

**`cost` vs `provider_cost`:** `ShippingRate::$cost` = ongkir yang ditagih
(tarif asli + markup) → `orders.shipping_cost`, `shipments.cost`, baris
`SHIPPING` di Midtrans. `ShippingRate::$providerCost` = tarif asli Biteship →
`shipments.provider_cost` (kolom baru, nullable), **tidak** dikirim ke
frontend, tampil di admin sebagai "Tarif kurir (asli)". Booking di Langkah D
membayar Biteship sebesar `provider_cost`; selisihnya margin toko.

### 1.7 Ongkir dihitung ulang di backend; order DITOLAK kalau angkanya berubah

`POST /api/orders` tidak menerima nominal ongkir sebagai sumber tagihan. Ia
menerima area + layanan pilihan + angka yang **dilihat** pembeli
(`expected_shipping_cost`, `expected_total`), lalu menghitung ulang sendiri lewat
`ShippingQuoteService` — jalur yang sama persis dengan `POST /api/shipping/rates`
(item dari DB, cache key, allowlist, urutan).

Keputusan bisnis: **pembeli tidak boleh ditagih angka yang berbeda dari yang
dilihatnya.** Kalau berbeda, order ditolak 422 (tidak disesuaikan diam-diam),
dengan `code` untuk frontend:

| `code` | Kapan | Body tambahan |
|---|---|---|
| `shipping_unavailable` | Layanan `courier_code` + `service_code` tidak ada di hasil quote, atau di luar allowlist. | — |
| `shipping_cost_changed` | `cost` hasil hitung ulang ≠ `expected_shipping_cost`. | `shipping_cost` (baru) |
| `total_changed` | `gross_amount` (subtotal DB + ongkir + biaya layanan, dibulatkan) ≠ `expected_total`. | `total` (baru) |

Frontend menampilkan pesannya, memuat ulang tarif (melewati state lama), dan
pembeli submit lagi dengan **idempotency key yang sama** — aman karena order
yang ditolak tidak pernah tersimpan (`shipping_*` ditolak sebelum transaksi,
`total_changed` di dalam transaksi yang di-rollback).

### 1.8 Ringkasan checkout memakai harga produk dari backend

Sebelumnya ringkasan `/checkout` memakai harga yang tersimpan di cart saat item
ditambahkan (`product.base_price`, tidak pernah diperbarui). Akibatnya ada bug
**"buntu"**: kalau admin mengubah harga, order ditolak `total_changed`, tapi
layar tetap menampilkan harga lama sehingga setiap submit ditolak lagi; varian
dengan `price_override` bahkan tidak pernah bisa di-checkout. **Sudah
diperbaiki:**

- `POST /api/shipping/rates` mengirim `meta.items` (`product_variant_id`,
  `unit_price`, `quantity`, `line_total`) dan `meta.subtotal` — harga efektif
  (`price_override ?? base_price`) yang dibaca dari DB **setiap request**
  (bukan dari cache tarif).
- Rumus harga ada di satu tempat, `App\Services\CheckoutPricing`, dipakai
  `OrderController` (snapshot + `gross_amount`), `ShippingItemsBuilder` /
  `ShippingQuoteService` (meta), dan `ProductVariantResource`. Subtotal
  dijumlahkan dalam **sen bulat** lalu dibulatkan ke rupiah, jadi tidak
  bergantung pada urutan baris; `gross_amount = round(subtotal) + ongkir +
  service_fee` = `meta.subtotal + ongkir + service_fee` di frontend.
- `/checkout` menampilkan harga per item, subtotal, dan Total Tagihan dari
  angka backend begitu tarif termuat, mengirim `expected_total =
  meta.subtotal + ongkir + service_fee`, dan menyinkronkan harga cart
  (`CartContext.syncPrices`) supaya `/cart` juga ikut segar. Setelah penolakan
  apa pun, muat ulang tarif sekaligus menyegarkan harga — satu klik bayar lagi
  cukup.
- `ProductVariantResource` mengekspos `price` (harga efektif, string decimal
  seperti `base_price`); cart menyimpan harga varian, bukan `base_price`
  produk.

---

## 2. Catatan Keamanan & Integritas

### 2.1 Harga & berat diambil dari DB, bukan client

`POST /api/shipping/rates` hanya menerima `destination_area_id` dan `items
[{product_variant_id, quantity}]` (aturan `items` sama persis dengan
`StoreOrderRequest`). `ShippingItemsBuilder`:

1. mengagregasi `quantity` per varian (pola `OrderController`, lihat
   `payments-midtrans.md` §2.4), lalu mengurutkan per ID varian;
2. mengambil varian + produk dari DB;
3. menolak produk nonaktif dan produk tanpa berat (422,
   `InvalidShippingItemException`, pola `InsufficientStockException`);
4. menghasilkan `{name, value, weight, quantity}` — `value` = harga satuan
   `price_override ?? base_price` dibulatkan, `weight` = `weight_grams`.

Builder ini dipanggil dari `ShippingQuoteService`, yang dipakai baik oleh
endpoint rates maupun `POST /api/orders` — item yang dihitung saat order dibuat
**identik** dengan saat pembeli melihat tarif.

### 2.2 Rate limit per IP

Named limiter di `AppServiceProvider`, dipasang via `throttle:` di
`routes/api.php`:

| Limiter | Batas | Endpoint |
|---|---|---|
| `shipping-areas` | 30 / menit / IP | `GET /api/shipping/areas` |
| `shipping-rates` | 20 / menit / IP | `POST /api/shipping/rates` |

Grup `api` di `bootstrap/app.php` tidak memasang throttle default, jadi limiter
ini satu-satunya pembatas.

**Trusted proxies — opt-in lewat `TRUSTED_PROXIES`, MATI secara default.**

Di production alurnya browser → nginx host VPS (TLS) → nginx container →
php-fpm. Selama trusted proxies mati, `$request->ip()` = IP nginx container,
jadi throttle berlaku untuk **seluruh toko sekaligus** — terlalu ketat (satu
pembeli yang rajin bisa membuat pembeli lain kena 429), tapi **tidak bisa
diakali**.

**Risiko kalau diaktifkan sembarangan:** begitu proxy dipercaya, Laravel
mengambil IP klien dari header `X-Forwarded-For`. Nginx (host maupun
container) **meneruskan header itu apa adanya** kalau tidak disetel ulang, dan
lokasi `@laravel` di nginx container memang tidak menyetelnya. Jadi kalau
nginx host VPS tidak menyetel `X-Forwarded-For`, klien cukup mengirim header
palsu (mis. IP acak per request) untuk lolos throttle dan menghabiskan saldo
Biteship. Kondisi tanpa header itu **tidak aman**. Konfigurasi host nginx tidak
ada di repo dan belum diketahui, karena itu default-nya mati.

Keputusan (perbaikan setelah Langkah B, yang semula langsung mempercayai
rentang privat):

- Daftar proxy diambil dari env `TRUSTED_PROXIES` (IP/CIDR dipisah koma) lewat
  `config/trustedproxy.php`. Kosong / tidak di-set → array kosong → tidak ada
  proxy dipercaya, perilaku persis seperti sebelum Langkah B. Config sengaja
  selalu array, bukan `null`: untuk `null`, Laravel otomatis memakai `'*'` di
  host Laravel Cloud / Forge / Vapor.
- Nilai "percayai semua" (`*`, `**`, `REMOTE_ADDR`, `0.0.0.0/0`, `::/0`)
  ditolak, diabaikan, dan di-log sebagai warning (callback `booted` di
  `bootstrap/app.php`).
- Header yang dipercaya hanya `X-Forwarded-For` (`trustProxies(headers: ...)`
  di `bootstrap/app.php`). Host/Port/Proto sengaja tidak dipercaya: HTTPS sudah
  lewat `fastcgi_param HTTPS on`, dan mempercayai Host bisa mengubah URL yang
  di-generate.
- Mekanisme (Laravel 13.18): middleware global `TrustProxies` membaca
  `config('trustedproxy.proxies')` pada **setiap request**. `bootstrap/app.php`
  sengaja **tidak** memakai `trustProxies(at: ...)`, karena callback
  `withMiddleware` dijalankan saat HTTP kernel dibentuk — sebelum config dimuat
  — dan `env()` di luar file config bernilai `null` setelah `config:cache`.

**Cara mengaktifkan** (pemegang VPS):

1. Pastikan server block nginx host VPS yang mem-proxy ke `127.0.0.1:8080`
   punya `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` dan
   `proxy_set_header X-Real-IP $remote_addr;`, lalu reload nginx.
2. Isi `TRUSTED_PROXIES=172.16.0.0/12` (rentang jaringan Docker; cek dengan
   `docker network inspect` kalau subnet-nya berbeda) di `.env` production.
3. `php artisan config:cache` (atau `config:clear`) di container `api`.

Aman karena port 8080 hanya di-bind ke `127.0.0.1` (`docker-compose.yml`):
koneksi yang datang dari rentang Docker hanya mungkin lewat nginx container,
dan `$proxy_add_x_forwarded_for` menaruh IP asli klien di ujung kanan header,
yang dibaca Laravel (entri dari kanan yang bukan proxy tepercaya).

### 2.3 Cache hasil sukses

Store cache bawaan config (tidak di-hardcode redis). Yang disimpan hanya hasil
**sukses** sebagai array siap-JSON; exception tidak pernah ter-cache. Cache tarif
ada di `ShippingQuoteService` (satu tempat untuk endpoint rates dan
`POST /api/orders`); cache area di `ShippingController`.

| Endpoint | TTL | Key |
|---|---|---|
| areas | 24 jam | `shipping:areas:` + sha1(q lowercase, trim, spasi dirapatkan) |
| rates | 10 menit | `shipping:rates:` + sha256(origin area, daftar kurir, destination, items ternormalisasi **termasuk berat & harga**, allowlist layanan) |

Berat dan kurir ikut di key: kalau admin mengubah berat atau konfigurasi kurir
diubah, cache lama otomatis tidak terpakai.

### 2.4 Error provider dinormalisasi; API key tidak pernah di-log

Semua kegagalan — koneksi/timeout, HTTP non-2xx, body bukan JSON,
`success !== true`, konfigurasi kosong (API key / `BITESHIP_ORIGIN_AREA_ID` /
kurir) — jadi `ShippingProviderException`. `ShippingController` me-`report()`
lalu membalas **502**: "Gagal mengambil ongkir, coba lagi." (rates) atau "Gagal
mencari area, coba lagi." (areas). `OrderController` membalas 502 dengan pesan
ongkir yang sama, dan order tidak dibuat. Pesan teknis hanya ada di log.

Log berisi method, path, status HTTP, `code`/`error` Biteship, dan potongan body
response (maks 1000 karakter). Header request — tempat API key — tidak pernah
di-log.

---

## 3. Langkah B–E

### B. UI checkout (`apps/web`) — selesai di kode

- **Alamat** dipecah jadi tiga field: area tujuan (autocomplete ARIA combobox,
  mulai ≥ 3 karakter, debounce 400 ms, request lama dibatalkan; mengetik ulang
  menghapus pilihan + me-reset tarif), alamat detail (wajib, maks 500), dan
  catatan kurir (opsional, maks 200).
- **Kurir** dari tarif asli `POST /api/shipping/rates` (data statis
  `COURIER_OPTIONS`, termasuk Instant & Paxel, dihapus). Diambil ulang saat area
  atau isi cart (variant id + qty) berubah. Label otomatis **Termurah** dan
  **Tercepat** (batas atas estimasi hari terkecil); default = termurah, pilihan
  pembeli dipertahankan setelah refetch selama layanannya masih ada.
- **Ringkasan**: ongkir = layanan terpilih ("—" kalau belum ada); total =
  subtotal + ongkir. Tombol submit nonaktif sampai area, alamat detail, dan
  layanan terpilih dan tarif tidak sedang dimuat, dengan teks bantu alasannya.
- **Payload `POST /api/orders`** di B masih menggabungkan alamat ke `address`
  dan tidak mengirim ongkir; diganti di Langkah C (lihat di bawah).

### C. Ongkir masuk order & Midtrans — selesai di kode

**Quote bersama.** `ShippingQuoteService::quote(destinationAreaId, items)` =
`ShippingItemsBuilder` → cache → `getRates()` → allowlist → urut termurah. Satu-
satunya jalur tarif, dipakai `ShippingController::rates` dan `OrderController`.
Response `POST /api/shipping/rates` kini `{ data: [...], meta: { service_fee } }`.

**Urutan di `POST /api/orders`:**

1. Validasi `StoreOrderRequest` (422). `address` diganti `address_detail`,
   `courier_note`, `destination_area_id`, `area_label`, `postal_code`,
   `courier_code`, `service_code`, `expected_shipping_cost`, `expected_total`.
2. Idempotency-hit → replay order lama (200) / 409, **tanpa** memanggil
   Biteship (`payments-midtrans.md` §2.10).
3. Quote ongkir **sebelum** `DB::transaction` (transaksi tidak tertahan
   menunggu Biteship). Produk nonaktif / berat kosong → 422; Biteship gagal →
   502 "Gagal mengambil ongkir, coba lagi."
4. Layanan pilihan tidak ada / di luar allowlist → 422 `shipping_unavailable`.
5. `cost` ≠ `expected_shipping_cost` → 422 `shipping_cost_changed`.
6. Di dalam transaksi: stok & produk aktif (422), snapshot harga, `total =
   subtotal + shipping_cost + service_fee`, guard `total > 0`, lalu
   `gross_amount` ≠ `expected_total` → 422 `total_changed` (rollback).
7. `item_details` + guard `sum == gross_amount` (`payments-midtrans.md` §2.2),
   buat order + items + shipment + payment, Snap token (502 kalau gagal,
   rollback).

**Yang disimpan:**

- `orders`: `shipping_cost`, `service_fee` (kolom baru, default 0), `total`.
- `orders.shipping_address` (JSON): `name`, `phone`, `address` (gabungan siap
  tampil: detail + label area + "Catatan kurir: …" — kompatibel dengan tampilan
  lama), `address_detail`, `courier_note`, `area_id`, `area_label`,
  `postal_code`. `area_label`/`postal_code` hanya label; tarif ditentukan
  `area_id`.
- `shipments` (1 baris per order, transaksi yang sama, status `pending`):
  `courier` (= courier_code), `courier_name`, `service_code`, `service_name`,
  `cost` (ditagih, termasuk markup), `provider_cost` (tarif asli Biteship, §1.6),
  `etd` (kolom baru, nullable). Bahan booking otomatis di Langkah D.

**`item_details` Midtrans:** baris produk seperti sebelumnya, ditambah
`{ id: "SHIPPING", price: ongkir, quantity: 1, name: "Ongkir {kurir} {layanan}" }`
(maks 50 karakter) dan, kalau `service_fee > 0`,
`{ id: "SERVICE_FEE", price: fee, quantity: 1, name: "Biaya layanan" }`.
`payments.amount` / `gross_amount` memakai total baru.

**Admin Filament:** detail order menampilkan alamat terstruktur, data shipment
(kurir, layanan, ongkir, estimasi, status, resi), dan biaya layanan kalau > 0.

**Keterbatasan idempotency (disengaja):** replay dengan `idempotency_key` yang
sudah punya order mengembalikan order **lama** apa adanya, walaupun kurir /
alamat di request baru berbeda. Ini memang perilaku idempotency; percobaan baru
= reload `/checkout` = key baru.

### D. Booking kurir otomatis via queue worker setelah settlement

Setelah payment pertama kali berpindah ke "paid", order Biteship dibuat otomatis
(`createShipment`, ditambahkan ke `ShippingProvider` saat itu) lewat **job di
queue worker**, bukan sinkron di webhook.

**Ini merevisi `payments-midtrans.md` §1.5** (webhook sinkron tanpa queue):
webhook Midtrans tetap membalas cepat dan **hanya meng-queue job**; booking
kurir berjalan di worker dengan retry (backoff). Kalau tetap gagal setelah
retry, admin punya tombol **"Coba Lagi"** di Filament. Prasyarat: service worker
queue di `docker-compose.prod.yml`.

### E. (belum didefinisikan rinci)

Lanjutan setelah D, mis. tracking/webhook status pengiriman Biteship.

---

## 4. Known Limitations

### 4.1 Tarif yang di-cache bisa sedikit basi

Tarif di-cache 10 menit; kalau Biteship mengubah harga di jendela itu, pembeli
melihat angka lama. Perhitungan ulang saat order dibuat melewati cache yang
sama, jadi selama cache masih hidup angka yang ditampilkan dan ditagih
konsisten — selisih dengan tarif Biteship terkini (kalau ada) ditanggung toko.
Kalau cache sudah kedaluwarsa dan Biteship memberi harga lain, order ditolak
`shipping_cost_changed` dan pembeli memilih ulang (§1.7).
**Revisit:** kalau selisih ini muncul nyata saat booking kurir (Langkah D).

### 4.2 Throttle per IP, bukan per pembeli

Pembeli di belakang NAT yang sama berbagi kuota; penyerang dengan banyak IP
tetap bisa memicu cache miss. Cache mengurangi dampak query berulang, bukan
query unik.
**Revisit:** kalau tagihan API Biteship naik tidak wajar.

### 4.3 Dimensi paket tidak dikirim

Hanya berat yang dikirim ke Biteship (`length/width/height` opsional di docs).
Untuk pakaian, berat volumetrik jarang melebihi berat aktual.
**Revisit:** kalau ada produk besar/ringan (mis. kotak hadiah) yang ongkir
nyatanya meleset.

### 4.4 ~~`price_override` varian tidak diketahui frontend → `total_changed`~~ — SELESAI

Ditutup oleh §1.8: harga efektif varian kini dikirim backend (`variant.price`,
`meta.items`, `meta.subtotal`) dan ringkasan checkout memakai angka itu.

---

## Checklist Pra-Deploy

Dikerjakan oleh pemegang VPS dan dashboard Biteship (Co-Kapten tidak memegang
VPS). Semua harus tercentang sebelum Langkah B + C dirilis ke production.

- [ ] nginx host VPS memakai `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`
      dan `proxy_set_header X-Real-IP $remote_addr;`, lalu isi `TRUSTED_PROXIES`
      di `.env` production (§2.2)
- [ ] saldo Biteship production terisi + ada penanggung jawab pemantauan
      (Rates API memotong saldo, termasuk di sandbox; saldo habis = checkout
      tidak bisa menampilkan ongkir)
- [ ] key Biteship live (`biteship_live.`) + alamat origin asli (bukan dummy)
      di `.env` production
- [ ] berat semua produk aktif di production diisi lewat admin (§1.2)
- [ ] aktivasi API production di Biteship
- [ ] Langkah B dan C di-deploy bersamaan (B tidak boleh sendirian)
- [ ] migrasi Langkah C dijalankan di production saat deploy
      (`2026_10_16_000001_add_service_fee_to_orders_table`,
      `2026_10_16_000002_add_service_details_to_shipments_table`,
      `2026_10_16_000003_add_provider_cost_to_shipments_table`, plus
      `2026_10_16_000000_add_weight_grams_to_products_table` dari Langkah A)
- [ ] isi `SHIPPING_MARKUP=500` di `.env` production (keputusan Kapten, §1.6),
      lalu `config:clear` / `config:cache`
- [ ] `SERVICE_FEE` tetap `0` di production (opsi B tidak dipakai, §1.6)
- [x] ~~tidak ada varian aktif dengan `price_override` (§4.4)~~ — sudah
      ditangani (§1.8)
- [ ] ada penanggung jawab booking kurir **manual** di dashboard Biteship untuk
      setiap order yang sudah dibayar, sampai Langkah D selesai

---

## Variabel env (`apps/api/.env`)

| Variabel | Keterangan |
|---|---|
| `BITESHIP_API_KEY` | Key dari dashboard Biteship. `biteship_test.` = sandbox, `biteship_live.` = live. |
| `BITESHIP_BASE_URL` | `https://api.biteship.com` (sama untuk test & live). |
| `BITESHIP_TIMEOUT` | Timeout HTTP dalam detik (default 10). |
| `BITESHIP_COURIERS` | Kode kurir dipisah koma (default `jne,jnt,sicepat`, maks 3 di Starter). |
| `TRUSTED_PROXIES` | IP/CIDR proxy tepercaya dipisah koma. **Kosong = mati** (default). Isi (mis. `172.16.0.0/12`) hanya setelah nginx host VPS menyetel `X-Forwarded-For` (§2.2). `*` / `0.0.0.0/0` ditolak. |
| `BITESHIP_ALLOWED_SERVICES` | Allowlist `kurir:layanan` (default `jne:reg,jne:yes,jnt:ez,sicepat:reg,sicepat:best`; string kosong = tidak memfilter). |
| `BITESHIP_ORIGIN_AREA_ID` | Area ID gudang/pengirim — **wajib** untuk cek tarif. |
| `BITESHIP_ORIGIN_POSTAL_CODE` | Kode pos pengirim (disiapkan untuk Langkah D). |
| `BITESHIP_ORIGIN_CONTACT_NAME` | Nama kontak pengirim (Langkah D). |
| `BITESHIP_ORIGIN_CONTACT_PHONE` | Telepon kontak pengirim (Langkah D). |
| `BITESHIP_ORIGIN_ADDRESS` | Alamat lengkap pengirim (Langkah D). |
| `SHIPPING_MARKUP` | Markup flat per order di atas tarif kurir, rupiah bulat (default `0`). Masuk ke ongkir yang tampil & ditagih. **Keputusan Kapten: `500` di production** (§1.6). |
| `SERVICE_FEE` | Biaya layanan per order, rupiah bulat (default `0` = tidak ditampilkan & tidak ditagih). Tidak dipakai — biarkan `0` (§1.6). |

---

## Referensi kode

| Hal | Lokasi |
|---|---|
| Kontrak provider | `apps/api/app/Services/Shipping/ShippingProvider.php` |
| Implementasi Biteship | `apps/api/app/Services/Shipping/BiteshipShippingProvider.php` |
| DTO | `apps/api/app/Services/Shipping/ShippingArea.php`, `ShippingRate.php` |
| Penyusun item (dipakai ulang di C) | `apps/api/app/Services/Shipping/ShippingItemsBuilder.php` |
| Allowlist layanan (dipakai ulang di C) | `apps/api/app/Services/Shipping/ShippingServiceAllowlist.php` |
| Quote tarif bersama (cache + allowlist + urutan + markup + harga produk) | `apps/api/app/Services/Shipping/ShippingQuoteService.php`, `ShippingQuote.php` |
| Rumus harga checkout (harga efektif, subtotal) | `apps/api/app/Services/CheckoutPricing.php` |
| Kolom `shipments.provider_cost` | `apps/api/database/migrations/2026_10_16_000003_add_provider_cost_to_shipments_table.php` |
| Harga efektif varian di API produk | `apps/api/app/Http/Resources/ProductVariantResource.php` |
| Frontend: sinkron harga cart | `apps/web/src/context/CartContext.tsx` (`syncPrices`) |
| Endpoint area + rates | `apps/api/app/Http/Controllers/ShippingController.php` |
| Hitung ulang ongkir saat order dibuat | `apps/api/app/Http/Controllers/OrderController.php`, `apps/api/app/Http/Requests/StoreOrderRequest.php` |
| Exception → 422 (shipping_unavailable / shipping_cost_changed / total_changed) | `apps/api/app/Exceptions/CheckoutQuoteChangedException.php` |
| Kolom `orders.service_fee` | `apps/api/database/migrations/2026_10_16_000001_add_service_fee_to_orders_table.php` |
| Kolom layanan di `shipments` | `apps/api/database/migrations/2026_10_16_000002_add_service_details_to_shipments_table.php` |
| Admin detail order | `apps/api/app/Filament/Resources/Orders/Schemas/OrderInfolist.php` |
| Trusted proxies (opt-in) | `apps/api/config/trustedproxy.php`, `apps/api/bootstrap/app.php` |
| Frontend: klien ongkir & order | `apps/web/src/lib/api.ts` (`searchShippingAreas`, `getShippingRates`, `postOrder`, `OrderError`) |
| Frontend: area, alamat, kurir, ringkasan | `apps/web/src/app/(main)/checkout/page.tsx` |
| Validasi request tarif | `apps/api/app/Http/Requests/ShippingRatesRequest.php` |
| Exception → 422 (nonaktif / berat kosong) | `apps/api/app/Exceptions/InvalidShippingItemException.php` |
| Exception provider (→ 502 di controller) | `apps/api/app/Exceptions/ShippingProviderException.php` |
| Binding + rate limiter | `apps/api/app/Providers/AppServiceProvider.php` |
| Route | `apps/api/routes/api.php` (`GET /shipping/areas`, `POST /shipping/rates`) |
| Config | `apps/api/config/services.php` (`biteship`, `checkout`), `apps/api/.env.example` |
| Kolom berat | `apps/api/database/migrations/2026_10_16_000000_add_weight_grams_to_products_table.php` |
| Admin | `apps/api/app/Filament/Resources/Products/Schemas/ProductForm.php`, `Tables/ProductsTable.php` |
