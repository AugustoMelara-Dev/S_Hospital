<?php

declare(strict_types=1);

use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
|
| All cashier-facing real-time channels are authorized here. The
| authorization depends on the permission scope, not on a specific
| resource id: a cajero with `invoices.view` can subscribe to
| `invoices` and receive every new invoice, void, payment and reverse
| event. This is the desired behaviour for a small hospital LAN where
| every cashier needs situational awareness of the whole day's
| activity. Tighten in v1.1 if scope becomes an issue.
|
*/

Broadcast::channel('invoices', function ($user): bool {
    return $user !== null && $user->can('invoices.view');
});

Broadcast::channel('cash', function ($user): bool {
    return $user !== null && $user->can('cash.view');
});

Broadcast::channel('payments', function ($user): bool {
    return $user !== null && $user->can('payments.view');
});

Broadcast::channel('settings', function ($user): bool {
    return $user !== null && $user->can('settings.fiscal.view');
});

Broadcast::channel('backups', function ($user): bool {
    return $user !== null && $user->can('backups.view');
});
