<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $invoice_id
 * @property int $cash_session_id
 * @property int $user_id
 * @property string $method
 * @property string $amount
 * @property int $amount_cents
 * @property string|null $reference
 * @property string $status
 * @property int|null $voided_by
 * @property Carbon|null $voided_at
 * @property string|null $void_reason
 * @property Carbon|null $paid_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Invoice|null $invoice
 * @property-read CashRegisterSession|null $cashSession
 * @property-read User|null $user
 */
class Payment extends Model
{
    public const STATUS_POSTED = 'posted';

    public const STATUS_VOID = 'void';

    public const METHOD_CASH = 'cash';

    public const METHOD_TRANSFER = 'transfer';

    public const METHOD_CARD = 'card';

    public const METHOD_OTHER = 'other';

    public const METHODS = [
        self::METHOD_CASH,
        self::METHOD_TRANSFER,
        self::METHOD_CARD,
        self::METHOD_OTHER,
    ];

    protected $fillable = [
        'invoice_id',
        'cash_session_id',
        'user_id',
        'method',
        'amount',
        'amount_cents',
        'reference',
        'status',
        'voided_by',
        'voided_at',
        'void_reason',
        'paid_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'amount_cents' => 'integer',
            'voided_at' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function cashSession(): BelongsTo
    {
        return $this->belongsTo(CashRegisterSession::class, 'cash_session_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function voidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by');
    }
}
