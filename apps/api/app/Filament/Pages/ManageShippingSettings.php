<?php

namespace App\Filament\Pages;

use App\Exceptions\ShippingProviderException;
use App\Models\ShippingSetting;
use App\Services\Shipping\BiteshipCourierCatalog;
use App\Services\Shipping\ShippingAreaSearch;
use App\Services\Shipping\ShippingSettings;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Forms\Components\CheckboxList;
use Filament\Forms\Components\Hidden;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Schemas\Components\Actions;
use Filament\Schemas\Components\Component;
use Filament\Schemas\Components\EmbeddedSchema;
use Filament\Schemas\Components\Form;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Schemas\Components\Utilities\Set;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * "Pengaturan Pengiriman" — pengaturan BISNIS Biteship yang bisa diubah admin
 * tanpa akses server: data gudang, kurir aktif, layanan yang ditampilkan,
 * markup ongkir. Disimpan di satu baris shipping_settings.
 *
 * Rahasia & teknis (API key, secret webhook, base URL, timeout, trusted proxies,
 * SERVICE_FEE) sengaja TIDAK ada di sini — tetap di .env.
 *
 * Prioritas per field: nilai di sini kalau terisi, kalau kosong → cadangan
 * .env (lihat ShippingSettings). Semua admin boleh mengubah (belum ada peran);
 * setiap simpan dicatat di log (siapa, kapan, field, lama → baru).
 * Lihat docs/decisions/shipping-biteship.md §1.13.
 */
class ManageShippingSettings extends Page
{
    protected string $view = 'filament.pages.manage-shipping-settings';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedTruck;

    protected static ?string $navigationLabel = 'Pengaturan Pengiriman';

    protected static ?string $title = 'Pengaturan Pengiriman';

    /**
     * Batas kurir aktif — paket Starter Biteship hanya mengizinkan 3.
     */
    private const MAX_COURIERS = 3;

    /**
     * Field yang disimpan + dicatat di log perubahan (urutan = urutan log).
     */
    private const FIELDS = [
        'origin_contact_name',
        'origin_contact_phone',
        'origin_address',
        'origin_area_id',
        'origin_area_label',
        'origin_postal_code',
        'couriers',
        'allowed_services',
        'shipping_markup',
    ];

    /**
     * @var array<string, mixed>|null
     */
    public ?array $data = [];

    /**
     * Hasil pencarian area terakhir (id → label & kode pos), supaya saat area
     * dipilih label & kode posnya bisa disimpan tanpa memanggil Biteship lagi.
     *
     * @var array<string, array{label: string, postal_code: string|null}>
     */
    public array $areaResults = [];

    /**
     * Entri allowlist tersimpan yang tidak ada di katalog — tetap dipertahankan
     * dan ditampilkan sebagai "kode lain" (tidak dibuang diam-diam).
     *
     * @var array<string, string>
     */
    public array $extraServiceOptions = [];

    public function mount(): void
    {
        $this->form->fill($this->loadFormData());
    }

    /**
     * Info di atas form. Nama kontak, telepon, alamat, kurir, dan layanan wajib
     * diisi saat menyimpan; yang bisa dikosongkan (area, kode pos, markup)
     * memakai cadangan .env. Sebelum halaman ini pernah disimpan, SEMUA nilai
     * memakai .env.
     */
    public function getSubheading(): ?string
    {
        return 'Kosongkan field untuk memakai nilai cadangan dari .env (nilai cadangan tampil samar di dalam field). '
            .'Sebelum halaman ini pertama kali disimpan, semua pengaturan memakai .env. '
            .'API key dan secret webhook tetap di .env dan tidak ditampilkan di sini.';
    }

    /**
     * Isi form: field teks dari DB saja (kosong = cadangan .env, ditampilkan
     * sebagai placeholder — tidak disalin ke DB). Kurir & layanan diisi nilai
     * EFEKTIF, supaya kotak centang mencerminkan yang sedang berlaku.
     *
     * @return array<string, mixed>
     */
    private function loadFormData(): array
    {
        $settings = app(ShippingSettings::class);
        $settings->forget();
        $record = $settings->record();

        $services = [];
        $extra = [];

        foreach ($settings->allowedServices() as $entry) {
            [$courier, $service] = array_pad(explode(':', $entry, 2), 2, '');

            if (BiteshipCourierCatalog::has($entry)) {
                $services[$courier][] = $service;
            } else {
                $extra[] = $entry;
            }
        }

        $this->extraServiceOptions = array_combine($extra, $extra) ?: [];

        return [
            'origin_contact_name' => $record?->origin_contact_name,
            'origin_contact_phone' => $record?->origin_contact_phone,
            'origin_address' => $record?->origin_address,
            'origin_area_id' => $record?->origin_area_id,
            'origin_area_label' => $record?->origin_area_label,
            'origin_postal_code' => $record?->origin_postal_code,
            'couriers' => array_values(array_intersect(
                array_keys(BiteshipCourierCatalog::COURIERS),
                $settings->couriers(),
            )),
            'services' => $services,
            'extra_services' => $extra,
            'shipping_markup' => $record?->shipping_markup,
        ];
    }

