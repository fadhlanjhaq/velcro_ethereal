<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'phone', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable implements FilamentUser
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * Siapa yang boleh masuk panel Filament.
     *
     * Tanpa interface ini Filament meloloskan SETIAP baris di tabel `users` ke
     * /admin (lihat Filament\Auth\Pages\Login: kalau model bukan FilamentUser,
     * pengecekannya langsung return true) — padahal tabel yang sama dipakai
     * pelanggan storefront.
     *
     * Yang boleh masuk hanya user yang emailnya ada di daftar
     * config('app.admin_emails') — dari env ADMIN_EMAIL (dipisah koma, sudah
     * di-trim + lowercase di config/app.php). Email user ikut dinormalisasi
     * supaya beda huruf besar/kecil atau spasi tidak menolak admin yang sah.
     *
     * Daftar dibaca dari config, bukan ditulis di sini, supaya tidak ikut
     * ter-commit dan bisa diganti lewat .env tanpa build ulang image. Kalau
     * ADMIN_EMAIL kosong (atau config bukan array), tidak ada yang bisa masuk —
     * gagal ke arah tertutup, bukan terbuka.
     */
    public function canAccessPanel(Panel $panel): bool
    {
        $allowed = config('app.admin_emails', []);

        if (! is_array($allowed) || $allowed === []) {
            return false;
        }

        $email = strtolower(trim((string) $this->email));

        return in_array($email, $allowed, true);
    }

    public function addresses(): HasMany
    {
        return $this->hasMany(Address::class);
    }

    public function carts(): HasMany
    {
        return $this->hasMany(Cart::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }
}
