<?php

namespace App\Filament\Pages;

use App\Models\SiteContent;
use App\Models\SiteContentItem;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Schemas\Components\Actions;
use Filament\Schemas\Components\Component;
use Filament\Schemas\Components\EmbeddedSchema;
use Filament\Schemas\Components\Form;
use Filament\Schemas\Components\Tabs;
use Filament\Schemas\Components\Tabs\Tab;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Illuminate\Support\Facades\DB;

/**
 * Editor konten landing page (5 section) dalam satu halaman bertab.
 *
 * Dua tabel di belakangnya: `site_contents` untuk field skalar (updateOrCreate
 * per section+key supaya id-nya stabil) dan `site_content_items` untuk konten
 * berulang/repeater (dihapus per grup lalu di-insert ulang, supaya urutan hasil
 * reorder di repeater persis tercermin di sort_order).
 *
 * Nama class sengaja "ManageSiteContent", bukan "SiteContent", supaya tidak
 * bentrok dengan model App\Models\SiteContent yang dipakai di file yang sama.
 */
class ManageSiteContent extends Page
{
    protected string $view = 'filament.pages.manage-site-content';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedDocumentText;

    protected static ?string $navigationLabel = 'Site Content';

    protected static ?string $title = 'Site Content';

    /**
     * Tipe tiap field skalar per section — dipakai saat menulis kolom `type`
     * di site_contents, dan sekaligus jadi daftar key yang boleh disimpan
     * (state form di luar daftar ini diabaikan).
     *
     * @var array<string, array<string, string>>
     */
    private const CONTENT_TYPES = [
        'hero' => [
            'eyebrow' => 'text',
            'headline_upright' => 'text',
            'headline_italic' => 'text',
            'tagline' => 'text',
            'scroll_cue' => 'text',
            'video_url' => 'video',
            'poster_image' => 'image',
        ],
        'brand_story' => [
            'eyebrow' => 'text',
            'heading' => 'text',
        ],
        'craftsmanship' => [
            'eyebrow' => 'text',
            'heading' => 'text',
            'body' => 'richtext',
        ],
        'closing_cta' => [
            'eyebrow' => 'text',
            'heading' => 'text',
            'secondary_line' => 'text',
            'cta_label' => 'text',
            'cta_href' => 'url',
        ],
    ];

    /**
     * Grup repeater: state path di form => [section, group_key].
     *
     * @var array<string, array{0: string, 1: string}>
     */
    private const ITEM_GROUPS = [
        'announcement_bar.items' => ['announcement_bar', 'announcement_items'],
        'brand_story.pillars' => ['brand_story', 'pillars'],
        'craftsmanship.images' => ['craftsmanship', 'craftsmanship_images'],
    ];

    /**
     * @var array<string, mixed>|null
     */
    public ?array $data = [];

    public function mount(): void
    {
        $this->form->fill($this->loadFormData());
    }

