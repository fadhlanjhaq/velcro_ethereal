# SOT — Source of Truth
## Platform E-Commerce Brand Clothing (Baju, Jaket, Celana)

**Versi:** 1.0
**Status:** Draft hasil brainstorming — siap dieksekusi, terbuka untuk revisi
**Sifat dokumen:** Template umum yang bisa dipakai ulang untuk client sejenis, disesuaikan per kebutuhan spesifik

---

## 1. Ringkasan Eksekutif

Platform e-commerce untuk brand clothing (kategori baju, jaket, celana) dengan sistem pembayaran merchant penuh (payment gateway), mulai dari sisi customer (browsing produk, checkout, tracking order) sampai sisi admin (manajemen produk, order, laporan penjualan).

Dibangun sebagai custom build — bukan pakai platform SaaS seperti Shopify — supaya kepemilikan produk sepenuhnya di tangan developer/agency, sesuai model bisnis "jual + kelola sendiri infrastrukturnya".

Pendekatan build: mayoritas sistem (≈90%) dibangun di tahap awal dengan bantuan AI-assisted development untuk mempercepat time-to-launch, sisanya di-refine dan ditambah fitur secara bertahap pasca-launch.

---

## 2. Tech Stack & Arsitektur

| Layer | Pilihan | Alasan |
|---|---|---|
| Frontend (storefront) | Next.js (App Router) | SEO & performa terbaik untuk halaman produk (SSR/ISR), penting untuk brand yang mengandalkan organic traffic & tampilan premium |
| Backend/API | Laravel 13 (PHP 8.4) | Business logic, auth, payment integration, admin panel |
| Admin Panel | Filament 5 (di atas Laravel) | CRUD, role/permission, dashboard — hemat waktu development signifikan. Filament 5 dipakai karena versi 3/4 belum tentu declare compatibility resmi ke Laravel 13 |
| Database | MySQL | Standar, matang, banyak tooling |
| Cache/Queue | Redis | Session, cache produk, queue untuk job async (kirim email, webhook payment) |
| Hosting | Single VPS, dockerized (Next.js + Laravel + MySQL + Redis dalam satu server) | Lebih simpel dikelola, biaya predictable dibanding split hosting |
| Payment Gateway | Midtrans | Fee kompetitif (setara Xendit), ekosistem & dokumentasi Laravel paling matang → risiko integrasi lebih rendah |
| Shipping/Ongkir | Biteship (API ongkir otomatis) | Harga transparan publik, model fleksibel (per-request atau paket bulanan) |
| Notifikasi | Email (SMTP) | Baseline paling murah; WhatsApp API bisa ditambah sebagai upsell |

**Catatan arsitektur:** Next.js dan Laravel berkomunikasi lewat REST API. Next.js tidak menyimpan business logic apa pun — murni presentation layer + SSR/ISR untuk performa.

---

## 3. Model Bisnis & Kepemilikan Infrastruktur

- **Domain & VPS diprovision dan dipegang oleh developer/agency** (bukan client) — client "menyewa" infrastruktur ini.
- Karena struktur ini, model bisnis default adalah **subscription + maintenance** (bukan jual putus), karena keberlangsungan situs bergantung pada hosting yang dikelola developer.
- **Opsi "jual putus"** tetap bisa ditawarkan sebagai exit-path: client membeli source code + dokumentasi, lalu pindah ke infrastruktur milik mereka sendiri (developer membantu proses migrasi sebagai layanan terpisah/berbayar).
- Biaya pihak ketiga (fee Midtrans per transaksi, biaya API Biteship) **bukan margin developer** — ini pass-through cost yang ditanggung/dibayar client secara langsung atau dimasukkan sebagai line item terpisah di invoice.

---

## 4. Modul & Fitur

### 4.1 Autentikasi & Akun
- Register & login (email + password)
- **Guest checkout diperbolehkan** — akun bersifat opsional, tidak menjadi syarat wajib untuk membeli
- Session management (Laravel Sanctum untuk auth antara Next.js ↔ Laravel API)
- Reset password via email
- Riwayat order & wishlist untuk user yang punya akun

