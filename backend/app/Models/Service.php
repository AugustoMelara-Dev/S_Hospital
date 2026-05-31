<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Service extends Model
{
    use HasFactory;

    public const ERYTHROPOIETIN_RULE = 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION';

    protected $fillable = [
        'category_id',
        'area_id',
        'name',
        'slug',
        'source_key',
        'source_hash',
        'scan_code',
        'barcode',
        'qr_code',
        'aliases',
        'description',
        'internal_code',
        'price',
        'taxable',
        'active',
        'special_rule_code',
        'print_on_receipt',
        'visible_in_billing',
        'is_billable',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'taxable' => 'boolean',
            'active' => 'boolean',
            'aliases' => 'array',
            'print_on_receipt' => 'boolean',
            'visible_in_billing' => 'boolean',
            'is_billable' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function area(): BelongsTo
    {
        return $this->belongsTo(ServiceArea::class, 'area_id');
    }
}
