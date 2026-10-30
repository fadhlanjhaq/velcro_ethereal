<?php

namespace App\Filament\Resources\Orders\Tables;

use App\Enums\OrderStatus;
use App\Enums\ShipmentStatus;
use App\Models\Order;
use App\Services\Shipping\BiteshipOrderStatus;
use Filament\Actions\EditAction;
use Filament\Actions\ViewAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class OrdersTable
{
    public static function configure(Table $table): Table
    {
        return $table
            // Kolom "Pengiriman" membaca relasi shipment per baris.
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with('shipment'))
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('order_number')
                    ->label('Nomor order')
                    ->searchable(),
                TextColumn::make('customer')
                    ->label('Customer')
                    ->state(fn (Order $record): string => $record->user?->name
                        ?? $record->guest_name
                        ?? '—')
                    ->searchable(query: fn (Builder $query, string $search): Builder => $query->where(
                        fn (Builder $q) => $q
                            ->where('guest_name', 'like', "%{$search}%")
                            ->orWhere('guest_email', 'like', "%{$search}%")
                            ->orWhereHas('user', fn (Builder $uq) => $uq->where('name', 'like', "%{$search}%")),
                    )),
                TextColumn::make('total')
                    ->money('IDR')
                    ->sortable(),
                TextColumn::make('status')
                    ->badge()
                    ->color(fn (OrderStatus $state): string => match ($state) {
                        OrderStatus::Pending => 'warning',
                        OrderStatus::Paid, OrderStatus::Processing => 'info',
                        OrderStatus::Shipped => 'primary',
                        OrderStatus::Completed => 'success',
                        OrderStatus::Cancelled => 'danger',
                    }),
                // Status pengiriman (booking D2 + webhook E2). Order tanpa
                // shipment (mis. sebelum Biteship) → kosong.
                TextColumn::make('shipment_booking')
                    ->label('Pengiriman')
                    ->badge()
                    ->state(fn (Order $record): ?string => self::shipmentBadge($record)['label'] ?? null)
                    ->color(fn (Order $record): string => self::shipmentBadge($record)['color'] ?? 'gray'),
                TextColumn::make('created_at')
                    ->label('Tanggal')
                    ->dateTime()
                    ->sortable(),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->options(OrderStatus::class),
                // Antrian kerja admin: sudah dibayar, kurir belum dipesan.
                Filter::make('perlu_dikirim')
                    ->label('Perlu dikirim')
                    ->query(fn (Builder $query): Builder => $query
                        ->where('status', OrderStatus::Paid)
                        ->whereHas('shipment', fn (Builder $q): Builder => $q->whereNull('biteship_order_id'))),
                // Status kurir terakhir dari webhook termasuk kelompok bermasalah.
                Filter::make('bermasalah')
                    ->label('Bermasalah')
                    ->query(fn (Builder $query): Builder => $query
                        ->whereHas('shipment', fn (Builder $q): Builder => $q
                            ->whereIn('provider_status', BiteshipOrderStatus::PROBLEM))),
                Filter::make('booking_gagal')
                    ->label('Booking gagal')
                    ->query(fn (Builder $query): Builder => $query
                        ->whereHas('shipment', fn (Builder $q): Builder => $q
                            ->whereNull('biteship_order_id')
                            ->whereNotNull('booking_error'))),
            ])
            ->recordActions([
                ViewAction::make(),
                EditAction::make(),
            ]);
    }

    /**
     * Label + warna badge "Pengiriman", satu tempat supaya keduanya tidak
     * bisa tidak sinkron. Prioritas: bermasalah (dari webhook) > sampai >
     * dikirim > dibooking (resi) > booking gagal > belum dibooking.
     *
     * @return array{label: string, color: string}|null  null = order tanpa shipment
     */
    private static function shipmentBadge(Order $record): ?array
    {
        $shipment = $record->shipment;

        if ($shipment === null) {
            return null;
        }

        return match (true) {
            $shipment->hasProviderProblem() => ['label' => "Bermasalah: {$shipment->provider_status}", 'color' => 'danger'],
            $shipment->status === ShipmentStatus::Delivered => ['label' => 'Sampai', 'color' => 'success'],
            $shipment->status === ShipmentStatus::Shipped => ['label' => 'Dikirim', 'color' => 'info'],
            $shipment->isBooked() => [
                'label' => $shipment->tracking_number !== null ? "Resi {$shipment->tracking_number}" : 'Dibooking',
                'color' => 'success',
            ],
            $shipment->bookingFailed() => ['label' => 'Booking gagal', 'color' => 'danger'],
            default => ['label' => 'Belum dibooking', 'color' => 'gray'],
        };
    }
}
