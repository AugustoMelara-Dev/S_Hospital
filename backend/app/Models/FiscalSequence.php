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
        'created_by',
        'updated_by',
    ];

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
