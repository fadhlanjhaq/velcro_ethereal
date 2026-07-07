# Velcro Ethereal

**Velcro Ethereal** is a luxury heritage streetwear e-commerce platform.

## Architecture

This is a monorepo containing:

- **`apps/web`** — Storefront built with Next.js (App Router), TypeScript, and Tailwind CSS.
- **`apps/api`** — Backend API built with Laravel 13 (PHP 8.4).
- **`docs`** — Project documentation.

```
velcro-ethereal/
├── apps/
│   ├── web/   # Next.js storefront
│   └── api/   # Laravel API
├── docs/
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

- PHP 8.4 (e.g. via [Laravel Herd](https://herd.laravel.com/))
- Composer
- Node.js + npm

### Backend (`apps/api`)

```bash
cd apps/api
composer install
cp .env.example .env
php artisan key:generate
php artisan serve
```

### Frontend (`apps/web`)

```bash
cd apps/web
npm install
npm run dev
```

## Validasi Pra-Deploy dengan Docker

> **Ini BUKAN untuk dev harian.** Dev harian tetap native: Herd untuk Laravel dan
> `npm run dev` untuk Next.js. Stack Docker Compose di sini punya satu tujuan:
> memastikan **build production** jalan benar sebelum di-deploy ke VPS. Dioptimalkan
> untuk kemiripan dengan production, bukan kecepatan iterasi — image di-build penuh
> setiap kali, **tidak ada** bind-mount source / hot-reload.

### Yang dijalankan

Satu Nginx reverse proxy jadi single entry point di `http://localhost` (port 80):

| Path        | Diarahkan ke                              |
| ----------- | ----------------------------------------- |
| `/api/*`    | Laravel API (PHP 8.4-fpm, `api:9000`)     |
| `/up`       | Health check Laravel                      |
| `*` lainnya | Storefront Next.js (standalone, `web:3000`) |

Service: `web` (Next.js), `api` (Laravel), `db` (MySQL 8), `redis`, `proxy` (Nginx),
semuanya di network internal `velcro_net`.

### Cara menjalankan

```bash
# dari root repo
docker compose up --build
```

Catatan konfigurasi:

- **App config** service `api` dibaca dari `apps/api/.env` (butuh `APP_KEY` — kalau
  belum ada, jalankan `php artisan key:generate` di `apps/api` lebih dulu).
- **Wiring DB/Redis** (host `db`/`redis`, driver mysql/redis) di-*inject* oleh
  `docker-compose.yml`, jadi nilai native (Herd/sqlite) di `.env` kamu tidak perlu
  diubah dan dev harian tetap aman.
- **Kredensial MySQL** default `velcro` / `velcro_secret` (lihat `apps/api/.env.example`);
  override lewat env `MYSQL_*` kalau perlu.

Untuk reset penuh (termasuk drop volume MySQL):

```bash
docker compose down -v
```

### Cek semua service sehat

```bash
# Storefront Next.js (via proxy) — harus balas 200 + HTML
curl -i http://localhost/

# Health check Laravel (via proxy → php-fpm) — harus balas 200
curl -i http://localhost/up

# Status tiap container (semua "running", db & redis "healthy")
docker compose ps
```

Opsional, jalankan migration ke MySQL di dalam container:

```bash
docker compose exec api php artisan migrate --force
```
