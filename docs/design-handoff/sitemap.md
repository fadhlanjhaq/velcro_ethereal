# Sitemap — Velcro Ethereal (kondisi repo aktual)

Sumber: scan `apps/web/src/app/**/page.tsx` dan `src/proxy.ts`, disinkronkan
dengan kondisi production per **3 Oktober 2026** (setelah Milestone 10). Ini
BUKAN daftar rencana dari `docs/SOT.md` — SOT berisi scope produk lengkap
(auth, wishlist, search/filter, dll) yang sebagian **belum diimplementasikan**.
Daftar di bawah murni route yang punya `page.tsx` sungguhan.

## Ringkasan status

| Route | File | Status | Sumber data |
|---|---|---|---|
| `/` | `app/(main)/page.tsx` | **LIVE** | API Laravel (`getProducts()`, `getSiteContent()`) |
| `/shop` | `app/(main)/shop/page.tsx` | **LIVE** | API Laravel (`getProducts()`) |
| `/shop/[slug]` | `app/(main)/shop/[slug]/page.tsx` | **LIVE** | API Laravel (`getProductBySlug()`) |
| `/cart` | `app/(main)/cart/page.tsx` | **LIVE** | React Context di browser (tidak persisten, hilang saat refresh) |
| `/checkout` | `app/(main)/checkout/page.tsx` | **LIVE** | `POST /api/orders` → order tersimpan + Snap token. **Ongkir belum ada** |
| `/checkout/payment` | `app/(main)/checkout/payment/page.tsx` | **LIVE** | Midtrans Snap (production) |
| `/checkout/success` | `app/(main)/checkout/success/page.tsx` | **LIVE** | nomor order dari backend |
| `/kontak` | `app/(main)/kontak/page.tsx` | **LIVE** | CMS (`getSiteContent()`, section contact) |
| `/shop-segera` | `app/(main)/shop-segera/page.tsx` | **Dormant** (saklar darurat) | statis; hanya tampil bila shop ditutup |
| `/info` | `app/info/page.tsx` | **LIVE** | konten statis (link-in-bio) |
| `/coming-soon` | `app/coming-soon/page.tsx` | **Dormant** di production sekarang | statis; hanya tampil bila `NEXT_PUBLIC_SITE_LIVE` bukan `true` |

Selain halaman storefront ada **admin Filament** di `/admin` (dilayani Laravel,
bukan `apps/web`): Produk, Kategori, Order, dan halaman Site Content.

Status gate di production saat ini: `SITE_LIVE=true` dan `SHOP_OPEN=true`,
sehingga `/coming-soon` dan `/shop-segera` tidak tampil. Keduanya sengaja
dipertahankan sebagai saklar darurat (tertanam saat build, ubah = build ulang
image web; lihat `docs/deploy.md`).

---

## Detail per halaman

### `/` — Landing
- Server Component, `async function Home()`.
- Fetch `getProducts()` dari `lib/api.ts` → Laravel API asli (bukan mock).
- Section: `Hero` (video + poster), `BrandStory`, `FeaturedProducts` (pakai data
  produk asli), `Craftsmanship`, `ClosingCta`.
- **LIVE** — halaman paling matang, sudah lewat 1 iterasi polish animasi
  (Milestone 6, Bagian B).

