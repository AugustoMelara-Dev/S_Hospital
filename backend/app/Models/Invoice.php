<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Invoice extends Model
{
    public const STATUS_ISSUED = 'issued';

    protected $fillable = [
        'invoice_number',
        'fiscal_sequence_id',
        'patient_name',
        'subtotal',
        'tax_amount',
        'discount_amount',
        'total',
        'paid_amount',
        'balance_due',
        'status',
        'issued_by',
        'issued_at',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'total' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'balance_due' => 'decimal:2',
            'issued_at' => 'datetime',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class);
    }

    public function issuer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_by');
    }

    public function fiscalSequence(): BelongsTo
    {
        return $this->belongsTo(FiscalSequence::class);
    }
}
