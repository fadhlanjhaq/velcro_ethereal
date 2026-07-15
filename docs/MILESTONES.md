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

---

## Milestone 5 — API Laravel + Halaman Shop
**Tanggal:** 8 Juli 2026
**Status:** Selesai

Ringkasan: Menyambungkan data asli (Milestone 3) ke frontend (Milestone 4) —
mengganti mock data dengan API Laravel — dan membangun halaman `/shop` +
`/shop/{slug}`. `apps/web/src/lib/mock-products.ts` dipakai sebagai KONTRAK
bentuk payload; API Resource dibuat agar JSON-nya PERSIS sama (snake_case,
`base_price` string decimal, nested `category`/`variants`/`images`).

Bagian A — API Laravel (`apps/api`):
- `routes/api.php` didaftarkan lewat `bootstrap/app.php` (`withRouting(api: …)` —
  Laravel 13 belum menyertakan param `api:` secara default). Dua endpoint:
  `GET /api/products` (produk aktif) & `GET /api/products/{slug}` (404 JSON kalau
  slug tidak ada / produk non-aktif, via `firstOrFail`).
- `ProductController` eager-load `category`/`variants`/`images` (hindari N+1).
- API Resource: `ProductResource`, `CategoryResource`, `ProductImageResource`,
  `ProductVariantResource` — hanya mengekspos field yang ada di kontrak mock
  (mis. Category cuma `id`/`name`/`slug`; variant cuma `size`/`sku`/`stock`).
  Response tetap pakai envelope default Laravel `{ "data": … }`; frontend yang
  meng-unwrap. Tidak ada perbedaan struktur signifikan Eloquent vs mock (Milestone
  4 sudah men-desain mock meniru Eloquent), jadi tak ada penyimpangan yang perlu
  dikompromikan.
- `config/cors.php` dibuat eksplisit: `paths` `api/*`, origin dibatasi ke dev
  Next.js (`localhost:3000` / `127.0.0.1:3000`), method `GET`/`OPTIONS`, TANPA
  wildcard `*` dan tanpa credentials (default Laravel terlalu longgar). CORS ini
  fallback — request utama lewat proxy (same-origin), lihat Bagian B.

Bagian B — Koneksi Next.js:
- **Domain Herd apps/api:** belum ada saat mulai (parked dir `~/Herd` cuma
  meng-serve satu level; root Laravel ada di `velcro/velcro-ethereal/apps/api`
  yang lebih dalam). Dibuat via `herd link velcro-api` → **`http://velcro-api.test`**
  (PHP 8.4). `herd link` ikut menulis `APP_URL` di `.env` (tidak di-commit).
- `next.config.ts`: `rewrites()` proxy `/api/:path*` → `velcro-api.test/api/:path*`
  (env `LARAVEL_API_URL`, fallback ke domain Herd). Tujuan: browser lihat
  same-origin, paritas dengan nginx reverse proxy production (Milestone 2).
- `lib/api.ts`: `getProducts()` / `getProductBySlug()` + `formatRupiah`. Tipe
  di-reuse dari `mock-products.ts` via `import type` (dihapus saat compile → mock
  tidak ikut runtime). Resolusi URL: Server Component fetch Laravel langsung
  (URL relatif tak bisa di-resolve di server); browser pakai `/api/...` same-origin
  (di-proxy rewrites). `cache: "no-store"` supaya data selalu mengikuti DB.

Bagian C — Reorganisasi aset (⚠️ KOREKSI PREMIS TASK): Task mengasumsikan foto
**depan & belakang** Aureus Peacock ada di **dua file di `public/images/product/`**.
Inspeksi visual menunjukkan itu tidak akurat:
- `product/asset_01.jpg` = tampak **depan** (orang menghadap kamera).
- `product/asset_03.jpg` = tampak **depan** juga (varian pose lain) — BUKAN belakang.
- `brand/asset_02.jpg` = tampak **belakang** dengan bordir merak emas (foto ikonik).

Jadi front+back TIDAK dua-duanya di `product/`; foto belakang justru di `brand/`.
Mengikuti niat sebenarnya (pasangan depan + belakang) alih-alih premis yang keliru:
- `product/asset_01.jpg` → `product/aureus-peacock-front.jpg`
- `brand/asset_02.jpg`   → `product/aureus-peacock-back.jpg` (dipindah ke `product/`)
- `product/asset_03.jpg` DIBIARKAN apa adanya (foto depan ekstra; per aturan
  "jangan rename spekulatif", dan Bagian D hanya butuh 2 foto).
