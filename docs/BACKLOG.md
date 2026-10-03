# Backlog — antrian pekerjaan

Daftar tunggal pekerjaan yang belum selesai. Diperbarui **3 Oktober 2026**,
setelah audit seluruh dokumentasi terhadap kode. Kalau item selesai, pindahkan
catatannya ke `docs/MILESTONES.md` dan hapus dari sini. Keputusan teknis detail
pembayaran ada di `docs/decisions/payments-midtrans.md`.

Urutan di bawah adalah urutan pengerjaan yang disepakati. Blok A wajib selesai
**sebelum situs dipublikasikan ke media** (termasuk membuka tombol "Website
Utama" di `/info`).

## A. Wajib sebelum publikasi ke media

1. **Halaman legal**: Privacy Policy, Syarat & Ketentuan (disyaratkan Midtrans),
   plus Kebijakan Retur & Penukaran. Isi perlu persetujuan owner.
2. **Rate limiting** `POST /api/orders` dan `POST /api/midtrans/notification`
   (payments-midtrans §3.7; SOT §5.8).
3. **Backup database harian otomatis** (SOT §5.8). Belum ada konfigurasi apa pun
   di repo; perlu juga uji restore.
4. **Ongkir via Biteship** (SOT §5.3, §5.5): hitung ongkir real-time saat
   checkout, pembeli memilih kurir/layanan, ongkir masuk ke `total` dan
   `item_details` Midtrans (payments-midtrans §1.3), kurir/layanan/ongkir
   tersimpan di order/`shipments`, resi dan status pengiriman bisa dilacak.
   Hapus `TODO(biteship)` di `OrderController`. Saat ini semua order tercatat
   ongkir Rp 0 dengan kurir kosong.
5. **Email transaksional ke pembeli**: email yang diisi pembeli saat checkout
   menerima email konfirmasi **hanya setelah status order paid** (berhasil),
   berisi ringkasan order dan invoice. Kirim dari webhook saat transisi pertama
   ke paid (idempotent, jangan kirim ganda). Butuh SMTP production dan queue
   (webhook saat ini sinkron, payments-midtrans §1.5). Di `.env.example`
   `MAIL_MAILER` masih `log`.
6. **Invoice otomatis per order** (SOT §5.4): nomor invoice, rincian item,
   ongkir, total; dilampirkan/ditautkan di email (butir 5) dan bisa dicetak dari
   admin (SOT §5.6).

## B. Fitur SOT lain (setelah blok A)

- Halaman konten: About Us, Size Guide, FAQ.
- Search & filter katalog (kategori, ukuran, rentang harga).
- Admin: cetak label pengiriman, laporan penjualan dasar (harian/bulanan, per
  produk). Belum terverifikasi ada di kode; cek saat mulai.
- Notifikasi email perubahan status pengiriman (diproses → dikirim → selesai),
  setelah Biteship.

## C. Menunggu keputusan owner

- Akun pembeli, login, wishlist, riwayat order, diskon/program akun (SOT §5.1).
  Saat ini guest-only (payments-midtrans §1.4).
- Pricelist asli (harga produk masih placeholder Rp 850.000 di seeder; cek
  harga di production lewat admin).
- Foto produk asli untuk Aurelia, Verdant, Cervus.
- Link TikTok resmi dan handle Instagram untuk `/info` dan footer.
- Brand guideline formal (`docs/design-handoff/brand-guidelines.md`).
- SOT §7 (asumsi terbuka) dan §9 (pricelist tiering, wireframe, breakdown fase)
  belum dikonfirmasi.

## D. Hardening (revisit sesuai kondisi, lihat payments-midtrans §3)

- Rekonsiliasi transaksi Midtrans yang nyangkut (§3.3).
- Refund/partial_refund otomatis dan restock (§3.9); saat ini manual.
- Oversell hanya tercatat di log (§3.8).
- Order pending ganda saat checkout di-reload (§3.2).
- Tabrakan `order_number` tanpa retry (§3.1); batas atas `quantity` (§3.4).
- Multi-role admin (upsell tier, belum perlu di base tier).

## E. Operasional

- `mem_limit` sudah ada di `docker-compose.prod.yml`, tetapi
  `my.cnf` dan penyesuaian di server bisa berbeda dari repo; cek drift sebelum
  `git pull` di VPS.
- RAM VPS ~957 Mi: pantau saat queue worker/email ditambahkan.
- `/info` tombol "Website Utama" masih disabled; buka setelah blok A selesai.
- Fase berikutnya setelah semua di atas: penyempurnaan UI/UX dan visual
  (`docs/design-handoff/`).
