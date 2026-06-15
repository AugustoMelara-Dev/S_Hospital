<?php

namespace App\Support;

class ExcelSafe
{
    public static function value(mixed $value): mixed
    {
        if (! is_string($value)) {
            return $value;
        }

        if ($value === '') {
            return $value;
        }

        return preg_match('/^[=+\-@\t\r\n]/', $value) === 1
            ? "'".$value
            : $value;
    }
}
