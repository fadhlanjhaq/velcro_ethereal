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
