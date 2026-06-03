<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $cash_session_id
 * @property int|null $payment_id
 * @property int $user_id
 * @property string $type
 * @property string|null $method
 * @property string $amount
 * @property string|null $notes
 * @property Carbon $occurred_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read CashRegisterSession|null $cashSession
 * @property-read Payment|null $payment
 * @property-read User|null $user
 */
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

    /**
     * @return BelongsTo<CashRegisterSession, $this>
     */
    public function cashSession(): BelongsTo
    {
        return $this->belongsTo(CashRegisterSession::class, 'cash_session_id');
    }

    /**
     * @return BelongsTo<Payment, $this>
     */
    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
