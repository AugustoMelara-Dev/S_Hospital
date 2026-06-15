<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $invoice_id
 * @property int|null $service_id
 * @property string $service_name
 * @property int|null $category_id
 * @property string $category_name
 * @property int|null $area_id
 * @property string|null $area_name
 * @property int|null $service_area_id
 * @property string|null $service_area_name
 * @property string|null $scan_code
 * @property string|null $barcode
 * @property string|null $qr_code
 * @property string $quantity
 * @property int $quantity_cents
 * @property string $unit_price
 * @property int $unit_price_cents
 * @property string $tax_rate
 * @property string $tax_amount
 * @property int $tax_amount_cents
 * @property string $line_subtotal
 * @property int $line_subtotal_cents
 * @property string $line_total
 * @property int $line_total_cents
 * @property string|null $special_rule_code
 * @property bool $special_rule_applied
 * @property string|null $notes
 */
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
        'service_area_id',
        'service_area_name',
        'scan_code',
        'barcode',
        'qr_code',
        'quantity',
        'quantity_cents',
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
            'quantity_cents' => 'integer',
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
