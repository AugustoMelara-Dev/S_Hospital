<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

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
