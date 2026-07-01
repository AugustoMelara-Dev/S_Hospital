<?php

namespace App\Support;

class ReceiptPaperSize
{
    public const DEFAULT = 'half_letter';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return ['half_letter', 'letter', 'a5', '80mm', '58mm'];
    }

    public static function normalize(?string $value): string
    {
        return in_array($value, self::values(), true) ? $value : self::DEFAULT;
    }

    public static function fromProfilePaperKind(?string $paperKind): string
    {
        return match ($paperKind) {
            'letter_landscape' => 'letter',
            'a5_landscape' => 'a5',
            'thermal_80mm' => '80mm',
            'thermal_58mm' => '58mm',
            'half_letter_landscape' => 'half_letter',
            default => self::normalize($paperKind),
        };
    }
}
