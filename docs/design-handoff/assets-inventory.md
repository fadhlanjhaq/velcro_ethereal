# Assets Inventory — Velcro Ethereal (kondisi repo aktual)

Sumber: scan langsung `apps/web/public/` (satu-satunya folder aset statis di
project — `apps/logo/` di root repo **ada sebagai folder tapi KOSONG**, 0
file, jangan dikira menyimpan aset logo tambahan).

---

## 1. Logo

**Hanya ADA SATU file logo di seluruh repo:**

| File | Format | Dimensi | Catatan |
|---|---|---|---|
| `public/images/logo/velcro-logo.png` | PNG (RGBA, transparan) | 2000×2000 px | Wordmark "VELCRO ETHEREAL", kanvas persegi dengan padding transparan bawaan di sekeliling wordmark (dicatat di komentar kode `/info`: "spek mengukur KANVAS, jadi padding itu ikut jadi ruang di sekitar logo") |

**Ada 1 varian tambahan yang ditemukan setelah dicek visual**:

| File | Format | Dimensi | Catatan |
|---|---|---|---|
| `apps/web/src/app/icon.png` | PNG (hitam di atas putih, bukan transparan) | ~1024×1024 (dipakai Next.js sebagai favicon/app icon otomatis) | Monogram **"VE"** serif — **BUKAN** favicon default `create-next-app` (sudah dicek visual, ini custom brand mark), tapi juga beda gaya dari wordmark utama (monogram vs wordmark penuh) |

Di luar 2 file ini (wordmark PNG 2000×2000 dan monogram "VE" 1024×1024),
**tidak ada varian lain**: tidak ada `.svg`, tidak ada versi horizontal/
vertikal terpisah dari wordmark, tidak ada versi monokrom/dark-on-light vs
light-on-dark yang eksplisit selain kontras hitam-di-atas-putih pada
monogram ini, tidak ada favicon vector.

Ini eksplisit ditulis di sini sesuai instruksi: **jangan mencari logo
generik/pengganti untuk mengisi kekosongan varian format.** Kalau Claude
Design butuh SVG/varian warna, itu harus diminta langsung ke client — tidak
ada di repo.

---

## 2. Foto — `public/images/brand/` (4 file)

| File | Dimensi | Dipakai di | Status |
|---|---|---|---|
| `asset_06.jpg` | 1080×1440 | `Craftsmanship.tsx` (mood/tekstur, dengan parallax) | Foto asli dari batch aset client (bukan stok foto generik) |
| `clockwall-bg.jpg` | 1280×853 | `/info` dan `/coming-soon` (background full-bleed, reused di 2 halaman) | Foto asli |
| `hero-poster.jpg` | 1280×722 | `Hero.tsx` (poster fallback video, di-extract dari frame video di t=2s) | Diturunkan dari video, bukan foto still terpisah |
| `for-info.jpg` | 4533×5666, metadata EXIF Sony ILCE-7M4 + Lightroom | **TIDAK DIPAKAI di kode manapun** (di-grep, 0 hasil) | File resolusi tinggi asli (kemungkinan foto sumber untuk `/info` yang akhirnya tidak jadi dipakai) — aset menganggur, perlu ditanyakan ke tim apakah masih relevan |

## 3. Foto — `public/images/product/` (6 file)

| File | Dimensi | Dipakai di | Status |
|---|---|---|---|
| `asset_03.jpg` | 1080×1440 | Tidak ditemukan referensi di komponen aktif saat ini (kandidat "foto depan ekstra" yang disebut di `docs/MILESTONES.md` Milestone 5 sebagai sengaja dibiarkan, tidak dipakai) | Foto asli, tidak terpakai di UI |
| `asset_04.jpg` | 1080×1440 | `mock-products.ts` (placeholder Aurelia — **tidak dipakai runtime**, lihat catatan di bawah) + `/info` (kartu foto produk, dipakai sungguhan) | Foto asli dari koleksi "Seafarer Wave Knit" — **bukan** produk Heritage Collection, dipakai sebagai placeholder visual |
| `asset_05.jpg` | 1080×1440 | `Craftsmanship.tsx` (close-up tekstur rajut, dipakai sungguhan) + `mock-products.ts` (placeholder Verdant — tidak dipakai runtime) | sda |
| `asset_07.jpg` | 1080×1440 | `mock-products.ts` (placeholder Cervus — **tidak dipakai runtime**, karena runtime pakai API/DB yang `images: []` untuk produk ini) | Foto asli, hanya hidup di mock, tidak pernah tampil ke user di kondisi sekarang |
| `aureus-peacock-front.jpg` | 1080×1440 | `/shop`, `/shop/aureus-peacock-jacket`, landing `FeaturedProducts` — **satu-satunya produk dengan foto asli yang benar-benar tampil di UI produksi** | Foto asli, tampil |
| `aureus-peacock-back.jpg` | 1080×1440 | sda (foto ke-2 di galeri produk) | Foto asli, bordir merak emas — foto paling ikonik yang ada |

