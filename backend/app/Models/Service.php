<?php

namespace App\Models;

use Database\Factories\ServiceFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use LogicException;

/**
 * @property int $id
 * @property int $category_id
 * @property int|null $area_id
 * @property string $name
 * @property string|null $aliases
 * @property string $slug
 * @property string|null $source_key
 * @property string|null $source_hash
 * @property string|null $scan_code
 * @property string|null $barcode
 * @property string|null $qr_code
 * @property string|null $description
 * @property string|null $internal_code
 * @property string $price
 * @property bool $taxable
 * @property bool $active
 * @property bool $visible_in_billing
 * @property bool $is_billable
 * @property bool $print_on_receipt
 * @property string|null $special_rule_code
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Category|null $category
 * @property-read Area|null $area
 */
class Service extends Model
{
    /** @use HasFactory<ServiceFactory> */
    use HasFactory;

    public const ERYTHROPOIETIN_RULE = 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION';

    protected $fillable = [
        'category_id',
        'area_id',
        'name',
        'aliases',
        'slug',
        'source_key',
        'source_hash',
        'scan_code',
        'barcode',
        'qr_code',
        'description',
        'internal_code',
        'price',
        'taxable',
        'active',
        'visible_in_billing',
        'is_billable',
        'special_rule_code',
        'print_on_receipt',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'taxable' => 'boolean',
            'active' => 'boolean',
            'visible_in_billing' => 'boolean',
            'is_billable' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::deleting(function (Service $service): void {
            if ($service->invoiceItems()->exists()) {
                throw new LogicException('Los servicios facturados no se eliminan; deben desactivarse para conservar el historico.');
            }
        });
    }

    /** @return BelongsTo<Category, $this> */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /** @return BelongsTo<Area, $this> */
    public function area(): BelongsTo
    {
        return $this->belongsTo(Area::class);
    }

    /** @return HasMany<ServicePriceHistory, $this> */
    public function priceHistories(): HasMany
    {
        return $this->hasMany(ServicePriceHistory::class);
    }

    /** @return HasMany<InvoiceItem, $this> */
    public function invoiceItems(): HasMany
    {
        return $this->hasMany(InvoiceItem::class);
    }
}