### `/shop` — Katalog
- Server Component. Fetch `getProducts()`. Grid 4 kartu produk (dari DB).
- Produk tanpa foto (`images: []`) render `PhotoFallback` (panel "Foto segera
  hadir"), bukan gambar rusak/placeholder generik.
- **LIVE**.

### `/shop/[slug]` — Detail produk
- Server Component. `getProductBySlug(slug)`, `notFound()` (404 Next.js
  bawaan) kalau slug tak ada.
- Galeri foto (atau fallback), story, deskripsi, harga, pilihan ukuran.
- Tombol "Tambah ke Keranjang" (`ProductPurchasePanel`, client island): mengisi
  cart di browser; order baru dibuat saat checkout.
- **LIVE**.

### `/cart` — Keranjang
- Client Component. State dari `CartContext` (React Context, tanpa persistence —
  refresh = kosong lagi, disengaja).
- **LIVE**. Harga final selalu diambil dari DB oleh backend saat checkout, bukan
  dari cart.

### `/checkout` — Data pembeli & alamat
- Client Component. Form nama/email/telepon/alamat. Submit → `POST /api/orders`
  (`postOrder`) dengan `idempotency_key`; backend membuat order, memvalidasi stok
  dan total, lalu meminta Snap token Midtrans.
- **Belum ada pemilihan kurir dan perhitungan ongkir** (Biteship belum
  terintegrasi; `shipping_cost` = 0, data kurir kosong). Menjadi pekerjaan
  berikutnya (lihat `docs/BACKLOG.md`).
- **LIVE**.

### `/checkout/payment` — Pembayaran
- Client Component. Membuka Midtrans Snap popup memakai token dari langkah
  sebelumnya (production). Tidak ada UI pemilihan metode buatan sendiri; metode
  dipilih di dalam Snap.
- **LIVE**.

### `/checkout/success` — Konfirmasi pesanan
- Menampilkan nomor order dari backend (`?order=`). Status akhir pembayaran
  ditentukan webhook Midtrans, bukan halaman ini. Belum ada email konfirmasi ke
  pembeli.
- **LIVE**.

### `/kontak` — Kontak
- Server Component, `force-dynamic`. Seluruh isi (WhatsApp, alamat, email,
  telepon, kanal sosial) dikelola dari admin lewat CMS; field kosong tidak
  ditampilkan. Tombol WhatsApp mengambang tampil di layout `(main)`.
- **LIVE**.

### `/shop-segera` — Shop ditutup (dormant)
- Tujuan redirect `proxy.ts` untuk `/shop`, `/cart`, `/checkout` bila
  `NEXT_PUBLIC_SHOP_OPEN` bukan `true`. Saat ini tidak tampil di production.

### `/info` — Link-in-bio
- Server Component, berdiri sendiri (di luar route group `(main)`) — **tidak
  mewarisi SiteHeader/SiteFooter/cart**. Dibuka lewat bio Instagram.
- Isi: logo, 1 foto produk, tagline, 4 tombol (Website Utama — **masih
  disabled**, WhatsApp, Shopee, TikTok — 3 tombol terakhir aktif
  `<a target="_blank">`).
- Link WhatsApp & Shopee dari brief client; **link TikTok masih placeholder**
  (`@velcroethereal`, belum dikonfirmasi client — lihat komentar di kode).
- **LIVE**. Tombol "Website Utama" masih **DISABLED** (badge "Coming Soon").
  Alasan awalnya (situs utama masih simulasi) sudah tidak berlaku sejak
  checkout live, tetapi tombol sengaja belum dibuka sampai ongkir dan email
  konfirmasi selesai dan situs siap dipublikasikan ke media (lihat
  `docs/BACKLOG.md`).

### `/coming-soon` — Gate produksi
- Server Component, berdiri sendiri (di luar route group `(main)`).
- Halaman "segera hadir" — di-redirect otomatis ke sini dari seluruh route
  `(main)` (`/`, `/shop`, `/shop/*`, `/cart`, `/checkout`, `/checkout/*`, `/kontak`) lewat
  `src/proxy.ts` (nama baru untuk `middleware.ts` di Next.js 16), **HANYA
  saat** `NODE_ENV=production` DAN `NEXT_PUBLIC_SITE_LIVE !== "true"`.
- Di **dev lokal (`npm run dev`), gate ini tidak pernah aktif** — semua route
  `(main)` bisa diakses langsung.
- CTA satu-satunya: "More Info" → `/info`.
- **Dormant di production sekarang** (`SITE_LIVE=true`); tetap berfungsi bila
  dibutuhkan lagi.

---

## Route yang DISEBUT di SOT.md tapi BELUM ADA sebagai halaman nyata

Untuk konteks scope penuh (lihat `docs/SOT.md`), fitur-fitur berikut
direncanakan tapi **belum punya `page.tsx`**:
- Login/register, riwayat order, wishlist (Autentikasi & Akun) — sengaja
  guest-only dulu; skema akun pembeli menunggu keputusan owner
- Search & filter produk (kategori, ukuran, warna, rentang harga)
- Halaman konten: About Us, Size Guide, Kebijakan Retur, Privacy Policy,
  Syarat & Ketentuan, FAQ (hanya `/kontak` yang sudah ada). Privacy Policy dan
  S&K disyaratkan Midtrans.

Jangan asumsikan halaman-halaman ini "hampir jadi" — mereka **tidak ada sama
sekali** di kode saat ini.