    public function form(Schema $schema): Schema
    {
        $settings = app(ShippingSettings::class);
        $fallback = $settings->fallbackOrigin();

        return $schema
            ->components([
                $this->warehouseSection($fallback),
                $this->courierSection($settings),
                $this->feeSection($settings),
            ])
            ->statePath('data');
    }

    /**
     * @param  array{contact_name: ?string, contact_phone: ?string, address: ?string, area_id: ?string, postal_code: ?string}  $fallback
     */
    private function warehouseSection(array $fallback): Section
    {
        return Section::make('Gudang')
            ->description('Alamat penjemputan kurir dan titik asal cek ongkir. Kosongkan field untuk memakai nilai cadangan dari .env (ditampilkan sebagai teks samar di dalam field).')
            ->columns(2)
            ->schema([
                TextInput::make('origin_contact_name')
                    ->label('Nama kontak')
                    ->required()
                    ->maxLength(255)
                    ->placeholder($fallback['contact_name'] ?? 'Belum ada cadangan di .env'),
                TextInput::make('origin_contact_phone')
                    ->label('Telepon')
                    ->required()
                    ->tel()
                    ->maxLength(20)
                    // Angka saja, boleh diawali "+". Spasi / tanda hubung ditolak
                    // supaya nomor yang dikirim ke Biteship (booking) bersih.
                    ->rules(['regex:/^\+?[0-9]{8,15}$/'])
                    ->validationMessages(['regex' => 'Telepon hanya boleh angka (boleh diawali +), 8–15 digit.'])
                    ->placeholder($fallback['contact_phone'] ?? 'Belum ada cadangan di .env'),
                Textarea::make('origin_address')
                    ->label('Alamat')
                    ->required()
                    ->rows(3)
                    ->maxLength(1000)
                    ->placeholder($fallback['address'] ?? 'Belum ada cadangan di .env')
                    ->columnSpanFull(),
                Select::make('origin_area_id')
                    ->label('Area gudang')
                    ->searchable()
                    ->searchDebounce(600)
                    ->searchPrompt('Ketik minimal 3 huruf: kecamatan, kota, atau kode pos')
                    ->noSearchResultsMessage('Area tidak ditemukan (atau Biteship sedang tidak bisa dihubungi).')
                    ->getSearchResultsUsing(fn (string $search): array => $this->searchAreaOptions($search))
                    ->getOptionLabelUsing(fn ($value): ?string => $this->areaLabel($value))
                    ->live()
                    ->afterStateUpdated(function (?string $state, Set $set): void {
                        if ($state === null || $state === '') {
                            $set('origin_area_label', null);

                            return;
                        }

                        $area = $this->areaResults[$state] ?? null;

                        if ($area !== null) {
                            $set('origin_area_label', $area['label']);

                            // Kode pos dari Biteship kalau ada; kalau tidak, biarkan
                            // admin mengisinya sendiri di field di bawah.
                            if ($area['postal_code'] !== null) {
                                $set('origin_postal_code', $area['postal_code']);
                            }
                        }
                    })
                    ->placeholder($fallback['area_id'] !== null
                        ? "Cadangan .env: ID area {$fallback['area_id']}"
                        : 'Belum ada cadangan di .env')
                    ->helperText('Menentukan tarif (titik asal Biteship). Setiap pencarian yang belum ter-cache memanggil Biteship (berbayar).')
                    ->columnSpanFull(),
                Hidden::make('origin_area_label'),
                TextInput::make('origin_postal_code')
                    ->label('Kode pos')
                    ->maxLength(10)
                    ->rules(['nullable', 'regex:/^[0-9]{5,10}$/'])
                    ->validationMessages(['regex' => 'Kode pos hanya boleh angka (5–10 digit).'])
                    ->placeholder($fallback['postal_code'] ?? 'Belum ada cadangan di .env')
                    ->helperText('Terisi otomatis dari area yang dipilih; sunting kalau Biteship tidak memberikannya.'),
            ]);
    }