    /**
     * @return array<string, mixed>
     */
    private function loadFormData(): array
    {
        $data = [];

        foreach (self::CONTENT_TYPES as $section => $keys) {
            $stored = SiteContent::where('section', $section)
                ->pluck('value', 'key');

            foreach (array_keys($keys) as $key) {
                $data[$section][$key] = $stored[$key] ?? null;
            }
        }

        foreach (self::ITEM_GROUPS as $statePath => [$section, $groupKey]) {
            $items = SiteContentItem::where('section', $section)
                ->where('group_key', $groupKey)
                ->orderBy('sort_order')
                ->pluck('data')
                ->all();

            data_set($data, $statePath, $items);
        }

        return $data;
    }

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                Tabs::make('Sections')
                    ->tabs([
                        $this->heroTab(),
                        $this->announcementBarTab(),
                        $this->brandStoryTab(),
                        $this->craftsmanshipTab(),
                        $this->closingCtaTab(),
                    ])
                    ->columnSpanFull(),
            ])
            ->statePath('data');
    }

    private function heroTab(): Tab
    {
        return Tab::make('Hero')
            ->schema([
                TextInput::make('hero.eyebrow')
                    ->label('Eyebrow')
                    ->required()
                    ->maxLength(255),
                TextInput::make('hero.headline_upright')
                    ->label('Headline — baris tegak')
                    ->required()
                    ->maxLength(255),
                TextInput::make('hero.headline_italic')
                    ->label('Headline — baris italic')
                    ->required()
                    ->maxLength(255),
                TextInput::make('hero.tagline')
                    ->label('Tagline')
                    ->required()
                    ->maxLength(255),
                TextInput::make('hero.scroll_cue')
                    ->label('Teks scroll cue')
                    ->required()
                    ->maxLength(255),
                FileUpload::make('hero.video_url')
                    ->label('Video background')
                    ->disk('public')
                    ->directory('site-content/hero')
                    ->acceptedFileTypes(['video/mp4'])
                    ->maxSize(51200)
                    ->helperText('MP4, maksimal 50MB.')
                    ->columnSpanFull(),
                FileUpload::make('hero.poster_image')
                    ->label('Poster (fallback sebelum video jalan)')
                    ->image()
                    ->disk('public')
                    ->directory('site-content/hero')
                    ->acceptedFileTypes(['image/jpeg', 'image/png', 'image/webp'])
                    ->maxSize(5120)
                    ->columnSpanFull(),
            ]);
    }

    private function announcementBarTab(): Tab
    {
        return Tab::make('Announcement Bar')
            ->schema([
                Repeater::make('announcement_bar.items')
                    ->label('Item')
                    ->schema([
                        TextInput::make('text')
                            ->label('Teks')
                            ->required()
                            ->maxLength(255),
                    ])
                    ->minItems(1)
                    ->reorderable()
                    ->collapsible()
                    ->itemLabel(fn (array $state): ?string => $state['text'] ?? null)
                    ->addActionLabel('Tambah item')
                    ->columnSpanFull(),
            ]);
    }

    private function brandStoryTab(): Tab
    {
        return Tab::make('Filosofi')
            ->schema([
                TextInput::make('brand_story.eyebrow')
                    ->label('Eyebrow')
                    ->required()
                    ->maxLength(255),
                TextInput::make('brand_story.heading')
                    ->label('Heading')
                    ->required()
                    ->maxLength(255),
                Repeater::make('brand_story.pillars')
                    ->label('Pilar')
                    // Nomor urut ("01", "02", ...) sengaja tidak jadi field:
                    // di-derive dari urutan repeater ini saat render.
                    ->schema([
                        TextInput::make('title')
                            ->label('Judul')
                            ->required()
                            ->maxLength(255),
                        Textarea::make('body')
                            ->label('Isi')
                            ->required()
                            ->rows(3),
                    ])
                    ->minItems(1)
                    ->reorderable()
                    ->collapsible()
                    ->itemLabel(fn (array $state): ?string => $state['title'] ?? null)
                    ->addActionLabel('Tambah pilar')
                    ->columnSpanFull(),
            ]);
    }

    private function craftsmanshipTab(): Tab
    {
        return Tab::make('Craftsmanship')
            ->schema([
                TextInput::make('craftsmanship.eyebrow')
                    ->label('Eyebrow')
                    ->required()
                    ->maxLength(255),
                TextInput::make('craftsmanship.heading')
                    ->label('Heading')
                    ->required()
                    ->maxLength(255),
                Textarea::make('craftsmanship.body')
                    ->label('Paragraf')
                    ->required()
                    ->rows(5)
                    ->columnSpanFull(),
                Repeater::make('craftsmanship.images')
                    ->label('Gambar')
                    ->schema([
                        FileUpload::make('url')
                            ->label('Gambar')
                            ->image()
                            ->disk('public')
                            ->directory('site-content/craftsmanship')
                            ->acceptedFileTypes(['image/jpeg', 'image/png', 'image/webp'])
                            ->maxSize(5120)
                            ->required()
                            ->columnSpanFull(),
                        TextInput::make('parallax_speed')
                            ->label('Kecepatan parallax')
                            ->numeric()
                            ->integer()
                            ->minValue(0)
                            ->maxValue(50)
                            ->required()
                            ->helperText('Nilai data-parallax di komponen (mis. 7 = mood, 4 = tekstur).'),
                        Select::make('role')
                            ->label('Peran')
                            ->options([
                                'mood' => 'Mood (kolom besar)',
                                'texture' => 'Texture (inset kecil)',
                            ])
                            ->required(),
                    ])
                    ->minItems(1)
                    ->reorderable()
                    ->collapsible()
                    ->itemLabel(fn (array $state): ?string => $state['role'] ?? null)
                    ->addActionLabel('Tambah gambar')
                    ->columnSpanFull(),
            ]);
    }

    private function closingCtaTab(): Tab
    {
        return Tab::make('Closing CTA')
            ->schema([
                TextInput::make('closing_cta.eyebrow')
                    ->label('Eyebrow')
                    ->required()
                    ->maxLength(255),
                TextInput::make('closing_cta.heading')
                    ->label('Heading')
                    ->required()
                    ->maxLength(255),
                Textarea::make('closing_cta.secondary_line')
                    ->label('Baris pendukung')
                    ->required()
                    ->rows(2)
                    ->columnSpanFull(),
                TextInput::make('closing_cta.cta_label')
                    ->label('Label tombol')
                    ->required()
                    ->maxLength(255),
                TextInput::make('closing_cta.cta_href')
                    ->label('Tujuan tombol')
                    ->required()
                    ->maxLength(255)
                    // Boleh path internal ("/shop") atau URL absolut.
                    ->rule('regex:/^(https?:\/\/\S+|\/\S*)$/')
                    ->validationMessages([
                        'regex' => 'Harus berupa path internal (mis. /shop) atau URL lengkap (https://...).',
                    ]),
            ]);
    }

    public function save(): void
    {
        $data = $this->form->getState();

        DB::transaction(function () use ($data): void {
            foreach (self::CONTENT_TYPES as $section => $keys) {
                foreach ($keys as $key => $type) {
                    SiteContent::updateOrCreate(
                        ['section' => $section, 'key' => $key],
                        ['value' => data_get($data, "{$section}.{$key}"), 'type' => $type],
                    );
                }
            }

            foreach (self::ITEM_GROUPS as $statePath => [$section, $groupKey]) {
                SiteContentItem::where('section', $section)
                    ->where('group_key', $groupKey)
                    ->delete();

                foreach (array_values(data_get($data, $statePath) ?? []) as $sortOrder => $item) {
                    if (array_key_exists('parallax_speed', $item)) {
                        $item['parallax_speed'] = (int) $item['parallax_speed'];
                    }

                    SiteContentItem::create([
                        'section' => $section,
                        'group_key' => $groupKey,
                        'sort_order' => $sortOrder,
                        'data' => $item,
                    ]);
                }
            }
        });

        Notification::make()
            ->success()
            ->title('Konten tersimpan')
            ->send();
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
