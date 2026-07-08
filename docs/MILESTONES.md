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
