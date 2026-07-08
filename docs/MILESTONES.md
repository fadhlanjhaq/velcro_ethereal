# Milestones — velcro-ethereal

Log ringkas progres per milestone. **Bukan** changelog teknis per baris kode
(itu sudah tercermin di `git log`). Setiap milestone baru ditambahkan sebagai
entri di file ini sebagai bagian dari kriteria "selesai".

---

## Milestone 1 — Inisialisasi Monorepo
**Tanggal:** 7 Juli 2026
**Status:** Selesai

Ringkasan: Membentuk struktur monorepo dengan dua aplikasi di bawah `apps/`:
`api` (Laravel 13, PHP 8.4 via Herd) dan `web` (Next.js dengan App Router,
TypeScript, Tailwind, `src/` dir, dan alias `@/*`, di-scaffold via
`create-next-app@16.2.10`). Ditambahkan pula `docs/`, `.gitignore` root, dan
`README.md`. File instruksi agent bawaan scaffold (`AGENTS.md`, `CLAUDE.md`)
ikut di-commit.

Keputusan kunci:
- **Monorepo, bukan dua repo terpisah** — target deploy adalah single VPS dengan
  satu `docker-compose.yml` yang mengorkestrasi frontend + backend, sehingga
  menaruh keduanya dalam satu repo menyederhanakan orkestrasi dan versioning
  bersama.

---

## Milestone 2 — Docker Compose Validasi Pra-Deploy
**Tanggal:** 7 Juli 2026
**Status:** Selesai

Ringkasan: Menyusun stack Docker Compose untuk memvalidasi **build production**
sebelum deploy ke VPS. Dibuat Dockerfile multi-stage untuk `apps/api`
(PHP 8.4-fpm, `composer install --no-dev --optimize-autoloader`) dan `apps/web`
(build standalone Next.js, runner hanya membawa output standalone). Satu Nginx
reverse proxy menjadi single entry point: `/api/*` dan `/up` diarahkan ke Laravel
(php-fpm `api:9000`), sisanya ke storefront Next.js (`web:3000`).
`docker-compose.yml` mendefinisikan service `web`, `api`, `db` (MySQL 8), `redis`,
dan `proxy`, dengan wiring DB/Redis di-inject dari compose agar `.env` native
(Herd) tetap utuh.

Keputusan kunci:
- **Stack ini khusus validasi pra-deploy, BUKAN environment dev harian.** Dev
  harian tetap native (Herd untuk Laravel, `npm run dev` untuk Next.js). Image
  di-build penuh tiap kali, tanpa bind-mount source / hot-reload — dioptimalkan
  untuk kemiripan dengan production, bukan kecepatan iterasi.
- **Wiring DB/Redis di-inject oleh `docker-compose.yml`**, bukan mengubah `.env`,
  supaya nilai native developer (Herd/sqlite) tidak perlu diubah dan dev harian
  tetap aman.

Isu & fix:
- **Port 80 host bentrok dengan Herd** → mapping port proxy diubah dari `80:80`
  menjadi `8080:80` di `docker-compose.yml`, sehingga stack diakses di
  `http://localhost:8080`. (Perubahan ini ada di working tree; catatan: bagian
  "Validasi Pra-Deploy" di `README.md` masih menyebut port 80 dan perlu
  disinkronkan.)
- **500 error di endpoint `/up`** → **root cause tidak terdokumentasi di commit,
  perlu konfirmasi manual dari developer.** Tidak ada commit message atau diff
  yang menjelaskan penyebab maupun perbaikannya. Satu-satunya sinyal terkait
  adalah perubahan working-tree pada `apps/api/composer.json` yang menambahkan
  `laravel/pail` ke `extra.laravel.dont-discover` (mencegah auto-discovery paket
  dev-only saat `composer install --no-dev`); namun tidak ada catatan yang
  mengonfirmasi ini sebagai fix untuk 500 tersebut, jadi ini **belum terverifikasi**.

---

## Milestone 3 — Database Schema, Migration & Seeder
**Tanggal:** 8 Juli 2026
**Status:** Selesai

Ringkasan: Membuat skema database inti e-commerce di `apps/api` — 12 migration
(`categories`, `products`, `product_variants`, `product_images`, `addresses`,
`carts`, `cart_items`, `orders`, `order_items`, `payments`, `shipments`, plus
kolom `phone` pada `users` via migration terpisah), model Eloquent dengan
relasi lengkap (`hasMany`/`belongsTo`/`hasOne`), dan seeder awal
(`CategorySeeder`, `HeritageCollectionSeeder`). Model mengikuti konvensi
codebase yang sudah ada (atribut PHP `#[Fillable]`/`#[Hidden]`, method
`casts()`), dan status enum (`orders.status`, `payments.status`,
`shipments.status`) di-cast ke native PHP backed enum (`App\Enums\*`).

Penyesuaian dari SOT:
- **Varian produk hanya per ukuran (S/M/L/XL), bukan ukuran × warna.**
  SOT awal mengasumsikan kombinasi size × warna per varian, tapi untuk
  koleksi ini setiap nama produk sudah punya satu colorway tetap yang
  melekat pada identitas produk (mis. "Aurelia Knotwork Jacket" =
  colorway Beige Brown yang tidak berubah), bukan pilihan warna terpisah
  di level varian. `product_variants` karena itu hanya punya kolom `size`,
  tanpa kolom warna.
- Dev harian pindah dari SQLite ke **MySQL native via DBngin**
  (`DB_HOST=127.0.0.1`, `DB_PORT=3311`, database `db_velcro01`) — `.env`
  sudah disesuaikan sebelum migration dijalankan (tidak di-commit).

Keputusan kunci:
- **`orders.shipping_address` disimpan sebagai snapshot JSON**, bukan relasi ke
  `addresses`, supaya histori order tidak berubah kalau user mengedit/menghapus
  alamatnya setelah checkout.
- **`order_items` menyimpan snapshot (`product_name`, `size`, `price`)** dan
  `product_variant_id` dibuat nullable dengan `nullOnDelete`, supaya order lama
  tidak rusak kalau varian produk dihapus di kemudian hari.
- Migration untuk roles/permissions **sengaja belum dibuat** — itu fitur upsell
  tier (multi-role admin), belum diperlukan di base tier.

Data seed:
- 3 kategori: Baju, Jaket, Celana.
- 4 produk koleksi "Heritage" (Aurelia Knotwork Jacket, Verdant Knotwork
  Jacket, Cervus Grove Jacket, Aureus Peacock Jacket), semua kategori Jaket,
  masing-masing 4 varian ukuran (S/M/L/XL), stok awal 10/varian, SKU format
  `VE-[inisial]-[ukuran]`.
- **`base_price` = Rp 850.000 untuk semua produk adalah PLACEHOLDER** (ditandai
  eksplisit di `HeritageCollectionSeeder`) — harga asli menyusul dari client,
  belum final.

Verifikasi: `php artisan migrate:fresh --seed` berhasil tanpa error. Jumlah
baris ter-insert: `users` 1, `categories` 3, `products` 4, `product_variants`
16, sisanya (`product_images`, `addresses`, `carts`, `cart_items`, `orders`,
`order_items`, `payments`, `shipments`) 0 (belum ada seeder untuk tabel
transaksional, sesuai cakupan milestone ini).
