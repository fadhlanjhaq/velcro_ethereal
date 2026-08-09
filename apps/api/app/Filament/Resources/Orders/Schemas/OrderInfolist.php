<?php

namespace App\Filament\Resources\Orders\Schemas;

use App\Enums\OrderStatus;
use Filament\Infolists\Components\KeyValueEntry;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Schema;

class OrderInfolist
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextEntry::make('order_number')
                    ->label('Nomor order'),
                TextEntry::make('status')
                    ->badge()
                    ->color(fn (OrderStatus $state): string => match ($state) {
                        OrderStatus::Pending => 'warning',
                        OrderStatus::Paid, OrderStatus::Processing => 'info',
                        OrderStatus::Shipped => 'primary',
                        OrderStatus::Completed => 'success',
                        OrderStatus::Cancelled => 'danger',
                    }),
                TextEntry::make('user.name')
                    ->label('User terdaftar')
                    ->placeholder('— (guest checkout)'),
                TextEntry::make('guest_name')
                    ->label('Nama guest')
                    ->placeholder('—'),
                TextEntry::make('guest_email')
                    ->label('Email guest')
                    ->placeholder('—'),
                TextEntry::make('created_at')
                    ->label('Tanggal order')
                    ->dateTime(),
                TextEntry::make('subtotal')
                    ->money('IDR'),
                TextEntry::make('shipping_cost')
                    ->label('Ongkos kirim')
                    ->money('IDR'),
                TextEntry::make('total')
                    ->money('IDR'),
                KeyValueEntry::make('shipping_address')
                    ->label('Alamat pengiriman')
                    ->columnSpanFull(),
                TextEntry::make('payment.status')
                    ->label('Status pembayaran')
                    ->badge()
                    ->placeholder('Belum ada data pembayaran'),
                TextEntry::make('payment.paid_at')
                    ->label('Dibayar pada')
                    ->dateTime()
                    ->placeholder('—'),
                TextEntry::make('shipment.courier')
                    ->label('Kurir')
                    ->placeholder('Belum ada data pengiriman'),
                TextEntry::make('shipment.tracking_number')
                    ->label('Nomor resi')
                    ->placeholder('—'),
            ]);
    }
}
