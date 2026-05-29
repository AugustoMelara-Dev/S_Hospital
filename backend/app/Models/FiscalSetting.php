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
        'scanner_enabled',
        'partial_payments_enabled',
        'receipt_template_mode',
        'receipt_paper_size',
        'government_line',
        'secretariat_line',
        'receipt_location',
        'receipt_footer_text',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'default_tax_rate' => 'decimal:2',
            'scanner_enabled' => 'boolean',
            'partial_payments_enabled' => 'boolean',
        ];
    }
}
