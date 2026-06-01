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
        return ['letter', 'half_letter', 'a5', '80mm', '58mm'];
    }

    public static function normalize(?string $value): string
    {
        return in_array($value, self::values(), true) ? $value : self::DEFAULT;
    }
}
