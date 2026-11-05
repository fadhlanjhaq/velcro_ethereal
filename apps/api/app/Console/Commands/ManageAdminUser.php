<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Str;
use Throwable;

/**
 * Membuat akun admin baru, atau me-reset password akun admin yang sudah ada.
 *
 * Akses /admin tetap ditentukan oleh ADMIN_EMAIL (lihat User::canAccessPanel),
 * bukan oleh command ini.
 *
 * Password:
 * - Default: dibuat acak (24 karakter) dan dicetak SEKALI ke terminal.
 * - Dengan --set-password: diketik sendiri lewat input tersembunyi (dua kali),
 *   tidak pernah dicetak. Sengaja berupa flag tanpa nilai — password tidak
 *   pernah diterima sebagai argumen supaya tidak masuk shell history.
 *   Minimal 12 karakter, maksimal 72 byte (batas bcrypt).
 * Password tidak pernah ditulis ke log atau file.
 *
 * Reset hanya untuk email yang terdaftar di ADMIN_EMAIL: tabel `users` dipakai
 * bersama pelanggan storefront, jadi tanpa batasan ini command bisa dipakai
 * mengambil alih akun pelanggan.
 *
 * Semua input (nama, konfirmasi, password) divalidasi dulu; database baru
 * diubah setelah semuanya lolos.
 */
class ManageAdminUser extends Command
{
    private const MIN_PASSWORD_CHARS = 12;

    // bcrypt hanya memakai 72 byte pertama; sisanya diabaikan diam-diam.
    private const MAX_PASSWORD_BYTES = 72;

    protected $signature = 'admin:user
                            {email : Email akun admin}
                            {--name= : Nama tampilan (wajib untuk akun baru)}
                            {--set-password : Ketik password sendiri (input tersembunyi) alih-alih password acak}';

    protected $description = 'Buat akun admin baru atau reset password akun admin (password acak dicetak sekali, atau --set-password untuk mengetik sendiri)';

    public function handle(): int
    {
        $email = strtolower(trim((string) $this->argument('email')));

        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            $this->error("Format email tidak valid: {$email}");

            return self::FAILURE;
        }

        $adminEmails = config('app.admin_emails', []);
        $isListed = is_array($adminEmails) && in_array($email, $adminEmails, true);
        $typed = (bool) $this->option('set-password');

        $user = User::query()->where('email', $email)->first();

        if ($user === null) {
            $name = trim((string) $this->option('name'));

            if ($name === '') {
                $this->error('Akun belum ada. Opsi --name wajib diisi untuk membuat akun baru.');

                return self::FAILURE;
            }

            $password = $typed ? $this->askNewPassword() : Str::password(24);

            if ($password === null) {
                return self::FAILURE;
            }

            $user = new User;
            $user->name = $name;
            $user->email = $email;
            $user->password = $password; // di-hash otomatis oleh cast 'hashed'
            $user->save();

            $this->info("Akun dibuat: {$email}");

            if (! $isListed) {
                $this->warn(
                    'Akun dibuat, tetapi BELUM bisa masuk /admin sampai email ini '
                    .'ditambahkan ke ADMIN_EMAIL di .env dan container api di-recreate.'
                );
            }

            $this->reportPassword($password, $typed);

            return self::SUCCESS;
        }

        if (! $isListed) {
            $this->error(
                'Akun sudah ada, tetapi email ini tidak terdaftar di ADMIN_EMAIL. '
                .'Reset password hanya untuk akun admin terdaftar (mencegah ambil alih akun pelanggan).'
            );

            return self::FAILURE;
        }

        if ($this->option('name') !== null) {
            $this->comment('Akun sudah ada: --name diabaikan.');
        }

        if (! $this->confirm("Reset password untuk {$email}? Password lama tidak bisa dipakai lagi.", false)) {
            $this->comment('Dibatalkan. Tidak ada yang diubah.');

            return self::SUCCESS;
        }

        $password = $typed ? $this->askNewPassword() : Str::password(24);

        if ($password === null) {
            return self::FAILURE;
        }

        $user->password = $password; // di-hash otomatis oleh cast 'hashed'
        $user->save();

        $this->info("Password direset: {$email}");

        $this->reportPassword($password, $typed);

        return self::SUCCESS;
    }

    /**
     * Minta password dua kali lewat input tersembunyi lalu validasi.
     *
     * Mengembalikan password apa adanya (TIDAK di-trim — spasi karakter sah),
     * atau null kalau gagal; pesan error sudah ditampilkan.
     */
    private function askNewPassword(): ?string
    {
        $interactiveHint = 'Password tidak bisa dibaca. Jalankan command ini secara interaktif '
            .'(docker compose exec TANPA -T, di terminal sungguhan).';

        if (! $this->input->isInteractive()) {
            $this->error($interactiveHint);

            return null;
        }

        try {
            // fallback=false: kalau input tidak bisa disembunyikan, gagal —
            // jangan pernah jatuh ke input yang terlihat di layar.
            $password = $this->secret('Password baru', false);
            $confirmation = $this->secret('Ulangi password', false);
        } catch (Throwable) {
            $this->error($interactiveHint);

            return null;
        }

        if (! is_string($password) || $password === ''
            || ! is_string($confirmation) || $confirmation === '') {
            $this->error($interactiveHint);

            return null;
        }

        if (! hash_equals($password, $confirmation)) {
            $this->error('Password dan ulangannya tidak sama. Tidak ada yang diubah.');

            return null;
        }

        if (mb_strlen($password) < self::MIN_PASSWORD_CHARS) {
            $this->error('Password minimal '.self::MIN_PASSWORD_CHARS.' karakter. Tidak ada yang diubah.');

            return null;
        }

        if (strlen($password) > self::MAX_PASSWORD_BYTES) {
            $this->error(
                'Password maksimal '.self::MAX_PASSWORD_BYTES.' byte: bcrypt hanya memakai 72 byte '
                .'pertama, sisanya diabaikan. Huruf non-ASCII (mis. emoji, aksara) memakai lebih '
                .'dari 1 byte per karakter. Tidak ada yang diubah.'
            );

            return null;
        }

        return $password;
    }

    /**
     * Password acak dicetak sekali; password yang diketik sendiri tidak pernah
     * dicetak. Hanya ke terminal (stdout), tidak ke log.
     */
    private function reportPassword(string $password, bool $typed): void
    {
        if ($typed) {
            $this->info('Password sudah diset (tidak ditampilkan).');

            return;
        }

        $this->newLine();
        $this->line('Password: '.$password);
        $this->newLine();
        $this->warn('Simpan password ini SEKARANG. Password tidak akan ditampilkan lagi.');
        $this->warn('Setelah disimpan, jalankan `clear` untuk membersihkan layar terminal.');
    }
}
