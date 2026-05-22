<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class ReportMoneyArchitectureTest extends TestCase
{
    public function test_operational_report_services_do_not_use_float_money_arithmetic(): void
    {
        $files = [
            __DIR__.'/../../app/Actions/Reports/IncomeReportService.php',
            __DIR__.'/../../app/Actions/Reports/OperationsReportService.php',
        ];

        foreach ($files as $file) {
            $source = file_get_contents($file);

            $this->assertIsString($source);
            $this->assertStringNotContainsString('(float)', $source, basename($file).' must use cent-based money helpers.');
        }
    }
}