Referensi lama hanya ada di `mock-products.ts` (di-update ke 2 path baru). Semua
via `git mv` (histori terjaga).

Bagian D — Seed gambar: `HeritageCollectionSeeder` mengisi `product_images` hanya
untuk Aureus Peacock — 2 baris: front (`sort_order` 0) + back (1). 3 produk lain
(Aurelia, Verdant, Cervus) sengaja `product_images` KOSONG — tidak diisi
placeholder agar API jujur soal foto yang belum ada. `migrate:fresh --seed`:
`product_images` = 2 baris (semuanya milik Aureus), sisa tabel sesuai Milestone 3.

Bagian E — Halaman Shop:
- `/shop` (Server Component): grid 4 produk dari `getProducts()`, design tokens
  Milestone 4. Produk tanpa foto → komponen `PhotoFallback` (panel bertekstur
  garis emas + label "Foto segera hadir"), bukan broken image.
- `/shop/[slug]` (Server Component): `getProductBySlug()`, `notFound()` kalau null.
  Galeri (front+back atau fallback), story, deskripsi, harga, pilihan ukuran dari
  `variants` (stok 0 → di-disable). `params` adalah Promise (Next 16) — di-`await`;
  tipe pakai helper global `PageProps<'/shop/[slug]'>`. Interaksi (pilih ukuran +
  tombol keranjang) diisolasi di client island `ProductPurchasePanel`. Tombol
  "Tambah ke Keranjang" **disabled** berlabel jujur "Segera Hadir" (+ catatan
  "Keranjang & checkout belum tersedia") — cart/checkout milestone terpisah.
- `FeaturedProducts.tsx` (landing) tidak lagi `import mock-products`; menerima
  `products` sebagai props dari `app/page.tsx` (kini Server Component `async` yang
  fetch `getProducts()`). Komponen tetap `"use client"` untuk GSAP, TIDAK fetch
  via `useEffect`. Card juga pakai `PhotoFallback` untuk produk tanpa foto.

Status foto produk: **1 dari 4** produk punya foto asli (Aureus Peacock). 3 lainnya
menunggu product photography asli — ditampilkan dengan fallback jujur, bukan
placeholder yang menyamar sebagai foto.

`mock-products.ts` **DIPERTAHANKAN** sebagai referensi bentuk tipe data (interface
`Mock*` masih jadi single source of truth tipe yang di-reuse `lib/api.ts` via
`import type`), meski **tidak lagi dipakai sebagai sumber data runtime**.

Batasan (sesuai brief, tidak dikerjakan): tidak ada cart/checkout/payment; tidak
ada halaman kategori/filter/search; `mock-products.ts` tidak dihapus; `.env` tidak
di-commit; belum push ke GitHub (langkah manual terakhir).

Verifikasi: `php artisan migrate:fresh --seed` OK (`product_images` 2 baris untuk
Aureus, kosong untuk 3 lainnya). API dicek via `curl`: `/api/products` 200 &
shape sesuai kontrak, `/api/products/{slug}` 200, slug tak dikenal 404, `images`
`[]` untuk produk tanpa foto. `npx tsc --noEmit`, `npm run lint`, dan `npm run
build` (Turbopack, `/`, `/shop`, `/shop/[slug]` = dynamic server-rendered) bersih.
Dev server: `/shop` & `/shop/aureus-peacock-jacket` di-screenshot (1440px) — data
dari DB (bukan mock; dibuktikan 3 produk menampilkan fallback "Foto segera hadir"
yang hanya mungkin dari `images: []` DB), galeri front+back Aureus tampil, tombol
keranjang disabled; landing page tetap tampil benar dengan data API.

---

## Milestone 6 — Footer, Polish Animasi, Simulasi Alur Checkout
**Tanggal:** 8 Juli 2026
**Status:** Selesai

Tiga pekerjaan independen untuk membuat prototipe terasa hidup saat demo ke client.

