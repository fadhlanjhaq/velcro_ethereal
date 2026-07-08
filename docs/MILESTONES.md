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

---

## Milestone 4 — Landing Page dengan GSAP Animation
**Tanggal:** 8 Juli 2026
**Status:** Selesai

Ringkasan: Membangun landing page prototipe di `apps/web` (frontend murni,
TIDAK menyentuh `apps/api`), tampil sebelum halaman `/shop` (Milestone 5).
Lima section modular di `src/components/landing/` — `Hero`, `BrandStory`,
`FeaturedProducts`, `Craftsmanship`, `ClosingCta` — dirakit di `src/app/page.tsx`
(mengganti halaman default create-next-app). Animasi memakai stack yang sudah
diputuskan: **GSAP core + ScrollTrigger + SplitText + Lenis** (semua gratis penuh
sejak GSAP diakuisisi Webflow), di-install via `npm i gsap @gsap/react lenis`.
Smooth scroll (Lenis) dipasang lewat `src/components/SmoothScrollProvider.tsx`
di root layout, disinkronkan ke ScrollTrigger via `gsap.ticker`.

Keputusan pemilihan aset (dari inspeksi langsung tiap file):
- **Hero background video → `videos/asset_video03.mp4`.** Satu-satunya kandidat
  yang landscape (1280×722, ~16:9) SEKALIGUS paling sinematik: interior restoran
  hangat, bokeh, mood "brand film". Dua video lain portrait (`asset_video02` =
  detail denim, `asset_video04` = topi/varsity) kurang cocok untuk hero
  full-bleed desktop; `asset_video01` juga landscape tapi shot grup outdoor yang
  lebih ramai/terang, kurang "hero".
- **Poster fallback → `images/brand/hero-poster.jpg`.** Di-extract dari frame
  bersih `asset_video03` pada t=2s (tanpa subtitle), jadi poster selaras dengan
  video.
- **Craftsmanship (mood/tekstur) → `images/brand/asset_06.jpg`** (mood kafe,
  moody) **+ `images/product/asset_05.jpg`** (close-up tekstur rajut — detail
  craftsmanship paling jelas), keduanya diberi parallax ringan (scrub).
- **FeaturedProducts → foto per produk.** Hanya **"Aureus Peacock Jacket"** yang
  punya foto ASLI (bordir merak emas tampak belakang `brand/asset_02.jpg` +
  tampak depan `product/asset_01.jpg`, `product/asset_03.jpg`). Tiga produk lain
  (Aurelia/Verdant Knotwork, Cervus Grove) BELUM ada fotonya — dipakai
  PLACEHOLDER dari aset lain (a.l. koleksi "Seafarer Wave Knit" yang bukan bagian
  Heritage) semata untuk mengisi layout. Ditandai eksplisit di
  `lib/mock-products.ts`. Ganti dengan product photography asli sebelum rilis.

Kendala aset (penting): **semua 4 video sumber punya subtitle auto-caption yang
ter-burn-in** (mis. "Elegance and Luxury", "Premium Tailoring") dan tiap foto
punya watermark "Velcro Ethereal" + teks "Velcro Collections on 2026" /
nama produk. Untuk hero, subtitle disamarkan dengan scrim gradient bawah
(ink→transparan) + tint + sedikit skala video (`scale-105`); poster sengaja
diambil dari frame tanpa subtitle. Rekomendasi: minta master video/foto bersih
(tanpa caption/watermark) dari client untuk versi produksi.

Setting kompresi video (referensi kalau menambah/re-encode video):
`ffmpeg -i in.mp4 -c:v libx264 -crf 28 -preset slow -vf "scale='min(1280,iw)':-2" -an out.mp4`
(crf 28, preset slow, downscale ke lebar maks 1280, `-an`/muted). Video hero
otomatis di-mute juga di markup (`autoPlay muted loop playsInline` — wajib agar
autoplay tidak diblok browser).

Requirement teknis yang dipenuhi:
- Semua komponen animasi `"use client"`; animasi GSAP di dalam `useGSAP()`
  (`@gsap/react`), bukan `useEffect` biasa — cleanup bersih, tidak dobel saat
  re-render. Integrasi Lenis (infra raf/ticker, bukan tween) tetap di `useEffect`.
- **Reduced-motion dihormati:** tiap animasi dibungkus
  `gsap.matchMedia("(prefers-reduced-motion: no-preference)", …)` — kalau user
  minta motion dikurangi, tween tidak jalan & elemen tetap tampil (state alami),
  Lenis pun tidak diinisialisasi (pakai scroll native). Ada juga guard CSS
  `@media (prefers-reduced-motion: reduce)` di `globals.css`.
- Semua foto pakai `next/image` (bukan `<img>`); video hero `<video>` full-bleed
  `object-cover` dengan `poster`.

Data mock (`lib/mock-products.ts`): meniru PERSIS shape payload API Laravel
(snake_case, `base_price` string decimal "850000.00", nested `category`/`variants`
/`images`). Isi identik `HeritageCollectionSeeder` (4 produk, SKU `VE-…`, ukuran
S/M/L/XL, stok 10). Semua komponen ambil data dari file ini — tidak ada string
produk yang di-hardcode di JSX — supaya swap ke API asli (Milestone 5) cukup
ganti sumber data tanpa bongkar komponen.

Tema visual & font:
- **Design tokens** ditaruh sebagai `@theme` di `globals.css` (Tailwind v4,
  project ini tidak punya `tailwind.config`): `ink #1C1712`, `ink-soft #2B241C`,
  `gold #B8935A`, `gold-dark #8C6D3F`, `green #44543A`, `cream #F3EDE1`.
- **Font:** brief minta Cambria (heading) + Calibri (body); keduanya font sistem
  Microsoft, BUKAN web font. Diganti (dicatat di komentar `globals.css`/`layout`):
  heading → **Cormorant Garamond** (serif heritage/ethereal, via
  `next/font/google`), body → **Geist Sans** (sans netral, sudah ada sejak
  scaffold). Cambria/Calibri tetap jadi fallback stack.

CATATAN ASUMSI (belum final, pending client):
- **Palet warna & seluruh copy landing masih ASUMSI** (diturunkan dari brand DNA,
  bukan brand guideline resmi) — ditandai eksplisit di `globals.css`. Wajib
  dikonfirmasi ulang saat guideline final.
- **Data produk = mock sementara**, menunggu API asli di Milestone 5. `base_price`
  Rp 850.000 tetap placeholder (identik seeder).

Batasan milestone (sesuai brief, tidak dikerjakan): halaman `/shop` asli belum
dibuat (link CTA mengarah ke `/shop` & `/shop/{slug}`, boleh 404 dulu); tidak
menyentuh `apps/api`; tidak ada shader/WebGL; tidak menambah Framer Motion
(ScrollTrigger sudah cukup); `.env` tidak di-commit; belum push ke GitHub.

Verifikasi: `npx tsc --noEmit` & `npm run lint` bersih; `npm run build`
(Turbopack) sukses — 4 halaman ter-prerender static (`/`, `/_not-found`),
Cormorant Garamond ter-fetch & self-host oleh `next/font` tanpa error. Dev server
di-render & di-screenshot (desktop 1440px + mobile 390px, via Chrome headless
dengan `prefers-reduced-motion` dipaksa): semua section tampil, gambar termuat,
layout responsif tanpa overflow horizontal, tidak ada error runtime di log.
