<?php

namespace App\Filament\Resources\Orders\Pages;

use App\Exceptions\ShipmentBookingException;
use App\Exceptions\ShippingProviderException;
use App\Filament\Resources\Orders\OrderResource;
use App\Models\Order;
use App\Services\Shipping\ShipmentBookingService;
use Filament\Actions\Action;
use Filament\Actions\EditAction;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\ViewRecord;
use Throwable;

class ViewOrder extends ViewRecord
{
    protected static string $resource = OrderResource::class;

    protected function getHeaderActions(): array
    {
        return [
            $this->bookShipmentAction(),
            EditAction::make(),
        ];
    }

    /**
     * "Siap Kirim" — booking kurir ke Biteship secara sinkron (Langkah D2).
     * Hanya untuk order paid yang punya shipment dan belum dibooking; label jadi
     * "Coba Lagi" kalau percobaan sebelumnya gagal (aksi yang sama).
     */
    private function bookShipmentAction(): Action
    {
        return Action::make('bookShipment')
            ->label(fn (Order $record): string => $record->shipment?->bookingFailed() ? 'Coba Lagi' : 'Siap Kirim')
            ->icon('heroicon-o-truck')
            ->color(fn (Order $record): string => $record->shipment?->bookingFailed() ? 'danger' : 'success')
            ->visible(fn (Order $record): bool => ShipmentBookingService::canBook($record))
            ->requiresConfirmation()
            ->modalHeading('Pesan kurir')
            ->modalDescription(function (Order $record): string {
                $shipment = $record->shipment;
                $text = "Pesan kurir {$shipment?->courier_name} {$shipment?->service_name} sekarang? "
                    .'Kurir akan menjemput ke alamat gudang.';

                if ($shipment?->insurance_value !== null) {
                    $text .= ' (dengan asuransi '.self::rupiah($shipment->insurance_value).')';
                }

                return $text;
            })
            ->modalSubmitActionLabel('Pesan kurir')
            ->action(function (Order $record): void {
                try {
                    $outcome = app(ShipmentBookingService::class)->book($record);
                } catch (ShipmentBookingException|ShippingProviderException $e) {
                    // Alasan sudah tersimpan di shipments.booking_error (kalau
                    // relevan); notifikasi persisten supaya tidak terlewat.
                    Notification::make()
                        ->danger()
                        ->title('Booking kurir gagal')
                        ->body($e->getMessage())
                        ->persistent()
                        ->send();

                    $this->refreshRecord();

                    return;
                } catch (Throwable $e) {
                    // Kesalahan tak terduga (mis. DB putus SETELAH Biteship
                    // menerima order): status di Biteship tidak diketahui.
                    report($e);

                    Notification::make()
                        ->danger()
                        ->title('Booking kurir gagal')
                        ->body('Terjadi kesalahan sistem. Cek dashboard Biteship sebelum mencoba lagi — order mungkin sudah tercatat di sana.')
                        ->persistent()
                        ->send();

                    $this->refreshRecord();

                    return;
                }

                $shipment = $outcome->shipment;

                Notification::make()
                    ->success()
                    ->title('Kurir dipesan')
                    ->body($shipment->tracking_number !== null
                        ? "Nomor resi: {$shipment->tracking_number}"
                        : 'Resi belum terbit dari kurir — cek lagi nanti di dashboard Biteship.')
                    ->send();

                // Booking tetap sah walau harganya beda (pembeli sudah bayar);
                // admin cukup tahu selisihnya.
                if ($outcome->priceDifference() !== 0) {
                    $difference = $outcome->priceDifference();

                    Notification::make()
                        ->warning()
                        ->title('Harga booking berbeda dari perkiraan')
                        ->body(
                            'Biteship menagih '.self::rupiah($outcome->bookedPrice)
                            .', perkiraan saat checkout '.self::rupiah($outcome->expectedPrice)
                            .' (selisih '.($difference > 0 ? '+' : '−').self::rupiah(abs($difference)).').'
                        )
                        ->persistent()
                        ->send();
                }

                $this->refreshRecord();
            });
    }

    /**
     * Muat ulang order + shipment supaya infolist & visibilitas tombol
     * mengikuti hasil booking terbaru.
     */
    private function refreshRecord(): void
    {
        $this->record->refresh();
        $this->record->load('shipment');
    }

    private static function rupiah(mixed $amount): string
    {
        return 'Rp '.number_format((float) $amount, 0, ',', '.');
    }
}
