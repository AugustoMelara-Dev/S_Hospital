<?php

namespace Tests\Unit;

use App\Actions\Reports\ReportDate;
use InvalidArgumentException;
use Tests\TestCase;

class ReportDateTest extends TestCase
{
    public function test_parses_exact_valid_day_and_month_values(): void
    {
        $this->assertSame('2026-07-17', ReportDate::day('2026-07-17')->toDateString());
        $this->assertSame('2024-02-01', ReportDate::month('2024-02')->toDateString());
    }

    public function test_rejects_nonexistent_or_non_exact_values(): void
    {
        foreach ([
            ['day', '2026-02-30'],
            ['day', '17-07-2026'],
            ['month', '2026-13'],
            ['month', '2026-7'],
        ] as [$method, $value]) {
            try {
                ReportDate::{$method}($value);
                $this->fail("Expected {$method} parser to reject {$value}.");
            } catch (InvalidArgumentException) {
                $this->addToAssertionCount(1);
            }
        }
    }
}
