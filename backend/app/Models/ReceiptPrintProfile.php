<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string $paper_kind
 * @property string $width_mm
 * @property string $height_mm
 * @property string $margin_top_mm
 * @property string $margin_right_mm
 * @property string $margin_bottom_mm
 * @property string $margin_left_mm
 * @property string $orientation
 * @property string $template_code
 * @property string|null $font_family
 * @property string $font_scale
 * @property string $copies_mode
 * @property bool $show_copy_legend
 * @property bool $show_physical_seal_space
 * @property bool $use_logo
 * @property bool $show_technical_fields
 * @property bool $active
 * @property bool $is_global_default
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Collection<int, ReceiptProfileAssignment> $assignments
 * @property-read Collection<int, InstitutionalReceipt> $receipts
 */
class ReceiptPrintProfile extends Model
{
    public const CODE_CUSTOM_SMALL = 'recibo_pequeno_personalizado';

    public const CODE_HALF_LETTER = 'media_carta_horizontal';

    public const CODE_A5 = 'a5_horizontal';

    public const CODE_LETTER = 'carta_horizontal';

    public const CODE_THERMAL_80 = 'thermal_80mm';

    public const CODE_THERMAL_58 = 'thermal_58mm';

    public const SUPPORT_ONLY_CODES = [
        self::CODE_CUSTOM_SMALL,
        self::CODE_THERMAL_80,
        self::CODE_THERMAL_58,
    ];

    protected $fillable = [
        'code',
        'name',
        'paper_kind',
        'width_mm',
        'height_mm',
        'margin_top_mm',
        'margin_right_mm',
        'margin_bottom_mm',
        'margin_left_mm',
        'orientation',
        'template_code',
        'font_family',
        'font_scale',
        'copies_mode',
        'show_copy_legend',
        'show_physical_seal_space',
        'use_logo',
        'show_technical_fields',
        'active',
        'is_global_default',
    ];

    protected function casts(): array
    {
        return [
            'width_mm' => 'decimal:2',
            'height_mm' => 'decimal:2',
            'margin_top_mm' => 'decimal:2',
            'margin_right_mm' => 'decimal:2',
            'margin_bottom_mm' => 'decimal:2',
            'margin_left_mm' => 'decimal:2',
            'font_scale' => 'decimal:2',
            'show_copy_legend' => 'boolean',
            'show_physical_seal_space' => 'boolean',
            'use_logo' => 'boolean',
            'show_technical_fields' => 'boolean',
            'active' => 'boolean',
            'is_global_default' => 'boolean',
        ];
    }

    /** @return HasMany<ReceiptProfileAssignment, $this> */
    public function assignments(): HasMany
    {
        return $this->hasMany(ReceiptProfileAssignment::class);
    }

    /** @return HasMany<InstitutionalReceipt, $this> */
    public function receipts(): HasMany
    {
        return $this->hasMany(InstitutionalReceipt::class, 'print_profile_code', 'code');
    }

    public function isSupportOnly(): bool
    {
        return in_array($this->code, self::SUPPORT_ONLY_CODES, true);
    }
}
