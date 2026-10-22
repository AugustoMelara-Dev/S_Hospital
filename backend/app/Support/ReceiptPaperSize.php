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
            'letter_landscape', 'letter_portrait' => 'letter',
            'a5_landscape' => 'a5',
            // The legacy invoice receipt only knows half_letter/letter/a5/thermal.
            // A4 portrait has no legacy equivalent, so it uses the closest
            // supported size (letter) for that secondary compatibility path.
            // The institutional PDF keeps the real A4 profile snapshot.
            'a4_portrait' => 'letter',
            'thermal_80mm' => '80mm',
            'thermal_58mm' => '58mm',
            'half_letter_landscape' => 'half_letter',
            default => self::normalize($paperKind),
        };
    }
}
