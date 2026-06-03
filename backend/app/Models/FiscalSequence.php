<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $document_type
 * @property string $prefix
 * @property int $min_number
 * @property int $max_number
 * @property int $current_number
 * @property string $cai
 * @property Carbon $valid_until
 * @property bool $active
 * @property string|null $active_document_type
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class FiscalSequence extends Model
{
    protected $fillable = [
        'document_type',
        'prefix',
        'min_number',
        'max_number',
        'current_number',
        'cai',
        'valid_until',
        'active',
        'active_document_type',
        'created_by',
        'updated_by',
    ];

    protected static function booted(): void
    {
        static::saving(function (FiscalSequence $sequence): void {
            $sequence->active_document_type = $sequence->active ? $sequence->document_type : null;
        });
    }

    protected function casts(): array
    {
        return [
            'min_number' => 'integer',
            'max_number' => 'integer',
            'current_number' => 'integer',
            'valid_until' => 'date',
            'active' => 'boolean',
        ];
    }
}
