<?php

namespace Tests\Unit;

use Tests\TestCase;

class PaymentCentsSqlGuardTest extends TestCase
{
    private function readSource(string $relativePath): string
    {
        $path = base_path($relativePath);

        $this->assertFileExists($path, "Expected file to exist at {$path}");

        $contents = file_get_contents($path);

        $this->assertNotFalse($contents, "Could not read file at {$path}");

        return $contents;
    }

    public function test_report_services_prefer_payment_amount_cents_over_float_round(): void
    {
        $files = [
            'app/Actions/Reports/DashboardReportService.php',
            'app/Actions/Reports/DailyReportService.php',
        ];

        foreach ($files as $relativePath) {
            $source = $this->readSource($relativePath);

            $this->assertStringNotContainsString(
                'ROUND(payments.amount * 100)',
                $source,
                "{$relativePath} must not compute cents via ROUND(payments.amount * 100) since the payments table has an integer amount_cents column."
            );

            $this->assertStringContainsString(
                'payments.amount_cents',
                $source,
                "{$relativePath} must aggregate payments.amount_cents instead of recomputing cents via SQL float math."
            );
        }
    }
}
