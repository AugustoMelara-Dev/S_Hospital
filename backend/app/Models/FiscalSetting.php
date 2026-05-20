<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FiscalSetting extends Model
{
    protected $fillable = [
        'hospital_name',
        'rtn',
        'default_tax_rate',
        'receipt_width',
        'primary_color',
        'address',
        'slogan',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'default_tax_rate' => 'decimal:2',
        ];
    }
}
