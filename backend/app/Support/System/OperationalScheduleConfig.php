<?php

declare(strict_types=1);

namespace App\Support\System;

final class OperationalScheduleConfig
{
    public static function time(mixed $value, string $default): string
    {
        return is_string($value) && preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $value) === 1
            ? $value
            : $default;
    }

    public static function retentionDays(mixed $value, int $default): int
    {
        if (is_string($value) && ctype_digit($value)) {
            $value = (int) $value;
        }

        return is_int($value) && $value >= 1 && $value <= 3650
            ? $value
            : $default;
    }
}
