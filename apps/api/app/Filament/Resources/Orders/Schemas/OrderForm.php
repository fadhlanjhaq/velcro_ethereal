<?php

namespace App\Filament\Resources\Orders\Schemas;

use App\Enums\OrderStatus;
use Filament\Forms\Components\KeyValue;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class OrderForm
{
    /**
     * Hanya status yang bisa diubah admin. Field lain adalah data checkout
     * (snapshot) yang ditampilkan disabled sebagai konteks dan tidak ikut
     * disimpan (dehydrated false).
     */
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Select::make('status')
                    ->options(OrderStatus::class)
                    ->required(),
                TextInput::make('order_number')
                    ->label('Nomor order')
                    ->disabled()
                    ->dehydrated(false),
                TextInput::make('customer')
                    ->label('Customer')
                    ->formatStateUsing(fn ($record): string => $record?->user?->name
                        ?? $record?->guest_name
                        ?? '—')
                    ->disabled()
                    ->dehydrated(false),
                TextInput::make('guest_email')
                    ->label('Email guest')
                    ->disabled()
                    ->dehydrated(false),
                TextInput::make('subtotal')
                    ->prefix('Rp')
                    ->disabled()
                    ->dehydrated(false),
                TextInput::make('shipping_cost')
                    ->label('Ongkos kirim')
                    ->prefix('Rp')
                    ->disabled()
                    ->dehydrated(false),
                TextInput::make('total')
                    ->prefix('Rp')
                    ->disabled()
                    ->dehydrated(false),
                KeyValue::make('shipping_address')
                    ->label('Alamat pengiriman')
                    ->disabled()
                    ->dehydrated(false)
                    ->columnSpanFull(),
            ]);
    }
}
