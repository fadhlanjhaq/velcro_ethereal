# Keputusan Integrasi Pengiriman — Biteship

**Status:** **Integrasi ongkir lengkap di kode** — Langkah A, B, C (+ perbaikan
markup/harga), D1, D2, E1, dan E2. A–D2 sudah diverifikasi manual; E1 dan E2
belum.

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
- **D1** — asuransi pengiriman opsional, dipilih & dibayar pembeli, biaya dari
  Biteship tanpa markup (§1.9). Butuh dua migrasi baru.
- **D2** (selesai di kode, belum diverifikasi) — tombol **"Siap Kirim"** di
  detail order admin: booking kurir ke Biteship secara sinkron, dengan
  pengaman klik ganda, catatan gagal + "Coba Lagi", dan laporan selisih harga
  (§1.10). Butuh satu migrasi baru.
- **E1** (selesai di kode, belum diverifikasi) — halaman "Menunggu Pembayaran"
  untuk transaksi Snap yang belum dibayar (§1.11). Frontend saja.
- **E2** (selesai di kode, belum diverifikasi) — status pengiriman otomatis via
  webhook Biteship `POST /api/biteship/webhook` (§1.12). Butuh satu migrasi
  baru.
- **Pengaturan Pengiriman di admin** (selesai di kode, belum diverifikasi) —
  data gudang, kurir aktif, layanan, dan markup ongkir pindah dari `.env` ke
  halaman admin, dengan `.env` sebagai cadangan per field (§1.13). Butuh satu
  migrasi baru.

> ⚠ **B dan C dirilis bersamaan** (B tanpa C menampilkan ongkir yang tidak
> ditagih). Lihat **Checklist Pra-Deploy**.
>
> ⚠ **Booking kurir lewat tombol "Siap Kirim"** (D2), bukan otomatis: setiap
> order yang sudah dibayar menunggu admin menekan tombol itu saat paket siap.
> Filter **"Perlu dikirim"** di daftar order menampilkan antriannya. Setelah
> booking, status pengiriman diperbarui otomatis lewat webhook Biteship (E2) —
> **hanya kalau webhook sudah didaftarkan** di dashboard (lihat Checklist).

Dokumen ini tidak mencatat key atau isi `.env`.

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

