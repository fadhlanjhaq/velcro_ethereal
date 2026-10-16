<?php

namespace App\Filament\Resources\Orders\Schemas;

use App\Enums\OrderStatus;
use App\Models\Order;
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
                // Biaya layanan hanya relevan kalau SERVICE_FEE pernah > 0 —
                // disembunyikan untuk order tanpa biaya layanan (termasuk order lama).
                TextEntry::make('service_fee')
                    ->label('Biaya layanan')
                    ->money('IDR')
                    ->visible(fn (Order $record): bool => (float) $record->service_fee > 0),
                TextEntry::make('total')
                    ->money('IDR'),

                // Alamat terstruktur (Biteship Langkah C). Dibaca lewat state()
                // dari JSON shipping_address — order sebelum Langkah C hanya
                // punya name/phone/address, jadi field baru tampil "—".
                TextEntry::make('shipping_address_name')
                    ->label('Nama penerima')
                    ->state(fn (Order $record): ?string => $record->shipping_address['name'] ?? null)
                    ->placeholder('—'),
                TextEntry::make('shipping_address_phone')
                    ->label('Telepon penerima')
                    ->state(fn (Order $record): ?string => $record->shipping_address['phone'] ?? null)
                    ->placeholder('—'),
                TextEntry::make('shipping_address_area')
                    ->label('Area tujuan')
                    ->state(fn (Order $record): ?string => $record->shipping_address['area_label'] ?? null)
                    ->placeholder('—'),
                TextEntry::make('shipping_address_postal_code')
                    ->label('Kode pos')
                    ->state(fn (Order $record): ?string => $record->shipping_address['postal_code'] ?? null)
                    ->placeholder('—'),
                TextEntry::make('shipping_address_detail')
                    ->label('Alamat detail')
                    ->state(fn (Order $record): ?string => $record->shipping_address['address_detail'] ?? null)
                    ->placeholder('—')
                    ->columnSpanFull(),
                TextEntry::make('shipping_address_courier_note')
                    ->label('Catatan untuk kurir')
                    ->state(fn (Order $record): ?string => $record->shipping_address['courier_note'] ?? null)
                    ->placeholder('—')
                    ->columnSpanFull(),
                // Gabungan siap tampil — satu-satunya alamat untuk order lama.
                TextEntry::make('shipping_address_full')
                    ->label('Alamat lengkap (gabungan)')
                    ->state(fn (Order $record): ?string => $record->shipping_address['address'] ?? null)
                    ->placeholder('—')
                    ->columnSpanFull(),
                TextEntry::make('payment.status')
                    ->label('Status pembayaran')
                    ->badge()
                    ->placeholder('Belum ada data pembayaran'),
                TextEntry::make('payment.paid_at')
                    ->label('Dibayar pada')
                    ->dateTime()
                    ->placeholder('—'),
                // Snapshot layanan kurir saat checkout. Order sebelum Langkah C
                // tidak punya shipment → placeholder.
                TextEntry::make('shipment.courier_name')
                    ->label('Kurir')
                    ->placeholder('Belum ada data pengiriman'),
                TextEntry::make('shipment.service_name')
                    ->label('Layanan')
                    ->placeholder('—'),
                TextEntry::make('shipment.courier')
                    ->label('Kode kurir / layanan')
                    ->formatStateUsing(fn (?string $state, Order $record): string => $record->shipment?->service_code
                        ? "{$state}:{$record->shipment->service_code}"
                        : (string) $state)
                    ->placeholder('—'),
                TextEntry::make('shipment.cost')
                    ->label('Ongkir ditagih')
                    ->money('IDR')
                    ->placeholder('—'),
                // Yang dibayar ke Biteship saat booking; selisih dengan "Ongkir
                // ditagih" = markup toko (SHIPPING_MARKUP).
                TextEntry::make('shipment.provider_cost')
                    ->label('Tarif kurir (asli)')
                    ->money('IDR')
                    ->placeholder('—'),
                TextEntry::make('shipment.etd')
                    ->label('Estimasi (dari Biteship)')
                    ->placeholder('—'),
                TextEntry::make('shipment.status')
                    ->label('Status pengiriman')
                    ->badge()
                    ->placeholder('—'),
                TextEntry::make('shipment.tracking_number')
                    ->label('Nomor resi')
                    ->placeholder('Belum ada (booking kurir manual sampai Langkah D)'),
            ]);
    }
}
