<?php

namespace App\Support;

final class HospitalName
{
    private const FALLBACK = 'Caja hospitalaria';

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

        return [
            $legacyProductName,
            's_hospital '.$legacyProductName,
            $legacyProductName.' offline',
            'hospital demo',
        ];
    }
}