> ⚠️ **PENTING — Bagian C (alur checkout) adalah SIMULASI MURNI FRONTEND.**
> Cart, checkout, pilihan pembayaran (ala Midtrans Snap), QRIS, sampai halaman
> sukses **TIDAK terhubung ke backend / Midtrans / API order apa pun**. Ini
> PENGECUALIAN SENGAJA dari prinsip "jangan bikin tombol yang terlihat berfungsi
> padahal belum ada backend" (berlaku sejak Milestone 5) — khusus untuk kebutuhan
> demo/pitching. **Jangan salah kira ini production-ready.** Tidak ada order yang
> tersimpan ke database, tidak ada pembayaran nyata yang diproses. Ditandai
> eksplisit di komentar header setiap file terkait (`context/CartContext.tsx`,
> `lib/order.ts`, `ProductPurchasePanel.tsx`, dan semua `app/cart` + `app/checkout/*`).

Bagian A — Footer global (`components/layout/SiteFooter.tsx`, dipasang di root
`layout.tsx` → muncul di semua halaman):
- 4 kolom: (1) wordmark + tagline brand ("Pakaian bordir tangan — warisan yang
  dijahit untuk melampaui musim.", selaras suara Hero/BrandStory, bukan duplikat
  headline "tiga prinsip") + link Instagram (`https://www.instagram.com/velcroethereal`,
  `target="_blank" rel="noopener noreferrer"`); (2) KOLEKSI → Heritage Collection
  (`/shop`); (3) TENTANG → Filosofi Brand (`/#filosofi`) & Craftsmanship
  (`/#craftsmanship`), memakai anchor `id` yang ditambahkan ke section landing;
  (4) KABAR RILIS TERBATAS → input email + tombol Kirim. **Form newsletter
  PLACEHOLDER** — submit tidak ke ESP/backend mana pun, hanya menampilkan
  konfirmasi inline "Terima kasih!" (ditandai di komentar, menunggu integrasi
  email service). Baris copyright: "© 2026 Velcro Ethereal. Limited Production —
  Setiap piece bernomor." Copyright kembar di `ClosingCta` dihapus agar tak dobel.
  Semua warna dari design tokens Milestone 4 (tanpa warna baru).

Bagian B — Polish animasi BrandStory (`components/landing/BrandStory.tsx`).
**Diagnosis dulu** sesuai instruksi:
- Guard reduced-motion di komponen **SUDAH BENAR (bukan logic terbalik)**: animasi
  hanya jalan pada `(prefers-reduced-motion: no-preference)`. Konsekuensinya, kalau
  OS/browser meng-aktifkan Reduce Motion (mis. macOS Accessibility → Display),
  SELURUH animasi section ini memang sengaja mati — **tersangka utama "terasa
  statis", bukan bug**. (Catatan: verifikasi Milestone 4 dulu pakai Chrome
  `--force-prefers-reduced-motion`, jadi screenshot itu memang menampilkan versi
  tanpa animasi.) ScrollTrigger `start "top 80%"` juga sudah wajar; yang kurang
  "kelihatan" adalah headline yang slide TANPA mask (efek samar) & card minim depth.
- Peningkatan: headline SplitText per kata kini pakai **mask per kata** (slide dari
  balik klip-box, jauh lebih tegas) + stagger jelas (power4.out); card 01/02/03
  reveal berurutan dengan translate-y + fade + **scale-in**; micro-interaction hover
  (garis gold tipis "digambar" dari kiri + tint bg + geser judul). Diverifikasi
  render di Chrome (headless, tanpa force reduced-motion): heading & 3 pilar tampil
  penuh setelah masuk viewport.

Bagian C — Simulasi alur checkout (100% frontend, TANPA endpoint API baru):
- **Cart state**: `context/CartContext.tsx` — React Context in-memory, identitas
  item per `sku` (produk+ukuran), aksi add/updateQty/remove/clear, derivasi
  `count`/`subtotal`. **Keterbatasan disengaja & didokumentasikan: isi cart hilang
  saat refresh** (state hanya di memori; persistensi sengaja tidak dibuat).
- **Header global** (`components/layout/SiteHeader.tsx`, fixed): wordmark → landing
  + ikon keranjang dengan badge jumlah item dari context. Belum ada header
  sebelumnya (landing Milestone 4 tanpa nav), jadi dibuat baru.
