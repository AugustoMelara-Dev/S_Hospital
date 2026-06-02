<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

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

    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function issuer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_by');
    }

    public function voidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by');
    }

    public function cashSession(): BelongsTo
    {
        return $this->belongsTo(CashRegisterSession::class, 'cash_session_id');
    }

    public function fiscalSequence(): BelongsTo
    {
        return $this->belongsTo(FiscalSequence::class);
    }
}