    private function courierSection(ShippingSettings $settings): Section
    {
        $fallbackCouriers = implode(', ', $settings->fallbackCouriers()) ?: '—';
        $fallbackServices = implode(', ', $settings->fallbackAllowedServices()) ?: 'semua layanan (tanpa filter)';

        $serviceLists = [];

        foreach (BiteshipCourierCatalog::COURIERS as $code => $courier) {
            $serviceLists[] = CheckboxList::make("services.{$code}")
                ->label("Layanan {$courier['name']}")
                ->options(BiteshipCourierCatalog::serviceOptions($code))
                // Layanan dari kurir yang tidak aktif tidak bisa dipilih. Field
                // yang disabled tidak ikut tersimpan (Filament tidak men-dehydrate
                // field disabled), jadi pilihan lama kurir itu ikut terbuang saat
                // simpan — Biteship juga tidak akan mengembalikan tarifnya.
                ->disabled(fn (Get $get): bool => ! in_array($code, (array) $get('couriers'), true))
                ->hint(fn (Get $get): ?string => in_array($code, (array) $get('couriers'), true)
                    ? null
                    : 'Aktifkan kurir ini dulu')
                ->columns(2);
        }

        return Section::make('Kurir dan Layanan')
            ->description("Cadangan .env saat ini — kurir: {$fallbackCouriers}; layanan: {$fallbackServices}.")
            ->schema([
                CheckboxList::make('couriers')
                    ->label('Kurir aktif')
                    ->options(BiteshipCourierCatalog::courierOptions())
                    ->required()
                    ->rules(['array', 'min:1', 'max:'.self::MAX_COURIERS])
                    ->validationMessages([
                        'required' => 'Pilih minimal 1 kurir.',
                        'min' => 'Pilih minimal 1 kurir.',
                        'max' => 'Maksimal '.self::MAX_COURIERS.' kurir aktif (batas paket Starter Biteship).',
                    ])
                    ->live()
                    ->columns(2)
                    ->helperText('Maksimal '.self::MAX_COURIERS.' kurir: paket Starter Biteship hanya mengizinkan 3 kurir aktif. Kurir di luar daftar ini tidak diminta tarifnya.'),
                ...$serviceLists,
                CheckboxList::make('extra_services')
                    ->label('Kode lain (tidak ada di katalog)')
                    ->options(fn (): array => $this->extraServiceOptions)
                    ->visible(fn (): bool => $this->extraServiceOptions !== [])
                    ->helperText('Tersimpan sebelumnya tapi tidak dikenal katalog. Tetap dipakai selama dicentang; lepas centang untuk menghapus.')
                    ->columns(2),
            ]);
    }

    private function feeSection(ShippingSettings $settings): Section
    {
        return Section::make('Biaya')
            ->schema([
                TextInput::make('shipping_markup')
                    ->label('Markup ongkir')
                    ->numeric()
                    ->integer()
                    ->minValue(0)
                    ->prefix('Rp')
                    ->placeholder('Cadangan .env: '.number_format($settings->fallbackShippingMarkup(), 0, ',', '.'))
                    ->helperText('Ditambahkan ke setiap tarif kurir yang tampil dan ditagih. Tidak berlaku untuk asuransi. Kosongkan untuk memakai cadangan .env.'),
            ]);
    }

    /**
     * Opsi Select area dari ShippingAreaSearch (cache bersama dengan checkout).
     * Error Biteship → notifikasi + daftar kosong, bukan crash halaman.
     *
     * @return array<string, string>
     */
    private function searchAreaOptions(string $search): array
    {
        if (mb_strlen(trim($search)) < 3) {
            return [];
        }

        try {
            $areas = app(ShippingAreaSearch::class)->search($search);
        } catch (ShippingProviderException $e) {
            report($e);

            Notification::make()
                ->danger()
                ->title('Gagal mencari area')
                ->body('Biteship tidak bisa dihubungi atau menolak permintaan. Coba lagi sebentar.')
                ->send();

            return [];
        }

        $options = [];

        foreach ($areas as $area) {
            $this->areaResults[$area['id']] = [
                'label' => $area['label'],
                'postal_code' => $area['postal_code'],
            ];
            $options[$area['id']] = $area['label'];
        }

        return $options;
    }

