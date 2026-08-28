<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Exceptions\UnknownMidtransStatusException;

/**
 * Menerjemahkan status resmi Midtrans (transaction_status + fraud_status) ke
 * enum domain kita, dan menentukan konsekuensinya (apakah "paid", status order
 * turunannya).
 *
 * Dipakai oleh MidtransWebhookController atas response Transaction::status()
 * yang di-refetch — BUKAN atas body notification mentah.
 */
class MidtransStatusTranslator
{
    /**
     * @throws UnknownMidtransStatusException  status/fraud tidak ada di mapping
     */
    public function mapToPaymentStatus(string $transactionStatus, ?string $fraudStatus): PaymentStatus
    {
        return match ($transactionStatus) {
            'capture' => match ($fraudStatus) {
                'accept' => PaymentStatus::Capture,
                // challenge → butuh review manual, JANGAN dianggap paid.
                'challenge' => PaymentStatus::Pending,
                'deny' => PaymentStatus::Deny,
                default => throw new UnknownMidtransStatusException(
                    "fraud_status Midtrans tidak dikenal untuk transaction_status 'capture': "
                    .var_export($fraudStatus, true)
                ),
            },
            'settlement' => PaymentStatus::Settlement,
            'pending' => PaymentStatus::Pending,
            'deny' => PaymentStatus::Deny,
            'cancel' => PaymentStatus::Cancel,
            'expire' => PaymentStatus::Expire,
            'failure' => PaymentStatus::Failure,
            'refund' => PaymentStatus::Refund,
            'partial_refund' => PaymentStatus::PartialRefund,
            'authorize' => PaymentStatus::Authorize,
            default => throw new UnknownMidtransStatusException(
                'transaction_status Midtrans tidak dikenal: '.var_export($transactionStatus, true)
            ),
        };
    }

    /**
     * Status yang berarti uang sudah masuk → order jadi "paid" & stok dipotong.
     */
    public function isPaidStatus(PaymentStatus $status): bool
    {
        return in_array($status, [PaymentStatus::Settlement, PaymentStatus::Capture], true);
    }

    /**
     * Status order turunan dari status payment. `null` berarti status order
     * TIDAK diubah (dibiarkan apa adanya).
     */
    public function mapToOrderStatus(PaymentStatus $status): ?OrderStatus
    {
        return match ($status) {
            PaymentStatus::Settlement, PaymentStatus::Capture => OrderStatus::Paid,
            PaymentStatus::Deny,
            PaymentStatus::Cancel,
            PaymentStatus::Expire,
            PaymentStatus::Failure => OrderStatus::Cancelled,
            // Pending/Authorize: belum jelas → jangan sentuh status order.
            PaymentStatus::Pending, PaymentStatus::Authorize => null,
            // Refund/PartialRefund: di luar scope fase ini (lihat known
            // limitation di docs/decisions/payments-midtrans.md) — status order
            // TIDAK diotak-atik otomatis.
            PaymentStatus::Refund, PaymentStatus::PartialRefund => null,
        };
    }
}