Sejak D1, ongkir dasar = `price − insurance_fee` (lihat §1.9 — request kini
selalu membawa `courier_insurance`). Sebelumnya: harga yang dipakai adalah
`price` dari Biteship (harga final setelah
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
| `insurance_unavailable` | `with_insurance` = true tapi layanan terpilih tidak mendukung asuransi (D1). | — |
| `insurance_changed` | Biaya asuransi hasil hitung ulang ≠ `expected_insurance_fee` (D1). | `insurance_fee` (baru) |
| `total_changed` | `gross_amount` (subtotal DB + ongkir + biaya layanan + asuransi, dibulatkan) ≠ `expected_total`. | `total` (baru) |

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

### 1.9 Asuransi pengiriman opsional (Langkah D1)

**Keputusan:**

- **Opsional, dipilih & dibayar pembeli.** Kotak centang "Tambah asuransi
  pengiriman" di ringkasan `/checkout`, **tidak tercentang** secara default.
  Menggantikan baris lama "Asuransi Koleksi Mewah: Gratis" (tidak pernah
  benar-benar ada asuransinya).
- **Nilai pertanggungan = subtotal barang** (harga efektif × qty, rupiah bulat
  — `CheckoutPricing::insuranceValue()`, sama dengan Σ `value × quantity` item
  yang dikirim ke Biteship).
- **Biaya dari Biteship** (`insurance_fee` per layanan), bukan hitungan kita.
  **Markup ongkir tidak berlaku** untuk asuransi (`withMarkup()` hanya
  mengubah ongkir).
- **Aturan sama dengan ongkir:** berbeda dari yang dilihat pembeli → order
  ditolak (`insurance_unavailable`, `insurance_changed`, §1.7), tarif dimuat
  ulang, pembeli submit lagi dengan idempotency key yang sama.
- Teks bantu hanya: "Nilai pertanggungan Rp {subtotal}. Ketentuan klaim
  mengikuti kebijakan kurir." — **tidak** menjanjikan cakupan lain.

**Satu request Biteship.** `BiteshipShippingProvider::getRates()` selalu
mengirim `courier_insurance` = Σ (value × quantity), baik pembeli memilih
asuransi atau tidak — tarif dengan & tanpa asuransi **tidak** diminta terpisah
karena tiap request berbayar. Dari tiap `pricing` diambil
`available_for_insurance` (default false) dan `insurance_fee` (default 0).
Asuransi hanya ditawarkan kalau keduanya bernilai (tersedia **dan** biaya > 0).

**ASUMSI — `price` sudah termasuk `insurance_fee`.** Docs Biteship (rates,
Okt 2026): "`price` ... is the final price after applying the custom rate ...
and adding other fees if you have activated insurance or COD"; contoh respons:
SiCepat `shipping_fee` 32.000 + `insurance_fee` 1.000 + `cash_on_delivery_fee`
2.000 = `price` 35.000. Docs **tidak** menyatakan eksplisit bahwa mengirim
`courier_insurance` mengaktifkan penambahan itu. Karena itu:

- ongkir dasar (tanpa asuransi) = `price − insurance_fee` kalau `insurance_fee
  > 0`, selain itu `price`;
- guard: kalau hasilnya ≤ 0, pakai `price`, matikan asuransi untuk layanan itu,
  dan `Log::warning`.

**Cara memverifikasi asumsi** (sekali, di sandbox): (1) ongkir layanan yang
sama di rute yang sama harus **tetap sama** dengan sebelum D1 (dengan markup);
kalau ongkir sekarang lebih kecil sebesar `insurance_fee`, berarti `price`
TIDAK termasuk asuransi dan rumus harus diubah jadi ongkir dasar = `price`.
(2) Di respons mentah Biteship, cek `price − insurance_fee == shipping_fee`
(selama tidak ada COD/custom rate).

**Cache** tarif kini menyimpan `insurance_available` / `insurance_fee` (via
`toArray()`/`fromArray()`); versi cache key dinaikkan (`v` = 2) supaya entri
sebelum D1 tidak dipakai.

**Yang disimpan (untuk D2):**

- `orders.insurance_fee` (default 0) — biaya yang ditagih; masuk `total`.
- `shipments.insurance_value` (nullable) — nilai pertanggungan; **null = tidak
  diasuransikan**. D2 mengirimnya sebagai `courier_insurance` saat booking.
- `shipments.insurance_fee` (nullable) — snapshot biaya dari Biteship.
- Midtrans `item_details`: baris `{ id: "INSURANCE", price: fee, quantity: 1,
  name: "Asuransi pengiriman" }` kalau dipilih; guard `sum == gross_amount`
  tetap berlaku.
- Admin: rincian biaya menampilkan "Asuransi pengiriman" (kalau > 0) dan
  data pengiriman menampilkan "Asuransi": "Tidak" atau pertanggungan + biaya.

### 1.10 Booking kurir semi-otomatis lewat tombol "Siap Kirim" (Langkah D2)

**Keputusan:**

- **Semi-otomatis & sinkron.** Admin menekan **"Siap Kirim"** di detail order
  (Filament `ViewOrder`); backend langsung memanggil Biteship `POST /v1/orders`
  dan hasilnya (resi atau alasan gagal) tampil seketika. **Tanpa queue, worker,
  atau job.** Alasan: production belum punya worker queue, jadi booking
  otomatis butuh perubahan infrastruktur; dan booking memang menunggu keputusan
  manusia (paket sudah dikemas & siap dijemput). Ini **menggantikan** rencana
  awal "booking otomatis via queue setelah settlement" — `payments-midtrans.md`
  §1.5 (webhook sinkron) **tidak** perlu direvisi.
- **Hanya** untuk order `paid` yang punya shipment dan belum dibooking
  (`biteship_order_id` null). Tombol disembunyikan selain itu.
- **Isi booking** (`ShipmentBookingService`): origin dari
  `services.biteship.origin`; destination dari `orders.shipping_address`
  (`name`, `phone`, `address_detail` + `area_label`, `postal_code`, `area_id`,
  `courier_note` → `destination_note`); `courier_company` = `shipments.courier`,
  `courier_type` = `shipments.service_code`, `delivery_type` = `now`;
  `courier_insurance` = `shipments.insurance_value` kalau diasuransikan;
  `reference_id` = `orders.order_number`; items dari `order_items` (nama +
  ukuran & harga snapshot, berat produk saat ini).
- **Validasi sebelum memanggil Biteship:** order `paid`; shipment ada & belum
  dibooking; config gudang lengkap (`BITESHIP_ORIGIN_CONTACT_NAME`,
  `_CONTACT_PHONE`, `_ADDRESS`, dan `_POSTAL_CODE` atau `_AREA_ID` — pesan
  menyebut nama env yang kosong, tanpa nilainya); alamat penerima lengkap;
  semua item punya berat > 0.

**Pengaman klik ganda / dua admin (dua lapis):**

1. `DB::transaction` + `lockForUpdate` pada baris order & shipment selama
   booking; `biteship_order_id` dicek ulang **setelah** kunci didapat. Klik
   kedua menunggu, lalu berhenti dengan "Order ini sudah dibooking".
2. `reference_id` = `order_number`: Biteship menolak dipakai ulang (code
   **40002060**) → pesan "Order ini sudah tercatat di Biteship (nomor referensi
   sama). Cek dashboard Biteship sebelum mencoba lagi." Ini juga menutup kasus
   Biteship sukses tapi penyimpanan lokal gagal.

