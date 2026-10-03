# Deploy ke Production (VPS)

Panduan rilis `velcro-ethereal`. **Jangan pernah mencatat key, token, atau isi
`.env` di dokumen ini** (atau dokumen mana pun di repo).

## Gambaran

- VPS kecil (~957 Mi RAM) menjalankan stack dari `docker-compose.yml` +
  `docker-compose.prod.yml`. Image **tidak dibangun di server** (build Next.js di
  sana berisiko OOM); image dibangun di laptop dan ditarik dari GHCR.
- Dua image terpisah: `velcro-ethereal-web` (Next.js) dan `velcro-ethereal-api`
  (Laravel). Masing-masing harus dibangun dan di-pull sendiri. Mengubah satu
  tidak memperbarui yang lain.

## 1. Commit dan push kode

Image dibangun dari working tree lokal, jadi commit dulu supaya server dan
repo konsisten.

## 2. Build dan push image (di Mac)

Pakai `--platform linux/amd64` karena VPS x86_64 dan Mac Apple Silicon.
Pastikan Docker Desktop sudah benar-benar jalan (`docker info` tanpa error) dan
sudah `docker login ghcr.io` dengan token ber-scope `write:packages`.

Web: `NEXT_PUBLIC_*` tertanam saat build, jadi semua build-arg harus benar di
sini. Client key adalah nilai publik, tapi tetap ambil dari dashboard
Midtrans environment **Production**.

```bash
docker buildx build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_SITE_LIVE=true \
  --build-arg NEXT_PUBLIC_SHOP_OPEN=true \
  --build-arg NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=KEY_CLIENT_PRODUCTION \
  --build-arg NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=true \
  -t ghcr.io/fadhlanjhaq/velcro-ethereal-web:latest \
  --push apps/web
```

API (tanpa build-arg; key dibaca saat runtime dari `.env` server):

```bash
docker buildx build --platform linux/amd64 \
  -t ghcr.io/fadhlanjhaq/velcro-ethereal-api:latest \
  --push apps/api
```

Catatan: ganti `KEY_CLIENT_PRODUCTION` dengan nilai asli, tanpa tanda `<>`
(shell membacanya sebagai redirect). Jalankan ini di Mac, bukan di VPS.

## 3. Deploy di VPS

```bash
ssh -o ServerAliveInterval=30 root@<ip-vps>
cd /home/kapten/velcro_ethereal
C="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

$C pull web api
$C up -d web api
$C exec api php artisan migrate --force
```

- `git pull` di server hanya perlu kalau file compose atau `docker/` berubah.
  Repo dimiliki user `kapten`; sebagai `root` git menolak (dubious ownership)
  dan root tidak punya SSH key GitHub. Pull sebagai `kapten`:
  `sudo -u kapten git pull`.
- Pastikan `up -d` menampilkan **Recreated/Started**. Status **Running** berarti
  image tidak berubah (mis. lupa build/push, atau salah image).

## 4. Environment API di server

`apps/api/.env` **tidak ada di git** (diabaikan `.gitignore`), jadi `git pull`
tidak membawanya. Variabel baru harus ditambahkan manual di server.
Untuk Midtrans: `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`,
`MIDTRANS_MERCHANT_ID`, `MIDTRANS_IS_PRODUCTION=true` (nilai production).

`env_file` hanya dibaca saat container dibuat, jadi setelah mengedit `.env`
gunakan recreate, bukan restart:

```bash
$C up -d --force-recreate api
```

Verifikasi tanpa mencetak key:

```bash
$C exec -e HOME=/tmp api php artisan tinker --execute='dump(["server_key_set" => !empty(config("services.midtrans.server_key")), "client_key_set" => !empty(config("services.midtrans.client_key")), "is_production" => config("services.midtrans.is_production")]);'
```

Jangan pakai `php artisan config:show` untuk ini: akan mencetak server key.
Cek `env | grep MIDTRANS` di dalam container juga menyesatkan karena Laravel
membaca `.env` sebagai file.

## 5. Dashboard Midtrans (production)

Settings → Payment → **Payment notification URL**:
`https://velcroethereal.com/api/midtrans/notification`
(dua kolom lain di halaman itu dibiarkan kosong). Pastikan environment di
dashboard adalah Production. Setelah transaksi uji, "View notification
history" menunjukkan apakah Midtrans berhasil menembak URL (respons 200).

## 6. Verifikasi

1. `/shop` dan `/cart` tidak redirect ke `/shop-segera`.
2. `$C exec api php artisan route:list --path=orders` menampilkan
   `POST api/orders`; `--path=midtrans` menampilkan webhook. Membuka URL webhook
   lewat browser (GET) menghasilkan "method not supported" — itu normal.
3. Satu transaksi kecil dari domain production; order berubah ke paid di
   `/admin/orders`. Kalau tidak berubah, cek
   `$C logs --tail=50 api`.

## Menutup shop lagi

Build web dengan `--build-arg NEXT_PUBLIC_SHOP_OPEN=false`, push, lalu
`$C pull web && $C up -d web`. Lihat `src/lib/shop-status.ts`.

## Jebakan yang pernah terjadi

| Gejala | Penyebab |
|---|---|
| `no such file or directory: <...>` | placeholder `<...>` ditempel apa adanya ke shell |
| `failed to connect to the docker API` | Docker Desktop belum selesai start |
| Web baru, tapi checkout error | image api tidak ikut di-build/pull (backend lama) |
| `up -d` bilang Running, bukan Recreated | image tidak berubah |
| Config Midtrans kosong padahal `.env` Mac terisi | `.env` tidak di git; isi di server dan recreate |
| `dubious ownership` / `Permission denied (publickey)` saat git di VPS | jalankan sebagai `kapten`, atau lewati pull jika hanya image yang berubah |
