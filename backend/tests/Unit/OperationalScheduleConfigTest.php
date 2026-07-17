<?php

namespace Tests\Unit;

use App\Support\System\OperationalScheduleConfig;
use PHPUnit\Framework\TestCase;

class OperationalScheduleConfigTest extends TestCase
{
    public function test_time_accepts_valid_clock_values_and_rejects_invalid_configuration(): void
    {
        $this->assertSame('23:59', OperationalScheduleConfig::time('23:59', '02:00'));
        $this->assertSame('02:00', OperationalScheduleConfig::time('24:00', '02:00'));
        $this->assertSame('02:00', OperationalScheduleConfig::time(['02:00'], '02:00'));
    }

    public function test_retention_days_accepts_safe_integers_and_falls_back_outside_bounds(): void
    {
        $this->assertSame(90, OperationalScheduleConfig::retentionDays(90, 30));
        $this->assertSame(90, OperationalScheduleConfig::retentionDays('90', 30));
        $this->assertSame(30, OperationalScheduleConfig::retentionDays(0, 30));
        $this->assertSame(30, OperationalScheduleConfig::retentionDays(3651, 30));
        $this->assertSame(30, OperationalScheduleConfig::retentionDays(['90'], 30));
    }
}