Kunci baris ditahan selama panggilan HTTP (≤ `BITESHIP_TIMEOUT`) — disengaja:
aksi admin yang jarang, dan kunci inilah yang mencegah dua booking berbayar.

**Kalau gagal:** alasan disimpan di `shipments.booking_error` +
`booking_attempted_at` (untuk validasi data kita & penolakan Biteship, termasuk
saldo kurang), lalu tampil sebagai notifikasi merah persisten. Status order &
shipment **tidak** berubah; tombol berubah jadi **"Coba Lagi"** (aksi yang
sama). "Booking gagal" = `booking_error` terisi **dan** `biteship_order_id`
null. Timeout / koneksi putus diberi pesan khusus: booking **mungkin** sudah
tercatat, cek dashboard dulu (Coba Lagi tetap aman karena lapis 2).

**Kalau sukses:** `biteship_order_id`, `tracking_number` (= `waybill_id`),
`biteship_tracking_id`, `tracking_link`, `booked_price`, `booked_at` disimpan;
`booking_error` dikosongkan; `shipments.status` dan `orders.status` →
`processing`. Resi bisa saja belum terbit untuk sebagian kurir (waybill null).

**Kalau harga booking ≠ perkiraan:** perkiraan = `provider_cost` +
`insurance_fee` (markup toko tidak ikut). Booking **tetap jalan** (pembeli
sudah bayar); selisih di-`Log::warning` dan ditampilkan sebagai notifikasi
peringatan, serta terlihat di detail order ("Harga booking aktual" vs
"Perkiraan harga booking").

**Admin:** daftar order punya kolom **"Pengiriman"** (badge: Belum dibooking /
Booking gagal / Resi {waybill}) dan filter **"Perlu dikirim"** & **"Booking
gagal"**. Detail order menampilkan status booking, alasan & waktu gagal, resi,
tracking ID, link lacak (tab baru), ID order Biteship, dan harga aktual vs
perkiraan.

**Setelah booking:** status pengiriman diperbarui otomatis oleh webhook
Biteship (Langkah E2, §1.12).

### 1.11 Halaman "Menunggu Pembayaran" (Langkah E1)

**Masalah:** callback Snap `onSuccess` dan `onPending` sama-sama diarahkan ke
`/checkout/success`, yang selalu bilang "Pesanan Berhasil! … sedang kami
siapkan" — padahal pada `onPending` (mis. VA dipilih tapi belum ditransfer)
uang belum masuk.

**Keputusan:**

- `/checkout/payment` menentukan status dari `transaction_status` hasil
  callback Snap: `settlement` / `capture` → `paid`, selain itu → `pending`;
  `onPending` selalu `pending`. Redirect ke
  `/checkout/success?order=…&status=paid|pending` (pending juga membawa
  `token` & `gross`).
