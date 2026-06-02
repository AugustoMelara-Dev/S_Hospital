<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvoiceItem extends Model
{
    protected $fillable = [
        'invoice_id',
        'service_id',
        'service_name',
        'category_id',
        'category_name',
        'area_id',
        'area_name',
        'scan_code',
        'barcode',
        'qr_code',
        'quantity',
        'unit_price',
        'unit_price_cents',
        'tax_rate',
        'tax_amount',
        'tax_amount_cents',
        'line_subtotal',
        'line_subtotal_cents',
        'line_total',
        'line_total_cents',
        'special_rule_code',
        'special_rule_applied',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_price' => 'decimal:2',
            'unit_price_cents' => 'integer',
            'tax_rate' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'tax_amount_cents' => 'integer',
            'line_subtotal' => 'decimal:2',
            'line_subtotal_cents' => 'integer',
            'line_total' => 'decimal:2',
            'line_total_cents' => 'integer',
            'special_rule_applied' => 'boolean',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function area(): BelongsTo
    {
        return $this->belongsTo(Area::class);
    }
}
