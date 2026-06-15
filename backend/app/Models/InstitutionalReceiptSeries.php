<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $document_type
 * @property string $series
 * @property string $prefix
 * @property string $number_format
 * @property int $min_number
 * @property int $max_number
 * @property int $current_number
 * @property string|null $range_authorization
 * @property string|null $legal_text
 * @property string $receipt_number_color
 * @property bool $active
 * @property string|null $active_document_type
 * @property string $reprint_behavior
 * @property string $void_behavior
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Collection<int, InstitutionalReceipt> $receipts
 */
class InstitutionalReceiptSeries extends Model
{
    public const DOCUMENT_TYPE = 'institutional_receipt';

    public const REPRINT_AUDIT_ONLY = 'audit_only';

    public const REPRINT_REQUIRE_REASON = 'require_reason';

    public const VOID_PERMISSION_REASON_AUDIT = 'permission_reason_audit';

    protected $table = 'institutional_receipt_series';

    protected $fillable = [
        'document_type',
        'series',
        'prefix',
        'number_format',
        'min_number',
        'max_number',
        'current_number',
        'range_authorization',
        'legal_text',
        'receipt_number_color',
        'active',
        'active_document_type',
        'reprint_behavior',
        'void_behavior',
        'created_by',
        'updated_by',
    ];

    protected static function booted(): void
    {
        static::saving(function (InstitutionalReceiptSeries $series): void {
            $series->document_type = $series->document_type ?: self::DOCUMENT_TYPE;
            $series->active_document_type = $series->active ? $series->document_type : null;
        });
    }

    protected function casts(): array
    {
        return [
            'min_number' => 'integer',
            'max_number' => 'integer',
            'current_number' => 'integer',
            'active' => 'boolean',
        ];
    }

    public function receipts(): HasMany
    {
        return $this->hasMany(InstitutionalReceipt::class, 'series_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
