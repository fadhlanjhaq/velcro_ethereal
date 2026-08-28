<?php

namespace App\Enums;

enum PaymentStatus: string
{
    case Pending = 'pending';
    case Settlement = 'settlement';
    case Expire = 'expire';
    case Cancel = 'cancel';
    case Deny = 'deny';
    case Capture = 'capture';
    case Refund = 'refund';
    case PartialRefund = 'partial_refund';
    case Authorize = 'authorize';
    case Failure = 'failure';
}