    /**
     * Label area untuk nilai Select: dari hasil pencarian terakhir, lalu label
     * tersimpan — supaya yang tampil nama area, bukan ID mentah.
     */
    private function areaLabel(mixed $value): ?string
    {
        if (! is_scalar($value) || (string) $value === '') {
            return null;
        }

        $value = (string) $value;

        return $this->areaResults[$value]['label']
            ?? (($this->data['origin_area_id'] ?? null) === $value ? ($this->data['origin_area_label'] ?? null) : null)
            ?? "Area {$value}";
    }

    public function save(): void
    {
        $state = $this->form->getState();

        $couriers = array_values(array_intersect(
            array_keys(BiteshipCourierCatalog::COURIERS),
            (array) ($state['couriers'] ?? []),
        ));

        // Layanan hanya dari kurir AKTIF (field kurir nonaktif disabled → tidak
        // ada di state), plus "kode lain" yang masih dicentang.
        $allowed = [];

        foreach ($couriers as $courier) {
            foreach ((array) ($state['services'][$courier] ?? []) as $service) {
                $allowed[] = strtolower("{$courier}:{$service}");
            }
        }

        foreach ((array) ($state['extra_services'] ?? []) as $entry) {
            $allowed[] = strtolower(trim((string) $entry));
        }

        $allowed = array_values(array_unique(array_filter($allowed)));

        if ($allowed === []) {
            throw ValidationException::withMessages([
                'data.services.'.($couriers[0] ?? 'jne') => 'Pilih minimal 1 layanan dari kurir yang aktif.',
            ]);
        }

        $areaId = $this->nullableString($state['origin_area_id'] ?? null);
        $markup = $state['shipping_markup'] ?? null;

        $values = [
            'origin_contact_name' => $this->nullableString($state['origin_contact_name'] ?? null),
            'origin_contact_phone' => $this->nullableString($state['origin_contact_phone'] ?? null),
            'origin_address' => $this->nullableString($state['origin_address'] ?? null),
            'origin_area_id' => $areaId,
            // Label hanya bermakna bersama ID-nya.
            'origin_area_label' => $areaId !== null ? $this->nullableString($state['origin_area_label'] ?? null) : null,
            'origin_postal_code' => $this->nullableString($state['origin_postal_code'] ?? null),
            'couriers' => $couriers,
            'allowed_services' => $allowed,
            // Kosong = null = cadangan .env; 0 tetap 0 (nilai sah).
            'shipping_markup' => $markup === null || $markup === '' ? null : max(0, (int) $markup),
        ];

        $setting = ShippingSetting::query()->orderBy('id')->first() ?? new ShippingSetting;

        $changes = [];

        foreach (self::FIELDS as $field) {
            $old = $setting->exists ? $setting->{$field} : null;

            if ($old !== $values[$field]) {
                $changes[$field] = ['old' => $old, 'new' => $values[$field]];
            }
        }

        $setting->fill($values);
        $setting->updated_by = auth()->id();
        $setting->save();

        // Log perubahan: siapa, kapan, field apa, lama → baru. Tidak ada rahasia
        // di tabel ini, jadi aman dicatat apa adanya.
        $user = auth()->user();

        Log::info('Pengaturan pengiriman diubah.', [
            'user_id' => $user?->getAuthIdentifier(),
            'user_email' => $user?->email,
            'at' => now()->toIso8601String(),
            'changes' => $changes,
        ]);

        // Sisa request ini (dan form yang di-fill ulang) membaca nilai baru.
        app(ShippingSettings::class)->forget();
        $this->form->fill($this->loadFormData());

        Notification::make()
            ->success()
            ->title('Pengaturan pengiriman tersimpan')
            ->body($changes === [] ? 'Tidak ada perubahan.' : 'Berlaku langsung untuk cek ongkir & booking berikutnya.')
            ->send();
    }

    private function nullableString(mixed $value): ?string
    {
        $value = is_scalar($value) ? trim((string) $value) : '';

        return $value !== '' ? $value : null;
    }

    public function content(Schema $schema): Schema
    {
        return $schema
            ->components([
                Form::make([EmbeddedSchema::make('form')])
                    ->id('form')
                    ->livewireSubmitHandler('save')
                    ->footer([
                        $this->getFormActionsContentComponent(),
                    ]),
            ]);
    }

    public function getFormActionsContentComponent(): Component
    {
        return Actions::make([
            Action::make('save')
                ->label('Simpan')
                ->submit('save')
                ->keyBindings(['mod+s']),
        ])
            ->alignment($this->getFormActionsAlignment())
            ->sticky($this->areFormActionsSticky())
            ->key('form-actions');
    }
}
