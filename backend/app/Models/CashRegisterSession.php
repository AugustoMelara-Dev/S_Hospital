<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use LogicException;

/**
 * @property int $id
 * @property int $user_id
 * @property int|null $open_user_id
 * @property int|null $closed_by_user_id
 * @property string $opening_amount
 * @property string|null $closing_amount
 * @property string|null $expected_amount
 * @property string|null $difference_amount
 * @property int|null $payments_count_snapshot
 * @property string|null $payments_total_snapshot
 * @property array<string, mixed>|null $method_totals_snapshot
 * @property int|null $pending_invoice_count_snapshot
 * @property string|null $pending_amount_snapshot
 * @property string $status
 * @property string|null $opening_notes
 * @property string|null $closing_notes
 * @property array{bills: array<int, int>, other_amount: string}|null $closing_breakdown
 * @property Carbon|null $opened_at
 * @property Carbon|null $closed_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User|null $user
 * @property-read User|null $closedBy
 */
class CashRegisterSession extends Model
{
    public const STATUS_OPEN = 'open';

    public const STATUS_CLOSED = 'closed';

    protected $fillable = [
        'user_id',
        'open_user_id',
        'closed_by_user_id',
        'opening_amount',
        'closing_amount',
        'expected_amount',
        'difference_amount',
        'payments_count_snapshot',
        'payments_total_snapshot',
        'method_totals_snapshot',
        'pending_invoice_count_snapshot',
        'pending_amount_snapshot',
        'status',
        'opening_notes',
        'closing_notes',
        'closing_breakdown',
        'opened_at',
        'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'opening_amount' => 'decimal:2',
            'closing_amount' => 'decimal:2',
            'expected_amount' => 'decimal:2',
            'difference_amount' => 'decimal:2',
            'payments_count_snapshot' => 'integer',
            'payments_total_snapshot' => 'decimal:2',
            'method_totals_snapshot' => 'array',
            'pending_invoice_count_snapshot' => 'integer',
            'pending_amount_snapshot' => 'decimal:2',
            'closing_breakdown' => 'array',
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::updating(function (CashRegisterSession $session): void {
            if ($session->getOriginal('status') === self::STATUS_CLOSED) {
                throw new LogicException('Las cajas cerradas no se modifican; use ajustes autorizados para correcciones posteriores.');
            }
        });

        static::deleting(function (CashRegisterSession $session): void {
            if ($session->status === self::STATUS_CLOSED) {
                throw new LogicException('Las cajas cerradas no se eliminan; conserve el cierre para auditoria.');
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by_user_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class, 'cash_session_id');
    }

    public function movements(): HasMany
    {
        return $this->hasMany(CashMovement::class, 'cash_session_id');
    }
}
