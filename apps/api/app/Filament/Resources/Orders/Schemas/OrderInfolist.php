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
                // Asuransi pengiriman (opsional, dibayar pembeli). Order tanpa
                // asuransi (termasuk order lama) → 0 → tidak ditampilkan.
                TextEntry::make('insurance_fee')
                    ->label('Asuransi pengiriman')
                    ->money('IDR')
                    ->visible(fn (Order $record): bool => (float) $record->insurance_fee > 0),
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
                // null insurance_value = tidak diasuransikan. Nilai pertanggungan
                // ini yang dikirim ke Biteship saat booking (Langkah D2).
                TextEntry::make('shipment_insurance')
                    ->label('Asuransi')
                    ->state(function (Order $record): string {
                        $value = $record->shipment?->insurance_value;

                        if ($value === null) {
                            return 'Tidak';
                        }

                        $rupiah = static fn ($amount): string => 'Rp '.number_format((float) $amount, 0, ',', '.');

                        return 'Pertanggungan '.$rupiah($value)
                            .' (biaya '.$rupiah($record->shipment->insurance_fee).')';
                    }),
                TextEntry::make('shipment.etd')
                    ->label('Estimasi (dari Biteship)')
                    ->placeholder('—'),
                TextEntry::make('shipment.status')
                    ->label('Status pengiriman')
                    ->badge()
                    ->placeholder('—'),
                // Booking kurir (tombol "Siap Kirim", Langkah D2).
                TextEntry::make('shipment_booking_status')
                    ->label('Status booking kurir')
                    ->badge()
                    ->state(fn (Order $record): ?string => match (true) {
                        $record->shipment === null => null,
                        $record->shipment->isBooked() => 'Dibooking',
                        $record->shipment->bookingFailed() => 'Booking gagal',
                        default => 'Belum dibooking',
                    })
                    ->color(fn (?string $state): string => match ($state) {
                        'Dibooking' => 'success',
                        'Booking gagal' => 'danger',
                        default => 'gray',
                    })
                    ->placeholder('—'),
                TextEntry::make('shipment.booked_at')
                    ->label('Dibooking pada')
                    ->dateTime()
                    ->placeholder('—'),
                // Status kurir terakhir dari webhook Biteship (Langkah E2), apa
                // adanya — termasuk status bermasalah yang tidak punya padanan
                // di status pengiriman di atas.
                TextEntry::make('shipment.provider_status')
                    ->label('Status kurir terakhir')
                    ->badge()
                    ->color(fn (Order $record): string => $record->shipment?->hasProviderProblem() ? 'danger' : 'gray')
                    ->formatStateUsing(fn (?string $state, Order $record): string => $record->shipment?->hasProviderProblem()
                        ? "Bermasalah: {$state}"
                        : (string) $state)
                    ->placeholder('Belum ada kabar dari kurir'),
                TextEntry::make('shipment.provider_status_at')
                    ->label('Kabar kurir diterima')
                    ->dateTime()
                    ->placeholder('—'),
                TextEntry::make('shipment.shipped_at')
                    ->label('Dijemput kurir')
                    ->dateTime()
                    ->placeholder('—'),
                TextEntry::make('shipment.delivered_at')
                    ->label('Sampai di penerima')
                    ->dateTime()
                    ->placeholder('—'),
                // Alasan & waktu percobaan hanya relevan selama belum ada booking
                // yang sukses.
                TextEntry::make('shipment.booking_error')
                    ->label('Alasan booking gagal')
                    ->color('danger')
                    ->visible(fn (Order $record): bool => (bool) $record->shipment?->bookingFailed())
                    ->columnSpanFull(),
                TextEntry::make('shipment.booking_attempted_at')
                    ->label('Percobaan terakhir')
                    ->dateTime()
                    ->visible(fn (Order $record): bool => (bool) $record->shipment?->bookingFailed()),
                TextEntry::make('shipment.tracking_number')
                    ->label('Nomor resi')
                    ->copyable()
                    ->placeholder('—'),
                TextEntry::make('shipment.biteship_tracking_id')
                    ->label('Tracking ID Biteship')
                    ->placeholder('—'),
                TextEntry::make('shipment.tracking_link')
                    ->label('Link lacak')
                    ->url(fn (?string $state): ?string => $state)
                    ->openUrlInNewTab()
                    ->placeholder('—'),
                TextEntry::make('shipment.biteship_order_id')
                    ->label('ID order Biteship')
                    ->copyable()
                    ->placeholder('—'),
                // Harga aktual vs perkiraan (provider_cost + insurance_fee). Beda
                // tidak menggagalkan booking — selisih ditanggung / jadi margin toko.
                TextEntry::make('shipment.booked_price')
                    ->label('Harga booking aktual')
                    ->money('IDR')
                    ->placeholder('—'),
                // Event order.price (mis. berat aktual ditimbang kurir). Selisih
                // ditanggung toko — pembeli sudah membayar ongkir saat checkout.
                TextEntry::make('shipment_final_price_warning')
                    ->label('Peringatan tagihan kurir')
                    ->color('warning')
                    ->state(function (Order $record): ?string {
                        $shipment = $record->shipment;

                        if ($shipment === null || ! $shipment->finalPriceChanged()) {
                            return null;
                        }

                        $rupiah = static fn ($amount): string => 'Rp '.number_format((float) $amount, 0, ',', '.');

                        return 'Tagihan kurir berubah: '.$rupiah($shipment->booked_price)
                            .' → '.$rupiah($shipment->provider_final_price).' (selisih ditanggung toko)';
                    })
                    ->visible(fn (Order $record): bool => (bool) $record->shipment?->finalPriceChanged())
                    ->columnSpanFull(),
                TextEntry::make('shipment_expected_booking_price')
                    ->label('Perkiraan harga booking')
                    ->state(fn (Order $record): ?int => $record->shipment?->expectedBookingPrice())
                    ->money('IDR')
                    ->hint('Tarif kurir asli + asuransi, saat checkout')
                    ->placeholder('—'),
            ]);
    }
}
