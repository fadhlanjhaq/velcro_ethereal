# Sitemap — Velcro Ethereal (kondisi repo aktual)

Sumber: scan langsung `apps/web/src/app/**/page.tsx` pada commit `125682d`
(branch `main`, per 2026-07-25). Ini BUKAN daftar rencana dari `docs/SOT.md` —
SOT berisi scope produk lengkap (auth, wishlist, search/filter, dll) yang
**belum diimplementasikan di frontend**. Daftar di bawah murni route yang
punya `page.tsx` sungguhan.

## Ringkasan status

| Route | File | Status | Sumber data |
|---|---|---|---|
| `/` | `app/(main)/page.tsx` | **LIVE** | API Laravel (`getProducts()`) |
| `/shop` | `app/(main)/shop/page.tsx` | **LIVE** | API Laravel (`getProducts()`) |
| `/shop/[slug]` | `app/(main)/shop/[slug]/page.tsx` | **LIVE** | API Laravel (`getProductBySlug()`) |
| `/cart` | `app/(main)/cart/page.tsx` | **LIVE (UI), SIMULASI (data)** | in-memory React Context, hilang saat refresh |
| `/checkout` | `app/(main)/checkout/page.tsx` | **LIVE (UI), SIMULASI (data)** | form lokal, tidak di-submit ke mana pun |
| `/checkout/payment` | `app/(main)/checkout/payment/page.tsx` | **LIVE (UI), SIMULASI (data)** | tidak ada payment gateway asli |
| `/checkout/success` | `app/(main)/checkout/success/page.tsx` | **LIVE (UI), SIMULASI (data)** | nomor order acak, tidak tersimpan ke DB |
| `/info` | `app/info/page.tsx` | **LIVE** | konten statis (link-in-bio) |
| `/coming-soon` | `app/coming-soon/page.tsx` | **LIVE**, tapi hanya diakses lewat gate produksi | konten statis |

Tidak ada halaman dengan `page.tsx` kosong/stub murni — semua route di atas
punya UI nyata. Yang "belum nyata" bukan di level halaman, tapi di level
**fungsionalitas transaksi** (lihat kolom "SIMULASI" di atas dan detail per
halaman di bawah).

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
- Tombol "Tambah ke Keranjang" (`ProductPurchasePanel`, client island):
  **aktif secara UI** sejak Milestone 6, tapi hanya mengisi cart in-memory —
  **tidak ada order yang benar-benar dibuat**.
- **LIVE**.

### `/cart` — Keranjang
- Client Component. State dari `CartContext` (React Context murni, tanpa
  persistence — refresh = kosong lagi, disengaja).
- **LIVE (UI)**, ditandai eksplisit di komentar kode sebagai **SIMULASI**
  demo/pitching, bukan e-commerce fungsional.

### `/checkout` — Alamat pengiriman
- Client Component. Form nama/telepon/alamat plain text, **tanpa validasi
  ongkir** (Biteship belum diintegrasi). Submit form **tidak melakukan POST
  apa pun** — langsung `router.push("/checkout/payment")`.
- **LIVE (UI), SIMULASI (data)**.

### `/checkout/payment` — Metode pembayaran
- Client Component. Tampilan meniru Midtrans Snap (VA/E-Wallet/QRIS/Kartu),
  tapi **tidak ada payment gateway asli**. QRIS meng-encode string dummy
  `"SIMULATED-ORDER-DO-NOT-SCAN"` — sengaja tidak bisa dipindai untuk
  transaksi nyata.
- **LIVE (UI), SIMULASI (data)**.

### `/checkout/success` — Konfirmasi pesanan
- Nomor order dibuat client-side (timestamp + random) lewat query param
  `?order=`, **tidak ada order yang tersimpan ke database**. Cart di-reset
  saat halaman ini dimuat.
- **LIVE (UI), SIMULASI (data)**.

### `/info` — Link-in-bio
- Server Component, berdiri sendiri (di luar route group `(main)`) — **tidak
  mewarisi SiteHeader/SiteFooter/cart**. Dibuka lewat bio Instagram.
- Isi: logo, 1 foto produk, tagline, 4 tombol (Website Utama — **disabled**,
  WhatsApp, Shopee, TikTok — 3 tombol terakhir aktif `<a target="_blank">`).
- Link WhatsApp & Shopee dari brief client; **link TikTok masih placeholder**
  (`@velcroethereal`, belum dikonfirmasi client — lihat komentar di kode).
- **LIVE**, tombol "Website Utama" sengaja **DISABLED** (badge "Coming Soon")
  karena situs utama masih dianggap prototipe/simulasi.

### `/coming-soon` — Gate produksi
- Server Component, berdiri sendiri (di luar route group `(main)`).
- Halaman "segera hadir" — di-redirect otomatis ke sini dari seluruh route
  `(main)` (`/`, `/shop`, `/shop/*`, `/cart`, `/checkout`, `/checkout/*`) lewat
  `src/proxy.ts` (nama baru untuk `middleware.ts` di Next.js 16), **HANYA
  saat** `NODE_ENV=production` DAN `NEXT_PUBLIC_SITE_LIVE !== "true"`.
- Di **dev lokal (`npm run dev`), gate ini tidak pernah aktif** — semua route
  `(main)` bisa diakses langsung.
- CTA satu-satunya: "More Info" → `/info`.
- **LIVE**.

---

## Route yang DISEBUT di SOT.md tapi BELUM ADA sebagai halaman nyata

Untuk konteks scope penuh (lihat `docs/SOT.md`), fitur-fitur berikut
direncanakan tapi **belum punya `page.tsx`**:
- Login/register, riwayat order, wishlist (Autentikasi & Akun)
- Search & filter produk (kategori, ukuran, warna, rentang harga)
- Halaman konten: About Us, Size Guide, Kebijakan Retur, Privacy Policy,
  Kontak & FAQ
- Admin panel (Filament — terpisah dari `apps/web`, belum ada implementasi
  yang teramati di repo ini)

Jangan asumsikan halaman-halaman ini "hampir jadi" — mereka **tidak ada sama
sekali** di kode saat ini.