- `/shop/[slug]`: tombol "Tambah ke Keranjang" **diaktifkan** (sebelumnya disabled
  di Milestone 5) — wajib pilih ukuran dulu (tombol disabled + hint "Pilih ukuran
  terlebih dahulu" sampai dipilih), lalu masuk cart + feedback inline "✓
  Ditambahkan ke keranjang" + link "Lihat keranjang".
- `/cart`: daftar item (foto/fallback, nama, ukuran, harga), qty ±, hapus,
  subtotal, tombol Checkout. `/checkout`: form penerima (nama/telepon/alamat plain
  text, TANPA validasi ongkir — Biteship belum ada) + ringkasan pesanan → "Lanjut
  ke Pembayaran". `/checkout/payment`: pilihan metode ala Midtrans Snap (Virtual
  Account / E-Wallet / QRIS / Kartu Kredit) sebagai radio-card; QRIS → QR code
  (`qrcode.react`, meng-encode string dummy "SIMULATED-ORDER-DO-NOT-SCAN") +
  countdown 15:00 + "Saya Sudah Bayar". `/checkout/success`: "Pesanan Berhasil!" +
  nomor order dummy (timestamp+random, dibawa via query `?order=` dari halaman
  bayar — deterministik antar SSR/hydrate, hindari setState-in-effect) + **reset
  cart** saat termuat.
- Dependency baru: `qrcode.react@4.2.0` (untuk QR simulasi QRIS).

Batasan (sesuai brief, tidak dikerjakan): **tidak ada endpoint API baru di
`apps/api`** (Bagian C murni frontend); tidak ada integrasi Midtrans SDK asli;
tidak ada persistensi cart/order ke DB; `.env` tidak di-commit; belum push ke
GitHub (langkah manual terakhir).

Verifikasi: `npx tsc --noEmit`, `npm run lint`, `npm run build` (Turbopack, 9
route, checkout pages = static/client-rendered) bersih. **Walkthrough alur penuh
via Chrome DevTools Protocol** (navigasi client-side agar cart in-memory tetap
terjaga): add-to-cart disabled sebelum pilih ukuran → pilih M → badge 1 → /cart
tampil item + "Ukuran M" + qty +1 (badge 2, subtotal Rp 1.700.000) → /checkout isi
form → /checkout/payment pilih QRIS → QR + countdown "15:00" tampil → "Saya Sudah
Bayar" → /checkout/success nomor order `VE-…` tergenerate & **cart ter-reset (badge
hilang)**. Footer & BrandStory (heading masked reveal + 3 pilar) tampil benar;
newsletter footer menampilkan "Terima kasih!" setelah submit. Semua di-screenshot.

## Milestone 7 — Halaman /info (Link-in-Bio)
**Tanggal:** 12 Juli 2026
**Status:** Selesai

Halaman standalone yang diakses lewat tap link di bio Instagram — hub link
sementara sambil situs utama masih dalam proses. **BUKAN bagian dari pengalaman
situs utama**: sengaja tidak mewarisi header/footer/cart badge. Prioritas: ringan,
cepat dimuat, mobile-first (halaman ini hampir pasti dibuka dari HP).

Langkah 1 — Restructure layout. Root `app/layout.tsx` dulu me-render
SmoothScrollProvider + CartProvider + SiteHeader + SiteFooter untuk SEMUA halaman.
Dipisah supaya `/info` bisa berdiri sendiri:
- `app/layout.tsx` sekarang **minimal** — hanya `<html>`/`<body>`, font (Geist +
  Cormorant), dan `globals.css` (token). Metadata dasar tetap di sini.
- Chrome situs utama dipindah ke **route group** `app/(main)/layout.tsx`
  (SmoothScroll + Cart + Header + Footer). Layout ini pakai fragment (bukan
  wrapper `div`) agar Header/children/Footer tetap anak langsung
  `<body class="flex flex-col">` — footer tetap terdorong ke bawah lewat
  `main.flex-1` persis seperti sebelum restructure.
- Halaman existing dipindah ke dalam group: `(main)/page.tsx`, `(main)/shop`,
  `(main)/cart`, `(main)/checkout`. Route group `(…)` tidak mengubah URL, jadi
  `/`, `/shop`, `/cart`, `/checkout` **tetap sama** dan tetap tampil header/footer
  (diverifikasi, tanpa regresi).
- `/info` berada DI LUAR `(main)` → hanya mewarisi root layout minimal.

