<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CashMovement extends Model
{
    public const TYPE_OPENING = 'opening';

    public const TYPE_PAYMENT = 'payment';

    public const TYPE_PAYMENT_VOID = 'payment_void';

    public const TYPE_CLOSING = 'closing';

    protected $fillable = [
        'cash_session_id',
        'payment_id',
        'user_id',
        'type',
        'method',
        'amount',
        'notes',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'occurred_at' => 'datetime',
        ];
    }

    public function cashSession(): BelongsTo
    {
        return $this->belongsTo(CashRegisterSession::class, 'cash_session_id');
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