### 4.2 Katalog Produk
- Kategori: Baju, Jaket, Celana (extensible untuk kategori baru)
- **Varian produk**: setiap produk punya kombinasi ukuran (S/M/L/XL/dst) × warna, masing-masing kombinasi punya SKU dan stok sendiri
  *(asumsi default — standar untuk clothing e-commerce, silakan koreksi jika beda)*
- Galeri gambar produk (multi-angle)
- Search & filter (kategori, ukuran, warna, rentang harga)
- Deskripsi produk, size guide per produk

### 4.3 Keranjang & Checkout
- Keranjang persist untuk guest (session-based) dan user login (tersimpan ke akun)
- Checkout: input alamat, pilih kurir & metode pembayaran, ringkasan order
- Kalkulasi ongkir real-time via Biteship API

### 4.4 Pembayaran
- Integrasi Midtrans — channel: QRIS, Virtual Account, e-wallet, kartu kredit/cicilan
- Webhook untuk update status pembayaran otomatis (tanpa konfirmasi manual admin)
- Invoice otomatis per order

### 4.5 Pengiriman
- Kalkulasi ongkir otomatis (multi-kurir: JNE, J&T, SiCepat, dll via Biteship)
- Status tracking resi terintegrasi
- Notifikasi email saat status order berubah (diproses → dikirim → selesai)

### 4.6 Admin Panel (Filament)
- **Base tier: single admin** (owner pegang semua akses)
- **Upsell tier: multi-role** (contoh: staff gudang hanya akses stok, CS hanya akses order, tanpa laporan keuangan)
- Manajemen produk & varian, stok
- Manajemen order (lihat, ubah status, cetak invoice/label)
- Laporan penjualan (basic: harian/bulanan, per produk)

### 4.7 Halaman Konten
*(standar untuk brand clothing, termasuk sebagai baseline)*
- About Us
- Size Guide
- Kebijakan Retur & Penukaran
- Privacy Policy & Syarat & Ketentuan *(wajib ada — disyaratkan Midtrans untuk approval merchant)*
- Kontak & FAQ

### 4.8 Keamanan & Compliance
- HTTPS/SSL wajib (disyaratkan payment gateway)
- Password di-hash (bcrypt/argon2 — standar Laravel)
- Backup database otomatis harian (bagian dari paket maintenance)
- Rate limiting pada API publik untuk mencegah abuse

---

## 5. Garis Besar Entitas Database

*(high-level, bukan skema final — untuk gambaran cakupan development)*

- `users` — customer & admin
- `roles` / `permissions` — untuk multi-role admin (upsell)
- `products`, `product_variants` (size × warna, SKU, stok)
- `categories`
- `carts`, `cart_items`
- `orders`, `order_items`
- `payments` (relasi ke transaksi Midtrans)
- `shipments` (relasi ke Biteship, resi, status)
- `addresses` (alamat pengiriman user)

---

## 6. Asumsi Terbuka

Bagian ini berisi keputusan yang diisi dengan best-practice default karena belum dikonfirmasi eksplisit. **Silakan koreksi jika ada yang meleset:**

1. Varian produk mengikuti pola size × warna standar (bukan single-variant tanpa opsi)
2. Satu gudang/lokasi stok (bukan multi-warehouse)
3. Halaman konten (About Us, policy, dll) mengikuti struktur standar brand clothing pada umumnya
4. Backup harian otomatis termasuk dalam paket maintenance, bukan add-on terpisah
5. Bahasa & mata uang: Bahasa Indonesia, IDR — tidak multi-bahasa/multi-currency di fase awal

---

## 7. Di Luar Cakupan (Fase Awal)

- Multi-warehouse / multi-gudang
- Notifikasi WhatsApp (tersedia sebagai upsell terpisah)
- Multi-bahasa / multi-currency
- Program loyalti/poin (bisa jadi fase 2)
- Live chat customer service terintegrasi

---

## 8. Langkah Selanjutnya

1. Pricelist tiering (dokumen terpisah, format Excel) — mencakup biaya one-time build vs subscription+maintenance, dengan pass-through cost (Midtrans fee, Biteship API) dijabarkan terpisah dari margin jasa
2. Wireframe/UI reference (opsional, sebelum development dimulai)
3. Breakdown fase development (MVP → enhancement bertahap)
