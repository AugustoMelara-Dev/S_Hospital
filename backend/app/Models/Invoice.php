<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use LogicException;

/**
 * @property int $id
 * @property string $invoice_number
 * @property int $fiscal_sequence_id
 * @property string|null $fiscal_cai
 * @property string|null $fiscal_range_from
 * @property string|null $fiscal_range_to
 * @property Carbon|null $fiscal_valid_until
 * @property string|null $fiscal_prefix
 * @property string|null $hospital_name
 * @property string|null $hospital_rtn
 * @property string|null $hospital_address
 * @property string|null $hospital_phone
 * @property string|null $hospital_slogan
 * @property string|null $receipt_template_mode
 * @property string|null $receipt_paper_size
 * @property string|null $receipt_government_line
 * @property string|null $receipt_secretariat_line
 * @property string|null $receipt_location
 * @property string|null $receipt_footer_text
 * @property string $tax_label
 * @property string|null $tax_rate_snapshot
 * @property string $patient_name
 * @property string $subtotal
 * @property int $subtotal_cents
 * @property string $tax_amount
 * @property int $tax_amount_cents
 * @property string $discount_amount
 * @property int $discount_amount_cents
 * @property string $total
 * @property int $total_cents
 * @property string $paid_amount
 * @property int $paid_amount_cents
 * @property string $balance_due
 * @property int $balance_due_cents
 * @property string $status
 * @property int|null $cash_session_id
 * @property int $issued_by
 * @property Carbon|null $issued_at
 * @property int|null $voided_by
 * @property Carbon|null $voided_at
 * @property string|null $void_reason
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Collection<int, InvoiceItem> $items
 * @property-read Collection<int, Payment> $payments
 * @property-read Collection<int, InstitutionalReceipt> $issuedInstitutionalReceipts
 * @property-read User|null $voidedBy
 */
class Invoice extends Model
{
    public const STATUS_ISSUED = 'issued';

    public const STATUS_PARTIAL = 'partial';

    public const STATUS_PAID = 'paid';

    public const STATUS_VOID = 'void';

    protected $fillable = [
        'invoice_number',
        'fiscal_sequence_id',
        'fiscal_cai',
        'fiscal_range_from',
        'fiscal_range_to',
        'fiscal_valid_until',
        'fiscal_prefix',
        'hospital_name',
        'hospital_rtn',
        'hospital_address',
        'hospital_phone',
        'hospital_slogan',
        'receipt_template_mode',
        'receipt_paper_size',
        'receipt_government_line',
        'receipt_secretariat_line',
        'receipt_location',
        'receipt_footer_text',
        'tax_label',
        'tax_rate_snapshot',
        'patient_name',
        'subtotal',
        'subtotal_cents',
        'tax_amount',
        'tax_amount_cents',
        'discount_amount',
        'discount_amount_cents',
        'total',
        'total_cents',
        'paid_amount',
        'paid_amount_cents',
        'balance_due',
        'balance_due_cents',
        'status',
        'cash_session_id',
        'issued_by',
        'issued_at',
        'voided_by',
        'voided_at',
        'void_reason',
    ];

    protected static function booted(): void
    {
        static::deleting(function (): never {
            throw new LogicException('Las facturas no se eliminan; deben anularse con motivo y auditoria.');
        });
    }

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'subtotal_cents' => 'integer',
            'tax_amount' => 'decimal:2',
            'tax_amount_cents' => 'integer',
            'discount_amount' => 'decimal:2',
            'discount_amount_cents' => 'integer',
            'total' => 'decimal:2',
            'total_cents' => 'integer',
            'paid_amount' => 'decimal:2',
            'paid_amount_cents' => 'integer',
            'balance_due' => 'decimal:2',
            'balance_due_cents' => 'integer',
            'tax_rate_snapshot' => 'decimal:2',
            'fiscal_valid_until' => 'date',
            'issued_at' => 'datetime',
            'voided_at' => 'datetime',
        ];
    }

    /** @return HasMany<InvoiceItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class);
    }

    /** @return HasMany<Payment, $this> */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /** @return HasMany<InstitutionalReceipt, $this> */
    public function institutionalReceipts(): HasMany
    {
        return $this->hasMany(InstitutionalReceipt::class);
    }

    /** @return HasMany<InstitutionalReceipt, $this> */
    public function issuedInstitutionalReceipts(): HasMany
    {
        return $this->hasMany(InstitutionalReceipt::class)
            ->where('status', InstitutionalReceipt::STATUS_ISSUED)
            ->orderByDesc('id');
    }

    /** @return BelongsTo<User, $this> */
    public function issuer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_by');
    }

    /** @return BelongsTo<User, $this> */
    public function voidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by');
    }

    /** @return BelongsTo<CashRegisterSession, $this> */
    public function cashSession(): BelongsTo
    {
        return $this->belongsTo(CashRegisterSession::class, 'cash_session_id');
    }

    /** @return BelongsTo<FiscalSequence, $this> */
    public function fiscalSequence(): BelongsTo
    {
        return $this->belongsTo(FiscalSequence::class);
    }
}
