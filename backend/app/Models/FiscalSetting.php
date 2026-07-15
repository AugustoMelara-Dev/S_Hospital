<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $hospital_name
 * @property string $rtn
 * @property string $default_tax_rate
 * @property string $receipt_width
 * @property string $primary_color
 * @property string|null $address
 * @property string|null $phone
 * @property string|null $slogan
 * @property bool $scanner_enabled
 * @property bool $partial_payments_enabled
 * @property string $receipt_template_mode
 * @property string $receipt_paper_size
 * @property string|null $government_line
 * @property string|null $secretariat_line
 * @property string|null $receipt_location
 * @property string|null $receipt_footer_text
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class FiscalSetting extends Model
{
    protected $hidden = [
        'receipt_width',
    ];

    protected $fillable = [
        'hospital_name',
        'rtn',
        'default_tax_rate',
        'receipt_width',
        'primary_color',
        'address',
        'phone',
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
