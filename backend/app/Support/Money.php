<?php

namespace App\Support;

use Illuminate\Validation\ValidationException;

class Money
{
    public static function parseCents(string $value, string $field): int
    {
        $normalized = trim($value);

        if (! preg_match('/^\d+(\.\d{1,2})?$/', $normalized)) {
            throw ValidationException::withMessages([
                $field => 'El monto debe tener maximo dos decimales.',
            ]);
        }

        [$integer, $decimal] = array_pad(explode('.', $normalized, 2), 2, '00');

        return ((int) $integer * 100) + (int) str_pad(substr($decimal, 0, 2), 2, '0');
    }

    public static function parsePositiveCents(string $value, string $field): int
    {
        $cents = self::parseCents($value, $field);

        if ($cents <= 0) {
            throw ValidationException::withMessages([
                $field => 'El monto debe ser mayor que cero.',
            ]);
        }

        return $cents;
    }

    public static function parseSignedCents(string $value, string $field): int
    {
        $normalized = trim($value);

        if (! preg_match('/^-?\d+(\.\d{1,2})?$/', $normalized)) {
            throw ValidationException::withMessages([
                $field => 'El monto debe tener maximo dos decimales.',
            ]);
        }

        $sign = $normalized !== '' && $normalized[0] === '-' ? -1 : 1;
        $absolute = ltrim($normalized, '-');

        [$integer, $decimal] = array_pad(explode('.', $absolute, 2), 2, '00');

        return $sign * (((int) $integer * 100) + (int) str_pad(substr($decimal, 0, 2), 2, '0'));
    }

    public static function formatCents(int $cents): string
    {
        $sign = $cents < 0 ? '-' : '';
        $absolute = abs($cents);

        return $sign.intdiv($absolute, 100).'.'.str_pad((string) ($absolute % 100), 2, '0', STR_PAD_LEFT);
    }
}
