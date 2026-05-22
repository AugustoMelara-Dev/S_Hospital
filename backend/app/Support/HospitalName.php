<?php

namespace App\Support;

final class HospitalName
{
    private const FALLBACK = 'Caja hospitalaria';

    private const INTERNAL_NAMES = [
        'hospital billing os',
        's_hospital billing os',
        'hospital billing os offline',
    ];

    public static function display(?string $name): string
    {
        $trimmed = trim((string) $name);

        if ($trimmed === '') {
            return self::FALLBACK;
        }

        return in_array(strtolower($trimmed), self::INTERNAL_NAMES, true)
            ? self::FALLBACK
            : $trimmed;
    }
}