Langkah 2 — `app/info/page.tsx` (Server Component, tanpa GSAP/Lenis).
- `const LINKS` di paling atas file (mudah diedit): whatsapp, shopee, tiktok.
- Header: `next/image` `public/images/brand/asset_06.jpg` — foto **vertikal
  1080×1440**, dipilih beda dari homepage (yang pakai video/hero-poster landscape)
  supaya kedua touchpoint punya nuansa berbeda. Overlay gradient → ink untuk
  keterbacaan, logo teks "VELCRO ETHEREAL" (serif Cormorant) + tagline "Luxury
  Heritage Streetwear" (uppercase, tracking, gold).
- 4 tombol pill (urutan: Website Utama, WhatsApp, Shopee, TikTok). Ikon brand dari
  `react-icons/si` (`SiWhatsapp`, `SiShopee`, `SiTiktok` — Simple Icons punya
  ketiganya; **dependency baru `react-icons@5`**, import per-ikon jadi tree-shake
  bersih). 3 tombol aktif = `<a target="_blank" rel="noopener noreferrer">` dengan
  fill solid `bg-ink-soft` + border gold + hover isi gold. Tombol "Website Utama"
  dibedakan: **border-only tanpa fill + opacity rendah + badge "Segera Hadir"**,
  dan **non-clickable** — `<button disabled>`, bukan `<a>`.
- Footer minimal: copyright singkat saja (TANPA newsletter/kolom nav SiteFooter).

Langkah 3 — Teknis. Reuse token warna & font existing (ink, ink-soft, gold, cream
— tanpa token baru). Animasi ringan: satu keyframe `ve-fade-in-up` di `globals.css`
(CSS murni, fill-mode both, delay staggered inline per elemen; reduced-motion
otomatis dinetralkan guard global). `main` diberi `overflow-x-hidden` sebagai
jaring pengaman; layout `max-w-md` mobile-first, tanpa horizontal overflow di 375px.

**Placeholder — menunggu data asli dari client:** ketiga link (WhatsApp/Shopee/
TikTok) masih placeholder. WhatsApp & Shopee dari brief; **TikTok belum diberikan**
(dipakai `@velcroethereal` sementara). Tombol "Website Utama" sengaja non-aktif
karena **situs utama masih prototipe/simulasi** — checkout belum menerima transaksi
sungguhan (lihat Milestone 6), jadi belum layak diarahkan ke customer.

Batasan (sesuai brief): `apps/api` **tidak disentuh**; halaman existing tidak
diubah selain restructure layout Langkah 1; `.env` tidak di-commit; belum push ke
GitHub (langkah manual terakhir).

Verifikasi: `npx next build` bersih (10 route, `/info` prerendered static; `/`,
`/shop`, `/shop/[slug]` tetap dynamic/SSR seperti sebelumnya). Dev server: `/info`
me-render logo + tagline + 3 link (`wa.me/628131453336`, `id.shp.ee/PF2SRdhu`,
`tiktok.com/@velcroethereal`) + badge "Segera Hadir"; "Website Utama" ter-render
sebagai `<button disabled>` (bukan `<a>`); TANPA newsletter/SiteFooter. Home `/`
tetap membawa SiteHeader (7 link `/shop`) + SiteFooter (Instagram). Screenshot
Chrome headless mengonfirmasi komposisi header + 4 tombol + footer rapi & center.

### Milestone 7b — Backdrop watermark logo /info
Di viewport lebar, kartu konten yang ter-center (`max-w-md`) menyisakan area kosong
flat kiri-kanan. Diisi tekstur latar supaya konsisten dengan DNA visual brand.

**Tiga iterasi ditinggalkan** karena secara visual meleset: (1) SVG lattice diamond
"geometri sakral"; (2) SVG gelombang sinus interpretasi "garis bergelombang";
(3) crop foto bordir "Seafarer Wafe Knit" (`asset_05.jpg`) → luminance mask di atas
layer gold. Semua sisa dihapus: `public/pattern-heritage.svg`,
`public/images/embroidery-texture-source.jpg`, `embroidery-texture-mask.jpg`, dan
CSS `mask-image` terkait.

Iterasi final — **watermark logo asli**, BUKAN pattern/foto buatan:
- Sumber: `public/images/logo/velcro-logo.png` (wordmark "VELCRO ETHEREAL" putih/
  transparan, cocok untuk background gelap).
