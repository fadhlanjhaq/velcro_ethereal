<?php

namespace App\Filament\Resources\Categories\Schemas;

use App\Models\Category;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Utilities\Set;
use Filament\Schemas\Schema;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

class CategoryForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('name')
                    ->label('Nama')
                    ->required()
                    ->maxLength(255)
                    ->live(onBlur: true)
                    ->afterStateUpdated(function (string $operation, ?string $state, Set $set): void {
                        if ($operation === 'create') {
                            $set('slug', Str::slug((string) $state));
                        }
                    }),
                TextInput::make('slug')
                    ->required()
                    ->maxLength(255)
                    ->unique(ignoreRecord: true)
                    ->rules(['alpha_dash'])
                    ->helperText('Terisi otomatis dari nama, tetap bisa diedit manual.'),
                Textarea::make('description')
                    ->label('Deskripsi')
                    ->columnSpanFull(),
                Select::make('parent_id')
                    ->label('Kategori induk')
                    ->relationship(
                        'parent',
                        'name',
                        // Cegah circular reference: kategori tidak boleh menjadi
                        // anak dari dirinya sendiri maupun dari turunannya.
                        modifyQueryUsing: fn (Builder $query, ?Category $record) => $record
                            ? $query->whereNotIn('id', [$record->id, ...self::descendantIds($record)])
                            : $query,
                    )
                    ->searchable()
                    ->preload()
                    ->nullable(),
                Toggle::make('is_active')
                    ->label('Aktif')
                    ->default(true),
            ]);
    }

    /**
     * @return array<int, int>
     */
    private static function descendantIds(Category $category): array
    {
        $childrenByParent = Category::query()
            ->whereNotNull('parent_id')
            ->get(['id', 'parent_id'])
            ->groupBy('parent_id');

        $descendants = [];
        $stack = [$category->id];

        while ($stack !== []) {
            foreach ($childrenByParent->get(array_pop($stack), collect()) as $child) {
                $descendants[] = $child->id;
                $stack[] = $child->id;
            }
        }

        return $descendants;
    }
}