**Poin penting untuk desain**: dari 6 foto produk yang ada secara fisik di
folder, **hanya 2 (front+back Aureus Peacock) yang benar-benar tampil ke user
di kondisi produksi saat ini**, karena data runtime bersumber dari API/DB
(bukan `mock-products.ts`), dan DB (`HeritageCollectionSeeder`) hanya mengisi
foto untuk Aureus Peacock. Foto `asset_04/05/07.jpg` masih ada secara fisik
tapi **tidak pernah dirender di halaman produk** — mereka hanya hidup di
`mock-products.ts` yang sekarang cuma jadi referensi tipe, bukan sumber
tampilan.

**Watermark & caption terbakar (burned-in)**: dicatat eksplisit di
`docs/MILESTONES.md` (Milestone 4) — semua foto/video sumber punya watermark
"Velcro Ethereal" + teks semacam "Velcro Collections on 2026" atau nama
produk yang **sudah baked-in ke pixel**, bukan overlay UI yang bisa dilepas.
Untuk versi produksi final, tim disarankan minta **master foto/video bersih
tanpa watermark/caption** dari client.

---

## 4. Video — `public/videos/` (4 file, semua MP4)

| File | Ukuran | Dipakai di | Catatan |
|---|---|---|---|
| `asset_video01.mp4` | 5.3 MB | Tidak dipakai di komponen manapun saat ini | Landscape, shot grup outdoor — dipertimbangkan untuk hero tapi tidak dipilih (terlalu ramai/terang) |
| `asset_video02.mp4` | 4.6 MB | Tidak dipakai | Portrait, detail denim |
| `asset_video03.mp4` | 3.4 MB | **`Hero.tsx`** — satu-satunya video yang dipakai, sebagai background hero landing | Landscape 1280×722, mood "brand film" interior restoran |
| `asset_video04.mp4` | 2.4 MB | Tidak dipakai | Portrait, topi/varsity |

Sama seperti foto: video sumber juga punya **subtitle auto-caption
terbakar-in** (mis. "Elegance and Luxury", "Premium Tailoring") — disamarkan
di hero pakai scrim gradient + tint, bukan dihilangkan dari sumbernya.

---

## 5. Aset lain (bukan brand asset, bawaan scaffold)

`public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`,
`public/window.svg` — ini adalah **ikon default bawaan `create-next-app`**,
bukan aset desain Velcro Ethereal. Tidak dipakai di halaman manapun yang
sudah dibangun (sisa dari scaffold awal). Bisa diabaikan/dihapus, bukan
bagian dari sistem visual brand.

---

## Ringkasan untuk tim desain

- **Logo: 2 file PNG saja (wordmark 2000×2000 + monogram "VE" 1024×1024),
  tanpa varian format/warna lain.** Jangan cari pengganti — minta versi
  SVG/varian warna dari client langsung kalau dibutuhkan.
- **Foto produk asli: hanya 2 foto (front+back 1 produk dari 4).** 3 produk
  lain benar-benar tanpa foto di kondisi sekarang (bukan sekadar "belum
  di-assign" — datanya kosong di DB).
- **Foto brand/mood (non-produk): 4 file, cukup untuk kebutuhan section
  Craftsmanship/hero-poster/link-in-bio saat ini**, tapi semuanya beresolusi
  moderat (1080–1440 px sisi terpanjang) dan berwatermark burned-in — belum
  siap untuk cetak/aset resolusi tinggi bersih.
- **1 file foto (`for-info.jpg`, resolusi tinggi 4533×5666) menganggur, tidak
  dipakai di kode manapun** — worth ditanyakan ke developer/client apakah ini
  seharusnya dipakai di suatu tempat.
- **Video: 4 file ada, hanya 1 dipakai** (hero). 3 sisanya tersedia sebagai
  bahan mentah kalau desain baru ingin memakainya di section lain.