- Teknik (**hanya di `/info`**): parent `<div aria-hidden>` `fixed inset-0
  overflow-hidden pointer-events-none` (mengurung rotasi → tak ada scroll). Di
  dalamnya child **oversized** `absolute` `w/h-[200%]` di-center (`left/top-1/2` +
  `-translate-1/2`) dengan `background-image` logo, `background-repeat: repeat`,
  `background-size: 300px` (grid rapat, per-instance kecil — ramai tapi bukan satu
  logo raksasa), lalu `rotate(-22deg)`. Oversize 200% + `overflow-hidden` parent →
  rotasi tak menyisakan celah di sudut & tak memunculkan scrollbar. Layer DI ATAS
  warna dasar ink, DI BAWAH konten (`z-10`).
- **Review dua tahap opacity** (sesuai arahan): Tahap 1 `opacity 0.32` untuk menilai
  komposisi (ukuran per-instance, jarak, sudut) → dikonfirmasi oke. Tahap 2
  diturunkan ke `opacity 0.07` sebagai tekstur latar halus. Komposisi (size 300px,
  −22°, oversize 200%) identik di kedua tahap; hanya opacity beda.
- Fokus tetap di konten: opacity rendah + `pointer-events-none`.
- Verifikasi: screenshot Chrome headless **4 kombinasi** (Tahap 1 & Tahap 2 ×
  desktop 1440px & mobile 375px) — watermark diagonal mengisi area kosong,
  terasa sebagai tekstur latar (bukan elemen yang bersaing), foto header & tombol
  tetap fokus utama; tanpa horizontal/vertical scroll dari rotasi. `tsc` + `eslint`
  bersih; `/info` tetap prerendered static. Aset reuse logo yang sudah ada (tak
  menambah file gambar baru).

---

## Milestone 8 — Halaman /coming-soon + Gate Produksi
**Tanggal:** 15 Juli 2026
**Status:** Selesai

Ringkasan: Halaman "segera hadir" (desain "Clock Wall Heritage", dari file
referensi `public/design-reference/` — dihapus setelah build ini selesai,
sesuai instruksi kebersihan) + mekanisme gate yang mengarahkan seluruh route
situs utama ke halaman ini sebelum resmi rilis ke publik.

Bagian A — `app/coming-soon/page.tsx`. Standalone, DI LUAR route group
`(main)` (pola sama seperti `/info` di Milestone 7) — tidak mewarisi
SiteHeader/SiteFooter/cart. Reuse `images/brand/clockwall-bg.jpg` (aset yang
sama dengan `/info`) sebagai background, dengan treatment overlay
(`brightness(.4) saturate(.9)` pada foto + gradient gelap di atasnya) persis
mengikuti file referensi desain.

Penyesuaian dari file referensi (dikonfirmasi user sebelum build):
- **Font Playfair Display** — dipakai untuk wordmark & headline, tapi
  di-load via `next/font/google` **langsung di `page.tsx`**, BUKAN ditambahkan
  ke `app/layout.tsx` root. Supaya halaman lain yang tidak memakai font ini
  tidak ikut menanggung beban loading tambahan — next/font otomatis
  code-split per rute selama tidak diimpor di layout bersama.
- **Warna gold `#c9a961`** — dipertahankan dari referensi, tapi ini
  **PENGECUALIAN DISENGAJA**, bukan token `--color-gold` (`#b8935a`) yang
  dipakai di seluruh halaman lain sejak Milestone 4. Dibatasi hanya untuk
  `/coming-soon`, ditandai eksplisit di komentar `page.tsx` (konstanta
  `CS_GOLD`) — supaya sesi berikutnya tidak salah kira dua warna gold
  berdampingan ini adalah bug yang perlu "diperbaiki" jadi satu token.
- **Tanggal spesifik dihapus.** Referensi asli bertuliskan "Hadir Awal
  Agustus 2026" — diganti "Segera Hadir" (general, tanpa komitmen tanggal)
  supaya halaman tidak perlu di-update ulang kalau timeline rilis bergeser.
- **CTA diperbaiki dari artefak tools desain.** Referensi HTML mengarah ke
  `./Velcro Info 1a - Clock Wall Heritage.dc.html` (link relatif ke file
  mockup desain, tidak valid di aplikasi sungguhan) dan berlabel "Kunjungi
  Halaman Belanja". Diganti label **"More Info"** → `href="/info"` (route
  asli yang sudah ada sejak Milestone 7).

