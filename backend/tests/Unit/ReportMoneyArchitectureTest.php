<?php

namespace Tests\Unit;

use Tests\TestCase;

class ReportMoneyArchitectureTest extends TestCase
{
    /**
     * Report exports are evidence for cash review, so money parsing must stay
     * on shared cent-based helpers instead of ad-hoc float casts.
     */
    public function test_report_actions_do_not_parse_money_with_direct_float_casts(): void
    {
        $reportFiles = glob(app_path('Actions/Reports/*.php')) ?: [];

        $this->assertNotEmpty($reportFiles, 'Expected report action files to exist.');

        foreach ($reportFiles as $file) {
            $contents = file_get_contents($file);
            $this->assertIsString($contents);

            $relativePath = str_replace(base_path().DIRECTORY_SEPARATOR, '', $file);

            $this->assertStringNotContainsString('(float)', $contents, "{$relativePath} must not cast report money with (float).");
            $this->assertStringNotContainsString('floatval(', $contents, "{$relativePath} must not parse report money with floatval().");
            $this->assertStringNotContainsString('doubleval(', $contents, "{$relativePath} must not parse report money with doubleval().");
            $this->assertDoesNotMatchRegularExpression('/number_format\(\s*\(float\)/', $contents, "{$relativePath} must not format money from a float cast.");
        }
    }
}
