<?php

namespace App\Filament\Resources\Orders\RelationManagers;

use App\Models\OrderItem;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

/**
 * Read-only: order item adalah snapshot data produk saat pembelian
 * (product_name, size, price disalin saat checkout), jadi tidak boleh
 * dibuat/diedit/dihapus dari admin panel.
 */
class ItemsRelationManager extends RelationManager
{
    protected static string $relationship = 'items';

    protected static ?string $title = 'Item order';

    public function isReadOnly(): bool
    {
        return true;
    }

    public function table(Table $table): Table
    {
        return $table
            ->recordTitleAttribute('product_name')
            ->columns([
                TextColumn::make('product_name')
                    ->label('Produk'),
                TextColumn::make('size'),
                TextColumn::make('price')
                    ->label('Harga satuan')
                    ->money('IDR'),
                TextColumn::make('quantity')
                    ->label('Jumlah'),
                TextColumn::make('line_total')
                    ->label('Subtotal')
                    ->state(fn (OrderItem $record): float => (float) $record->price * $record->quantity)
                    ->money('IDR'),
            ])
            ->paginated(false);
    }
}