Bagian B — `src/proxy.ts` (⚠️ **BUKAN `middleware.ts`** seperti yang biasa
dikenal di training data/dokumentasi lama Next.js — lihat `apps/web/AGENTS.md`:
codebase ini pakai Next.js 16.2.10, dan sejak v16 konvensi `middleware.ts`
di-deprecate & di-rename jadi `proxy.ts`/`export function proxy` — nama fungsi
JUGA berubah dari `middleware` ke `proxy`, bukan cuma nama file. Dikonfirmasi
langsung dari `node_modules/next/dist/docs/01-app/02-guides/upgrading/
version-16.md` sebelum menulis kode, sesuai instruksi `AGENTS.md`. `middleware.ts`
kemungkinan besar masih akan berjalan sebagai fallback edge-runtime, tapi
konvensi standar & yang didukung penuh sekarang adalah `proxy.ts`.):
- Redirect route `(main)` (`/`, `/shop`, `/shop/:path*`, `/cart`, `/checkout`,
  `/checkout/:path*`) ke `/coming-soon` — daftar route ini dipakai langsung
  sebagai `matcher` (positive list), bukan negative-lookahead di seluruh situs.
  Otomatis mengecualikan `/info`, `/coming-soon` sendiri (cegah redirect loop),
  dan semua asset statis (`_next/*`, favicon, dll) karena memang tidak pernah
  masuk daftar match.
- **Kondisi gate aktif: `NODE_ENV === "production"` DAN
  `NEXT_PUBLIC_SITE_LIVE !== "true"`.** Cek `NODE_ENV` disengaja ditambahkan di
  luar instruksi awal (yang hanya menyebut `NEXT_PUBLIC_SITE_LIVE`) — tanpa itu,
  `npm run dev` lokal ikut ter-gate secara default (env var memang tak pernah
  di-set di dev), padahal requirement eksplisit adalah dev harian TIDAK BOLEH
  ter-gate tanpa setup tambahan apa pun. Konsekuensinya: `npm run build && npm
  start` lokal (stack validasi pra-deploy, lihat Milestone 2) IKUT ter-gate
  secara default — ini disengaja, env-nya paritas dengan production sungguhan.
- **Cara mengaktifkan/menonaktifkan gate (dibutuhkan lagi saat persiapan
  deploy):** set env var `NEXT_PUBLIC_SITE_LIVE=true` di environment
  production (mis. `docker-compose.yml` service `web`, atau `.env` di VPS)
  untuk MEMATIKAN gate & membuka situs utama ke publik. Selama var ini belum
  di-set (atau bernilai selain `"true"`), production build otomatis
  menampilkan `/coming-soon` untuk semua route `(main)`. Tidak perlu diubah
  apa pun untuk dev harian (`npm run dev`) — gate tidak pernah aktif di sana.

Verifikasi: `npx tsc --noEmit`, `npx eslint .`, dan `npm run build` (Turbopack)
bersih — build log mengonfirmasi `proxy.ts` terdeteksi sebagai `ƒ Proxy
(Middleware)` dan `/coming-soon` prerendered static. Perilaku gate dicek di
tiga kondisi via `curl`:
1. `npm run dev` (NODE_ENV development, tanpa `NEXT_PUBLIC_SITE_LIVE`) — `GET /`
   & `GET /shop` → `200`, tanpa redirect. Gate MATI seperti seharusnya.
2. `npm run start` production tanpa `NEXT_PUBLIC_SITE_LIVE` — `GET /` & `GET
   /shop` → `307` ke `/coming-soon`; `GET /info` tetap `200` (tidak ikut
   ter-redirect, tidak ada loop).
3. `npm run start` dengan `NEXT_PUBLIC_SITE_LIVE=true` — `GET /` & `GET /shop`
   → `200`, gate MATI (situs live).

Bagian C — Kebersihan: `public/design-reference/` (file HTML + mockup PNG
acuan desain) dihapus seluruhnya setelah implementasi selesai, sesuai
instruksi task — nilai referensinya sudah terserap ke dalam kode & catatan
milestone ini.

Batasan (sesuai brief, tidak dikerjakan): `/info` tidak disentuh sama sekali
(tetap fully accessible, tidak ikut di-gate); tidak ada commit (menunggu
pengecekan visual manual dari user); `.env` tidak di-commit; belum push ke
GitHub.
