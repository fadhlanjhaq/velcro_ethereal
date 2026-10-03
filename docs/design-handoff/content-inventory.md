# Content Inventory — Velcro Ethereal (kondisi repo aktual)

Sumber dibandingkan:
1. **Frontend mock**: `apps/web/src/lib/mock-products.ts`
2. **DB seeder** (sumber data runtime sungguhan): `apps/api/database/seeders/HeritageCollectionSeeder.php` + `CategorySeeder.php`

**Catatan arsitektur penting**: sejak Milestone 5, frontend **tidak lagi
memakai `mock-products.ts` sebagai sumber data runtime**. `/`, `/shop`, dan
`/shop/[slug]` fetch data asli dari API Laravel (`lib/api.ts` → `GET
/api/products`, `GET /api/products/{slug}`), yang dibangun dari data seeder di
bawah. `mock-products.ts` **dipertahankan hanya sebagai referensi bentuk tipe
data** (`import type` di `lib/api.ts`) — isinya sengaja dibuat identik dengan
seeder supaya tidak ada kejutan bentuk data saat swap ke API asli.

## Status saat laporan ini dibuat

Database lokal (MySQL via DBngin, `127.0.0.1:3311`) **sedang tidak berjalan**
saat pengecekan ini (`Connection refused`) — lihat catatan di
`screenshots/README.md`. Isi di bawah diambil dari **membaca kode seeder
langsung**, bukan dari query live ke DB.

---

## Kategori

Dari `CategorySeeder.php` — **3 kategori dibuat**: `Baju`, `Jaket`, `Celana`.

**Hanya kategori "Jaket" yang punya produk.** `Baju` dan `Celana` ada sebagai
baris kategori kosong (0 produk) — bukan tebakan, ini eksplisit dari kode:
`HeritageCollectionSeeder` hanya mengisi produk dengan `category_id` milik
`Jaket`.

`mock-products.ts` bahkan tidak mendefinisikan kategori Baju/Celana sama
sekali — hanya `JAKET` yang di-hardcode sebagai satu-satunya `MockCategory`
yang dipakai.

**Kesimpulan: koleksi yang benar-benar ada sekarang HANYA "Heritage
Collection" berupa jaket. Tidak ada produk kategori Baju atau Celana.**

---

## Produk — 4 item, identik di mock vs seeder (dengan 1 perbedaan foto)

| # | Nama | Slug | SKU prefix | Colorway/motif |
|---|---|---|---|---|
| 1 | Aurelia Knotwork Jacket | `aurelia-knotwork-jacket` | `VE-AKJ-*` | Beige Brown, bordir simpul keemasan |
| 2 | Verdant Knotwork Jacket | `verdant-knotwork-jacket` | `VE-VKJ-*` | Forest Green, bordir simpul hijau |
| 3 | Cervus Grove Jacket | `cervus-grove-jacket` | `VE-CGJ-*` | motif rusa (cervus), hutan sakral |
| 4 | Aureus Peacock Jacket | `aureus-peacock-jacket` | `VE-APJ-*` | motif merak emas (aureus) |

Semua 4 produk: kategori **Jaket**, 4 varian ukuran **S/M/L/XL**, stok **10
per varian** (angka bulat, kemungkinan besar juga placeholder — tidak ada
catatan di kode yang menyebut ini stok riil).

### Deskripsi & story

Semua deskripsi & story adalah kalimat pendek Bahasa Indonesia yang ditulis
manual oleh developer (bukan lorem ipsum, tapi juga **bukan copy resmi dari
client** — tidak ada anotasi di kode yang mengklaim ini dari brief). Contoh:

- Aurelia: *"Jaket dengan colorway Beige Brown, dihiasi bordir motif simpul
  keemasan."* / story: *"Jaket bordir simpul keemasan yang mewah"*
- Aureus Peacock: *"Jaket bermotif burung merak (aureus/emas), terinspirasi
  keindahannya."* / story: *"Aureus (emas) — terinspirasi keindahan burung
  merak"*

Isi identik persis antara `mock-products.ts` dan `HeritageCollectionSeeder.php`
(disalin manual, dicatat eksplisit di komentar mock). **Belum ada deskripsi
produk versi panjang/marketing copy** — yang ada hanya 1 kalimat deskripsi +
1 kalimat story per produk.

### Harga — PLACEHOLDER eksplisit

**Semua 4 produk: `base_price = Rp 850.000`, identik.** Ditandai eksplisit di
kedua sumber sebagai `PLACEHOLDER_BASE_PRICE`:
- Seeder: `private const PLACEHOLDER_BASE_PRICE = 850000;` dengan komentar
  *"belum final, menunggu pricelist asli dari client."*
- Mock: konstanta sama dengan komentar identik.

**Tidak ada variasi harga antar produk** — ini bukan strategi pricing nyata,
murni angka bulat sementara.

### Foto produk — INI PERBEDAAN UTAMA antara mock dan seeder

| Produk | Seeder (`product_images` di DB) | `mock-products.ts` |
|---|---|---|
| Aurelia Knotwork | **kosong** (`[]`) — sengaja tidak diisi | `/images/product/asset_04.jpg` (placeholder, ditandai di komentar) |
| Verdant Knotwork | **kosong** (`[]`) | `/images/product/asset_05.jpg` (placeholder) |
| Cervus Grove | **kosong** (`[]`) | `/images/product/asset_07.jpg` (placeholder) |
| Aureus Peacock | 2 foto asli: front + back | 2 foto asli: front + back (sama) |

**Ini bukan bug/inkonsistensi tanpa dokumentasi** — dicatat eksplisit di kedua
file:
- Seeder: *"3 produk lain sengaja TANPA foto (product_images kosong) — jangan
  diisi placeholder agar API jujur soal foto yang belum ada."*
- Mock: *"foto yang dipakai di sini adalah PLACEHOLDER dari aset lain (a.l.
  koleksi 'Seafarer Wave Knit' yang bukan bagian Heritage) semata untuk
  mengisi layout prototipe."*

Karena **data runtime sekarang berasal dari API/DB (seeder), bukan mock**,
artinya **di UI sungguhan (browser), 3 dari 4 produk TIDAK menampilkan foto
sama sekali** — mereka jatuh ke komponen `PhotoFallback` ("Foto segera hadir")
di `/shop` dan `/shop/[slug]`. Hanya **Aureus Peacock Jacket** yang punya foto
produk asli tampil di UI.

---

## Ringkasan untuk tim desain

- **1 koleksi saja**: "Heritage Collection", semuanya kategori Jaket. Kategori
  Baju & Celana ada di skema tapi 0 produk.
- **4 nama produk**, semua sudah final secara penamaan (tidak ada indikasi
  akan berubah).
- **Harga: SEMUA placeholder Rp 850.000** — jangan dipakai sebagai acuan
  strategi harga/layout differensiasi harga, tunggu pricelist client.
- **Deskripsi/story: pendek, bukan lorem ipsum, tapi juga bukan copy final
  dari client** — kemungkinan perlu di-refine bersama copywriter/client.
- **Foto produk: hanya 1 dari 4 produk (Aureus Peacock) yang punya foto
  asli.** 3 produk lain akan tampil sebagai fallback text-only di produksi
  sekarang. Desain UI perlu mengakomodasi kondisi "produk tanpa foto" sebagai
  state yang realistis, bukan edge case langka.
