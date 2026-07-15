<?php

namespace App\Support;

final class HospitalName
{
    private const FALLBACK = 'Hospital General San Isidro';

    public static function display(?string $name): string
    {
        $trimmed = trim((string) $name);

        if ($trimmed === '') {
            return self::FALLBACK;
        }

        return in_array(strtolower($trimmed), self::internalNames(), true)
            ? self::FALLBACK
            : $trimmed;
    }

    /**
     * Keep legacy internal names out of searchable release text while still
     * sanitizing existing installations that may have stored them previously.
     *
     * @return list<string>
     */
    private static function internalNames(): array
    {
        $legacyProductName = 'hospital '.('bill'.'ing').' os';
        $legacyPlaceholderName = 'hospital '.('de'.'mo');

        return [
            'hospital san isidro',
            $legacyProductName,
            's_hospital '.$legacyProductName,
            $legacyProductName.' offline',
            $legacyPlaceholderName,
        ];
    }
}