- `/checkout/success`: `status=paid` → tampilan lama. **Selain itu — termasuk
  parameter tidak ada — → "Menunggu Pembayaran"** (ikon jam, "Pesananmu sudah
  tercatat. Selesaikan pembayaran sesuai instruksi sebelum batas waktu. Pesanan
  diproses setelah pembayaran kami terima."). Default ke pending karena lebih
  aman daripada bilang berhasil padahal belum dibayar. Tidak menjanjikan email
  (belum dikonfigurasi). Pembersihan cart tidak berubah.
- Ini hanya **tampilan**. Status pembayaran final tetap dari webhook Midtrans
  (`payments-midtrans.md` §2.5–2.7).

**Tombol "Lanjutkan Pembayaran"** (varian pending, hanya kalau `token` ada di
URL) → `/checkout/payment?order=…&token=…&gross=…`, sehingga popup Snap terbuka
lagi dengan token yang sama. Teks bantu: "Gunakan tombol ini untuk melihat
kembali instruksi pembayaran selama batas waktu pembayaran belum lewat." Docs
Midtrans Snap (Advanced Features) memastikan token yang sama boleh dibuka ulang
dengan `snap.pay(token)` selama belum kedaluwarsa (default 24 jam), dan bahwa
tampilan ulang halaman pembayaran berlaku untuk GoPay/ShopeePay/QRIS.
**ASUMSI:** untuk **VA / transfer bank**, Snap juga menampilkan lagi instruksi /
nomor VA yang sudah dipilih — docs tidak menyatakannya. Cek di sandbox: pilih
VA → tutup → "Lanjutkan Pembayaran" → apakah nomor VA yang sama tampil.

**Perbaikan `/checkout/payment`:** snap.js siap ditandai lewat `<Script
onReady>` (bukan `onLoad`, yang hanya terpicu saat load pertama di tab — checkout
kedua tanpa refresh dulu tersangkut di "Menyiapkan pembayaran…"). Popup dibuka
otomatis tepat sekali per token per kunjungan halaman.

### 1.12 Status pengiriman otomatis via webhook Biteship (Langkah E2)

**Endpoint:** `POST /api/biteship/webhook` (`BiteshipWebhookController`),
publik, throttle longgar `biteship-webhook` 120/menit/IP (penahan banjir, bukan
pengaman utama).

**Keaslian — fail closed:**

- Header rahasia dari dashboard Biteship: "Headers Signature Key" = **nama
  header**, "Headers Signature Secret" = **nilainya**. Di kita:
  `BITESHIP_WEBHOOK_SIGNATURE_KEY` / `_SECRET`.
- Dicek dengan `hash_equals` **sebelum** data apa pun dibaca / diubah.
  Header tidak ada / tidak cocok → **401** + `Log::warning` (tanpa nilai
  rahasia / header yang dikirim). Salah satu env kosong → **semua** request
  ber-ID order ditolak 401 + `Log::error`.
- **Pengecualian — kiriman tanpa ID order** (body kosong / kiriman tes saat
  pendaftaran webhook): dibalas **200 sebelum** cek signature, tanpa diproses
  dan tanpa disimpan. Alasan: docs tidak menjamin kiriman tes membawa header
  rahasia, dan 401 bisa menggagalkan pendaftaran di dashboard. Aman: tanpa ID
  order tidak ada query DB dan tidak ada data yang dibaca maupun diubah —
  pengirim hanya mendapat "OK". Request **ber-ID order** tetap wajib lolos
  signature.
- **ASUMSI:** Biteship mengirim nilai secret apa adanya di header itu (bukan
  HMAC dari body). Docs publik tidak menjelaskan mekanismenya; asumsi ini
  mengikuti nama field di dashboard. Kalau ternyata berbeda, semua webhook
  akan 401 — terlihat di Events Log Biteship.

**Payload (docs Webhook Overview, Okt 2026):** event `order.status`
(`order_id`, `status`, `courier_waybill_id`, `courier_tracking_id`,
`courier_link`, `order_price`, driver), `order.waybill_id` (`order_id`,
`courier_waybill_id`, `courier_tracking_id`, `status`), `order.price`
(`order_id`, `price`, `shippment_fee`, `cash_on_delivery_fee`, ...). Parser
toleran: ID dari `order_id`, cadangan `id`; event ditebak dari isi kalau
`event` kosong; resi dari `courier_waybill_id` (cadangan `waybill_id`); harga
dari `price` (cadangan `order_price`). Contoh JSON di docs tidak valid
(kurang koma), jadi bentuk pastinya baru terkonfirmasi dari payload asli.

**Tanpa ID order → 200 sebelum cek signature** (lihat di atas). **Order tak
dikenal** (sudah lolos signature) → 200 + log warning (tidak perlu di-retry).
**Kesalahan tak terduga (mis. DB) → 500** — sengaja tidak ditangkap, supaya
terlihat gagal di Events Log Biteship dan bisa di-"Resend".

**Pemrosesan:** `DB::transaction` + `lockForUpdate` pada shipment (dan order
saat statusnya diubah). Payload terakhir disimpan di `last_webhook_payload`.
Resi dari event apa pun yang membawa `courier_waybill_id` memperbarui
`tracking_number` kalau berbeda.

**Pemetaan status** (daftar dari docs Orders — pasti; `BiteshipOrderStatus`):

| Kelompok | Status Biteship | Shipment | Order |
|---|---|---|---|
| Masih diproses | `confirmed`, `scheduled`, `allocated`, `picking_up` | `processing` | — |
| Dalam pengiriman | `picked`, `in_transit`, `dropping_off` | `shipped`, isi `shipped_at` | `shipped` |
| Sampai | `delivered` | `delivered`, isi `delivered_at` | `completed` |
| Bermasalah | `cancelled`, `rejected`, `courier_not_found`, `on_hold`, `return_in_transit`, `returned`, `disposed` | tidak diubah | tidak diubah |

`in_transit` (middle mile) tidak ada di rencana awal tapi ada di docs, jadi
masuk "dalam pengiriman". Status di luar daftar → hanya dicatat.

- `provider_status` + `provider_status_at` **selalu** dicatat apa adanya.
- **Tidak mundur:** urutan `processing < shipped < delivered` (order: `paid <
  processing < shipped < completed`). Event yang lebih mundur (mis. `picked`
  datang terlambat setelah `delivered`) tidak mengubah status enum.
- Order `completed` atau `cancelled` tidak pernah diubah webhook.
- Status bermasalah tampil **"Bermasalah: {status}"** (merah) di daftar order
  — prioritas di atas badge lain — dan ada filter **"Bermasalah"**. Tidak ada
  aksi otomatis (mis. refund / pembatalan); admin menindaklanjuti manual.

**`order.price`:** harga akhir disimpan di `provider_final_price`. Kalau
berbeda dari `booked_price` → `Log::warning` dan peringatan di detail order:
"Tagihan kurir berubah: Rp X → Rp Y (selisih ditanggung toko)". Pembeli tidak
ditagih ulang (sudah bayar).

### 1.13 Pengaturan bisnis pindah ke halaman admin "Pengaturan Pengiriman"

**Masalah:** semua pengaturan Biteship dibaca dari `.env`, jadi mengganti nomor
telepon gudang saja butuh akses server + restart container.

**Keputusan:**

| Pindah ke admin (tabel `shipping_settings`) | Tetap di `.env` |
|---|---|
| Nama kontak, telepon, alamat gudang | `BITESHIP_API_KEY` — rahasia |
| Area gudang (`area_id` + label + kode pos) | `BITESHIP_WEBHOOK_SIGNATURE_KEY` / `_SECRET` — rahasia |
| Kurir aktif | `BITESHIP_BASE_URL`, `BITESHIP_TIMEOUT` — teknis |
| Layanan yang ditampilkan (allowlist) | `TRUSTED_PROXIES` — teknis / keamanan infrastruktur |
| Markup ongkir | `SERVICE_FEE` — tidak dipakai (§1.6) |

Alasan pembagian: yang pindah adalah keputusan **bisnis** yang wajar diubah
admin toko; yang tetap adalah **rahasia** (tidak boleh ada di DB maupun tampil
di layar) dan pengaturan **teknis** yang salah isi bisa merusak integrasi /
keamanan dan memang milik pemegang server. Tidak ada API key atau secret di
tabel `shipping_settings`.

**Prioritas per field: DB → `.env`.** `App\Services\Shipping\ShippingSettings`
mengembalikan nilai efektif: kolom DB kalau terisi, kalau kosong/null → config
`.env` (`services.biteship.origin` / `couriers` / `allowed_services`,
`services.checkout.shipping_markup`). Markup `0` di DB adalah nilai sah (bukan
"kosong"). Sebelum halaman pernah disimpan — atau kalau tabelnya belum ada
karena migrate belum jalan — semua nilai memakai `.env`, jadi deploy tidak
mengubah perilaku apa pun. Semua pembacaan lama lewat `config()` diganti ke
service ini (`BiteshipShippingProvider`, `ShippingQuoteService`,
`ShippingServiceAllowlist`, `ShipmentBookingService`).

**Langsung berlaku:** DB dibaca sekali per request (memo di instance, binding
`scoped`), tanpa Laravel cache. Cache key tarif memakai nilai efektif (area
gudang, kurir, allowlist), jadi perubahan di admin memakai entri cache baru;
markup dipasang setelah cache (§1.6). Tidak perlu restart container.

**Halaman admin** (`ManageShippingSettings`, menu "Pengaturan Pengiriman"):

- **Gudang:** nama kontak, telepon (angka, boleh diawali `+`, 8–15 digit),
  alamat — wajib saat menyimpan. Area lewat Select searchable (min 3 huruf)
  yang memakai `ShippingAreaSearch` — cache yang sama dengan
  `GET /api/shipping/areas`, karena setiap cache miss berbayar. Saat dipilih,
  ID + label + kode pos disimpan; kode pos bisa disunting. Error Biteship →
  notifikasi, bukan crash. Area yang tersimpan tampil sebagai label.
- **Kurir & layanan:** kurir aktif min 1, **maks 3** (batas paket Starter);
  layanan dikelompokkan per kurir, min 1 total. Layanan dari kurir yang tidak
  aktif **disabled** dan tidak ikut tersimpan (field disabled tidak
  di-dehydrate Filament) — Biteship juga tidak mengembalikan tarifnya.
- **Katalog** (`BiteshipCourierCatalog`, statis): jne reg/yes/oke/jtr, jnt ez,
  sicepat reg/best/gokil, anteraja reg/next_day/same_day — dicocokkan ke docs
  Biteship Couriers. `jne:jtr` (min 10 kg) & `sicepat:gokil` ditandai kargo;
  `jne:oke` & `anteraja:next_day` **tidak** ada di docs dan ditandai "belum ada
  di docs Biteship". Entri allowlist tersimpan yang tidak ada di katalog tetap
  dipertahankan dan tampil sebagai **"kode lain"** (lepas centang untuk hapus).
- **Biaya:** markup ongkir (rupiah, bulat, ≥ 0).
- Nilai cadangan `.env` yang sedang berlaku tampil sebagai placeholder /
  keterangan — tanpa rahasia apa pun.

**Akses:** semua admin boleh membuka & mengubah halaman ini (belum ada peran).
**Log perubahan:** setiap simpan → `Log::info('Pengaturan pengiriman
diubah.')` berisi `user_id`, `user_email`, waktu, dan per field yang berubah
`old` → `new`; `shipping_settings.updated_by` menyimpan admin terakhir.

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

### D1. Asuransi pengiriman opsional — selesai di kode

Lihat §1.9.

### D2. Booking kurir ("Siap Kirim") — selesai di kode

Lihat §1.10. Rencana awal (booking otomatis lewat job di queue worker setelah
settlement, merevisi `payments-midtrans.md` §1.5) **dibatalkan** dan diganti
tombol admin yang sinkron.

### E1. Halaman "Menunggu Pembayaran" — selesai di kode

Lihat §1.11.

### E2. Status pengiriman otomatis (webhook Biteship) — selesai di kode

Lihat §1.12. Polling tidak dipakai — webhook cukup, dan polling butuh
scheduler/worker yang belum ada di production.

---

## 4. Known Limitations

### 4.1 Tarif yang di-cache bisa sedikit basi

Tarif di-cache 10 menit; kalau Biteship mengubah harga di jendela itu, pembeli
melihat angka lama. Perhitungan ulang saat order dibuat melewati cache yang
sama, jadi selama cache masih hidup angka yang ditampilkan dan ditagih
konsisten — selisih dengan tarif Biteship terkini (kalau ada) ditanggung toko.
Kalau cache sudah kedaluwarsa dan Biteship memberi harga lain, order ditolak
`shipping_cost_changed` dan pembeli memilih ulang (§1.7).
**Revisit:** kalau selisih ini muncul nyata saat booking kurir (Langkah D2 — terlihat di "Harga booking aktual" vs "Perkiraan harga booking").

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
- [ ] saldo Biteship juga cukup untuk **booking** (tarif kurir asli + asuransi
      per order yang dikirim); saldo kurang = "Siap Kirim" gagal (§1.10)
- [ ] key Biteship live (`biteship_live.`) + alamat origin asli (bukan dummy)
      di `.env` production
- [ ] berat semua produk aktif di production diisi lewat admin (§1.2)
- [ ] aktivasi API production di Biteship
- [ ] Langkah B dan C di-deploy bersamaan (B tidak boleh sendirian)
- [ ] migrasi Langkah C dijalankan di production saat deploy
      (`2026_10_16_000001_add_service_fee_to_orders_table`,
      `2026_10_16_000002_add_service_details_to_shipments_table`,
      `2026_10_16_000003_add_provider_cost_to_shipments_table`,
      `2026_10_16_000004_add_insurance_fee_to_orders_table`,
      `2026_10_16_000005_add_insurance_to_shipments_table`,
      `2026_10_16_000006_add_booking_fields_to_shipments_table`,
      `2026_10_16_000007_add_tracking_fields_to_shipments_table`, plus
      `2026_10_16_000000_add_weight_grams_to_products_table` dari Langkah A)
- [ ] asumsi asuransi D1 terverifikasi di sandbox (§1.9: ongkir layanan yang
      sama tidak berubah setelah D1)
- [ ] isi `SHIPPING_MARKUP=500` di `.env` production (keputusan Kapten, §1.6),
      lalu `config:clear` / `config:cache`
- [ ] `SERVICE_FEE` tetap `0` di production (opsi B tidak dipakai, §1.6)
- [x] ~~tidak ada varian aktif dengan `price_override` (§4.4)~~ — sudah
      ditangani (§1.8)
- [ ] ada penanggung jawab yang mengemas paket dan menekan **"Siap Kirim"**
      untuk setiap order yang sudah dibayar (filter "Perlu dikirim"), serta
      menindaklanjuti "Booking gagal" (§1.10)
- [ ] alamat gudang lengkap di `.env` production: `BITESHIP_ORIGIN_CONTACT_NAME`,
      `_CONTACT_PHONE`, `_ADDRESS`, dan `_POSTAL_CODE` / `_AREA_ID`
- [ ] **daftarkan webhook** di dashboard Biteship (Integrations → For
      Developers → Webhook), mode **live**:
      URL `https://velcroethereal.com/api/biteship/webhook`; event
      `order.status`, `order.waybill_id`, `order.price`; "Headers Signature
      Key" & "Headers Signature Secret" **sama persis** dengan
      `BITESHIP_WEBHOOK_SIGNATURE_KEY` / `_SECRET` di `.env` production (isi
      `.env` dulu + `config:cache`, baru daftarkan; kiriman tes tanpa ID order
      selalu dibalas 200, jadi pendaftaran tidak bergantung pada header).
      Webhook mode **test dan live dipisah**; daftarkan masing-masing.
- [ ] setelah didaftarkan: cek Events Log Biteship — tidak ada 401 (§1.12,
      asumsi header signature)
- [ ] migrasi `2026_10_17_000000_create_shipping_settings_table` dijalankan,
      lalu isi halaman admin **Pengaturan Pengiriman** dengan data gudang
      **ASLI** (kontak, telepon, alamat, area lewat pencarian), kurir, layanan,
      dan markup `500` — atau biarkan kosong untuk memakai `.env` (§1.13)

---

## Variabel env (`apps/api/.env`)

| Variabel | Keterangan |
|---|---|
| `BITESHIP_API_KEY` | Key dari dashboard Biteship. `biteship_test.` = sandbox, `biteship_live.` = live. |
| `BITESHIP_BASE_URL` | `https://api.biteship.com` (sama untuk test & live). |
| `BITESHIP_TIMEOUT` | Timeout HTTP dalam detik (default 10). |
| `BITESHIP_COURIERS` | **Cadangan** (halaman admin Pengaturan Pengiriman diutamakan, §1.13). Kode kurir dipisah koma (default `jne,jnt,sicepat`, maks 3 di Starter). |
| `TRUSTED_PROXIES` | IP/CIDR proxy tepercaya dipisah koma. **Kosong = mati** (default). Isi (mis. `172.16.0.0/12`) hanya setelah nginx host VPS menyetel `X-Forwarded-For` (§2.2). `*` / `0.0.0.0/0` ditolak. |
| `BITESHIP_ALLOWED_SERVICES` | **Cadangan** (admin diutamakan, §1.13). Allowlist `kurir:layanan` (default `jne:reg,jne:yes,jnt:ez,sicepat:reg,sicepat:best`; string kosong = tidak memfilter). |
| `BITESHIP_ORIGIN_AREA_ID` | **Cadangan** (admin diutamakan, §1.13). Area ID gudang/pengirim — **wajib** untuk cek tarif. |
| `BITESHIP_ORIGIN_POSTAL_CODE` | **Cadangan** (admin diutamakan, §1.13). Kode pos pengirim — booking (D2) butuh ini **atau** `BITESHIP_ORIGIN_AREA_ID`. |
| `BITESHIP_ORIGIN_CONTACT_NAME` | **Cadangan** (admin diutamakan, §1.13). Nama kontak pengirim — **wajib** untuk booking (D2). |
| `BITESHIP_ORIGIN_CONTACT_PHONE` | **Cadangan** (admin diutamakan, §1.13). Telepon kontak pengirim — **wajib** untuk booking (D2). |
| `BITESHIP_ORIGIN_ADDRESS` | **Cadangan** (admin diutamakan, §1.13). Alamat lengkap pengirim (gudang, tempat kurir menjemput) — **wajib** untuk booking (D2). |
| `BITESHIP_WEBHOOK_SIGNATURE_KEY` | Nama header rahasia webhook = "Headers Signature Key" di dashboard Biteship (mis. `X-Biteship-Signature`). Kosong = semua webhook ditolak (§1.12). |
| `BITESHIP_WEBHOOK_SIGNATURE_SECRET` | Nilai header rahasia = "Headers Signature Secret" di dashboard (string acak panjang). Kosong = semua webhook ditolak. Test & live berbeda. |
| `SHIPPING_MARKUP` | **Cadangan** (admin diutamakan, §1.13). Markup flat per order di atas tarif kurir, rupiah bulat (default `0`). Masuk ke ongkir yang tampil & ditagih. **Keputusan Kapten: `500` di production** (§1.6). |
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
| Kolom `orders.insurance_fee` (D1) | `apps/api/database/migrations/2026_10_16_000004_add_insurance_fee_to_orders_table.php` |
| Kolom asuransi di `shipments` (D1) | `apps/api/database/migrations/2026_10_16_000005_add_insurance_to_shipments_table.php` |
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
| Booking kurir (D2): service + DTO | `apps/api/app/Services/Shipping/ShipmentBookingService.php`, `ShipmentBookingRequest.php`, `ShipmentBookingResult.php`, `ShipmentBookingOutcome.php` |
| Booking kurir (D2): Biteship `POST /v1/orders` | `apps/api/app/Services/Shipping/BiteshipShippingProvider.php` (`createShipment`) |
| Exception booking (validasi data kita) | `apps/api/app/Exceptions/ShipmentBookingException.php` |
| Tombol "Siap Kirim" / "Coba Lagi" | `apps/api/app/Filament/Resources/Orders/Pages/ViewOrder.php` |
| Kolom "Pengiriman" + filter | `apps/api/app/Filament/Resources/Orders/Tables/OrdersTable.php` |
| Kolom booking di `shipments` (D2) | `apps/api/database/migrations/2026_10_16_000006_add_booking_fields_to_shipments_table.php` |
| Webhook status pengiriman (E2) | `apps/api/app/Http/Controllers/BiteshipWebhookController.php`, route `POST /biteship/webhook` |
| Pemetaan status Biteship (E2) | `apps/api/app/Services/Shipping/BiteshipOrderStatus.php` |
| Kolom tracking di `shipments` (E2) | `apps/api/database/migrations/2026_10_16_000007_add_tracking_fields_to_shipments_table.php` |
| Halaman pembayaran / menunggu pembayaran (E1) | `apps/web/src/app/(main)/checkout/payment/page.tsx`, `apps/web/src/app/(main)/checkout/success/page.tsx` |
| Pengaturan bisnis efektif (DB → .env) | `apps/api/app/Services/Shipping/ShippingSettings.php`, model `apps/api/app/Models/ShippingSetting.php` |
| Halaman admin Pengaturan Pengiriman | `apps/api/app/Filament/Pages/ManageShippingSettings.php` |
| Katalog kurir & layanan | `apps/api/app/Services/Shipping/BiteshipCourierCatalog.php` |
| Pencarian area ber-cache (checkout + admin) | `apps/api/app/Services/Shipping/ShippingAreaSearch.php` |
| Tabel `shipping_settings` | `apps/api/database/migrations/2026_10_17_000000_create_shipping_settings_table.php` |
| Route | `apps/api/routes/api.php` (`GET /shipping/areas`, `POST /shipping/rates`) |
| Config | `apps/api/config/services.php` (`biteship`, `checkout`), `apps/api/.env.example` |
| Kolom berat | `apps/api/database/migrations/2026_10_16_000000_add_weight_grams_to_products_table.php` |
| Admin | `apps/api/app/Filament/Resources/Products/Schemas/ProductForm.php`, `Tables/ProductsTable.php` |
