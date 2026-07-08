<?php

namespace App\Enums;

enum PaymentStatus: string
{
    case Pending = 'pending';
    case Settlement = 'settlement';
    case Expire = 'expire';
    case Cancel = 'cancel';
    case Deny = 'deny';
}
