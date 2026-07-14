<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use LogicException;

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

    protected static function booted(): void
    {
        static::creating(function (CashMovement $movement): void {
            $movement->guardClosedCashSessionMutation();
        });

        static::updating(function (CashMovement $movement): void {
            $movement->guardClosedCashSessionMutation();
        });

        static::deleting(function (CashMovement $movement): void {
            $movement->guardClosedCashSessionMutation();
        });
    }

    private function guardClosedCashSessionMutation(): void
    {
        $cashSessionIds = array_values(array_unique(array_filter([
            $this->getOriginal('cash_session_id'),
            $this->cash_session_id,
        ], fn ($cashSessionId): bool => $cashSessionId !== null)));

        $hasClosedSession = CashRegisterSession::query()
            ->whereIn('id', $cashSessionIds)
            ->where('status', CashRegisterSession::STATUS_CLOSED)
            ->exists();

        if ($hasClosedSession) {
            throw new LogicException('Los movimientos de caja cerrada no se modifican; use ajustes autorizados para correcciones posteriores.');
        }
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
