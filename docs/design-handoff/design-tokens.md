# Design Tokens — Velcro Ethereal (kondisi repo aktual)

## Sumber

**Tidak ada `tailwind.config.ts` / `tailwind.config.js` di repo ini.** Project
memakai **Tailwind CSS v4** (`"tailwindcss": "^4"` di `apps/web/package.json`),
yang tidak lagi memakai file config JS — token didefinisikan langsung sebagai
CSS `@theme` di satu file:

**`apps/web/src/app/globals.css`** (baris 22–34)

Ini **satu-satunya sumber token warna/font** di seluruh `apps/web`. Tidak ada
file token terpisah lain (tidak ada `theme.ts`, `design-tokens.json`, dsb).

Komentar di baris 1–20 file yang sama secara eksplisit menyatakan:

> "Palet diturunkan dari brand DNA (heritage / artisan / ethereal, aksen emas
> bordir)... Warna & copy pada landing ini masih **placeholder** dan **HARUS
> dikonfirmasi ulang** saat brand guideline final tersedia."

Jadi token di bawah ini adalah **asumsi kerja developer**, bukan hasil dari
brand book resmi client.

---

## 1. Warna custom

```css
@theme {
  --color-ink:       #1c1712;  /* espresso-black — background utama */
  --color-ink-soft:  #2b241c;  /* card di atas dark bg */
  --color-gold:      #b8935a;  /* aksen heritage/artisan */
  --color-gold-dark: #8c6d3f;  /* teks gold di atas background terang */
  --color-green:     #44543a;  /* aksen sekunder */
  --color-cream:     #f3ede1;  /* background terang / teks di atas dark */
}
```

Dipakai di komponen via utility class Tailwind v4 hasil auto-generate dari
nama token: `bg-ink`, `text-cream`, `border-gold`, `text-gold-dark`, dst
(cek langsung di komponen, mis. `bg-ink-soft`, `text-cream/70`, `border-gold/25`).

### Cocokkan dengan brief "4 brand color" (espresso-black, gold, deep green, cream)

| Brief client | Token di kode | Cocok? |
|---|---|---|
| Espresso Black | `--color-ink` `#1c1712` | Ya (nama token beda: "ink", bukan "espresso-black") |
| Gold | `--color-gold` `#b8935a` | Ya, plus turunan `--color-gold-dark` `#8c6d3f` yang **tidak disebut** di brief |
| Deep Green | `--color-green` `#44543a` | Ya (nama token beda: "green", bukan "deep-green") |
| Cream | `--color-cream` `#f3ede1` | Ya |

Catatan penting:
- Ada **1 warna tambahan di luar 4 brand color**: `--color-ink-soft` `#2b241c`,
  dipakai sebagai warna card/surface di atas background gelap. Ini turunan
  teknis (lebih terang dari `ink` untuk kontras kartu), bukan warna brand
  kelima yang resmi.
- **`/coming-soon` punya 1 warna gold BERBEDA yang sengaja tidak masuk token
  global**: `#c9a961` (konstanta `CS_GOLD` di `app/coming-soon/page.tsx`,
  baris 49), diambil persis dari file referensi desain yang sudah dihapus.
  Ini **pengecualian yang disengaja** (dikomentari eksplisit di kode: "jangan
  diperbaiki jadi token gold biasa"), bukan bug — tapi berarti ada 2 nilai
  gold berbeda hidup berdampingan di codebase (`#b8935a` di semua halaman
  lain, `#c9a961` hanya di `/coming-soon`). Perlu diklarifikasi ke client mana
  yang jadi standar final.
- Nama semantik token (`ink`, bukan `espresso-black`) berarti kalau Claude
  Design butuh mapping by-name persis ke istilah brief, itu harus di-alias
  manual — di kode saat ini pemetaannya hanya by-value (hex), bukan by-name.

---

## 2. Font family

```css
--font-serif: var(--font-cormorant), Cambria, Georgia, "Times New Roman", serif;
--font-sans:  var(--font-geist-sans), Calibri, system-ui, -apple-system, sans-serif;
```

- **Brief asli minta Cambria (heading) + Calibri (body)** — keduanya font
  sistem Microsoft, TIDAK tersedia sebagai web font (bukan di Google Fonts).
  Developer **mengganti**:
  - Heading → **Cormorant Garamond** (via `next/font/google`, di-load di
    `app/layout.tsx`, weight 400/500/600/700)
  - Body → **Geist Sans** (via `next/font/google`, sudah ada sejak scaffold
    `create-next-app`)
  - Cambria/Calibri tetap dicantumkan sebagai fallback stack CSS (kalau
    device user kebetulan punya font itu terpasang lokal), tapi **tidak
    pernah di-load sebagai web font**.
- **Pengecualian: `/coming-soon` pakai font ketiga**, **Playfair Display**
  (juga via `next/font/google`), di-scope hanya ke halaman itu (di-load
  langsung di `app/coming-soon/page.tsx`, bukan di root layout) supaya
  halaman lain tidak ikut menanggung beban loading font tambahan.

Ringkasan: **3 font family total hidup di codebase** — Cormorant Garamond
(heading, situs utama), Geist Sans (body, situs utama), Playfair Display
(khusus `/coming-soon`). Ini perlu dikonfirmasi ke client apakah situs utama
akan tetap Cormorant, atau ikut pindah ke Playfair seperti coming-soon.

---

## 3. Breakpoint

**Tidak ada breakpoint custom** di `@theme` — project pakai breakpoint default
Tailwind v4 (`sm`, `md`, `lg`, `xl`, `2xl`) tanpa override.

Pengecualian: halaman `/info` pakai **1 breakpoint arbitrary Tailwind**
`min-[900px]:` (bukan `md:`/`lg:` default) untuk transisi mobile→desktop,
dipilih manual mengikuti spek desain referensi halaman itu — bukan token
breakpoint resmi yang didefinisikan di `@theme`, jadi tidak reusable di
komponen lain tanpa mengetik ulang angka `900px`.

---

## 4. Elemen visual lain yang di-hardcode inline (bukan token)

Karena tidak ada file token terpisah, hal-hal berikut **hidup sebagai nilai
inline per komponen**, bukan sebagai token reusable:
- Gradient overlay foto (`/info`, `/coming-soon`) — masing-masing punya nilai
  `rgba(...)` sendiri, ditulis ulang per file, tidak di-share.
- Radius, shadow (`shadow-[0_10px_30px_rgba(0,0,0,.4)]` di `/info`) — arbitrary
  value Tailwind per elemen, bukan token skala shadow global.
- Warna gold kedua `#c9a961` (lihat bagian 1) — hardcoded sebagai konstanta
  lokal di 1 file, bukan token.

Kalau Claude Design ingin membangun sistem token yang lebih formal (skala
shadow, radius, gradient), ini **belum ada** di repo dan perlu dibangun dari
nol — bukan migrasi dari sistem yang sudah ada.
