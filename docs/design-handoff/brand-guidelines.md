# Brand Guidelines — Velcro Ethereal (kondisi repo aktual)

## Status: BELUM ADA brand guideline formal di repo

Sudah dicek di seluruh repo (`docs/`, root, `apps/web`, `apps/api`) untuk file
brand book, moodboard, atau guideline resmi — mencari nama file yang
mengandung "brand", "guideline", "moodboard", atau file `.pdf` mana pun.
**Tidak ditemukan satu pun.**

Yang **ada** hanyalah:

1. **`docs/SOT.md` §2 "Brand Identity"** — ringkasan brand DNA yang
   dikonfirmasi berasal dari *"dokumen brand identity awal (PDF client)"*
   (dicatat eksplisit di §2.4 "Catatan Sumber"), tapi **PDF aslinya sendiri
   tidak ada di repo** — hanya ringkasannya yang dituliskan ulang ke SOT.
   Isinya:
   - Tagline: *"Every Creation Holds Meaning."*
   - Positioning statement (ID & EN) — 1 paragraf masing-masing.
   - 3 pilar DNA: **Heritage** (ornamen Nusantara/celtic knot/geometri sakral),
     **Artisan** (bordir detail, produksi terbatas), **Eternal** (timeless,
     lintas musim).
   - Target market: usia 24–45, pengusaha/kreatif profesional/kolektor
     fashion — bukan pasar streetwear massal.

2. **`apps/web/src/app/globals.css`** — implementasi visual (warna, font) yang
   dibuat developer **berdasarkan interpretasi** brand DNA di atas, ditandai
   eksplisit di komentar file itu sendiri sebagai *"ASUMSI AWAL, BUKAN brand
   guideline resmi dari client"* dan *"HARUS dikonfirmasi ulang saat brand
   guideline final tersedia."* Detail lengkap ada di
   [`design-tokens.md`](./design-tokens.md).

Tidak ada dokumen yang mendefinisikan: logo usage/clear space, tipografi
hierarki resmi, tone-of-voice copywriting, fotografi direction, atau grid
system. Semua itu **diturunkan ad-hoc oleh developer per komponen**, bukan
mengikuti sistem yang didokumentasikan di satu tempat.

---

## Implikasi untuk Claude Design

Karena tidak ada brand guideline formal:

- **`design-tokens.md`** di folder ini adalah **satu-satunya sumber sistem
  visual resmi yang bisa dipakai sebagai starting point** — tapi statusnya
  tetap "asumsi developer", bukan keputusan final client. Redesign berbasis
  ini boleh mengubah/menantang nilai-nilainya (warna, font) selama tetap
  konsisten dengan 3 pilar DNA (Heritage/Artisan/Eternal) dari `SOT.md`.
- Brand DNA (3 pilar) dan tagline *"Every Creation Holds Meaning"* adalah
  bagian yang **paling bisa dipercaya sebagai sumber resmi client** (berasal
  dari PDF brand identity asli), berbeda dengan warna/font yang murni
  interpretasi developer.
- Kalau redesign butuh kepastian lebih jauh (clear space logo, palet resmi
  dengan kode Pantone/hex final, tone-of-voice detail), itu **harus diminta
  langsung ke client** — tidak bisa digali lebih jauh dari repo, karena
  sumbernya (PDF brand identity) tidak ikut di-commit ke sini.
