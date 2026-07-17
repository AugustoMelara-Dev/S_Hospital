<?php

namespace App\Actions\Reports;

use Illuminate\Support\Carbon;
use InvalidArgumentException;
use Throwable;

final class ReportDate
{
    public static function day(string $value): Carbon
    {
        return self::exact('Y-m-d', $value);
    }

    public static function month(string $value): Carbon
    {
        return self::exact('Y-m', $value)->startOfMonth();
    }

    private static function exact(string $format, string $value): Carbon
    {
        try {
            $date = Carbon::createFromFormat($format, $value);
        } catch (Throwable) {
            throw new InvalidArgumentException("Invalid report date: {$value}.");
        }

        if ($date === null || $date->format($format) !== $value) {
            throw new InvalidArgumentException("Invalid report date: {$value}.");
        }

        return $date;
    }
}
