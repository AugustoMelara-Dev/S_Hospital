<?php

namespace Tests\Unit;

use Tests\TestCase;

class ReportMoneyArchitectureTest extends TestCase
{
    /**
     * Report exports are evidence for cash review, so money parsing must stay
     * on shared cent-based helpers instead of ad-hoc float casts.
     *
     * This guard is intentionally narrow: it bans `(float)` only when it
     * appears in a money-related context (e.g. number_format on a float,
     * casting a payment / invoice / amount / total variable). Non-money
     * floats like latency samples, percentages, or constants are allowed
     * to keep the report code pragmatic.
     */
    public function test_report_actions_do_not_parse_money_with_direct_float_casts(): void
    {
        $reportFiles = glob(app_path('Actions/Reports/*.php')) ?: [];

        $this->assertNotEmpty($reportFiles, 'Expected report action files to exist.');

        // Pattern 1: number_format( (float) ... ) — the canonical anti-pattern.
        $moneyFloatNumberFormat = '/number_format\(\s*\(float\)/';

        // Pattern 2: (float) $variable where the variable name hints at money.
        $moneyVariableNames = '(amount|total|subtotal|tax|discount|paid|balance|price|change|cash|credit|revenue|cost|sum|snapshot)';
        $moneyFloatCast = '/\(float\)\s*\$' . $moneyVariableNames . '/i';

        // Pattern 3: floatval / doubleval are never acceptable for money.
        $floatFunctions = ['floatval(', 'doubleval('];

        foreach ($reportFiles as $file) {
            $contents = (string) file_get_contents($file);
            $this->assertIsString($contents);

            $relativePath = str_replace(base_path() . DIRECTORY_SEPARATOR, '', $file);

            $this->assertDoesNotMatchRegularExpression(
                $moneyFloatNumberFormat,
                $contents,
                "{$relativePath} must not format money from a float cast."
            );

            $this->assertDoesNotMatchRegularExpression(
                $moneyFloatCast,
                $contents,
                "{$relativePath} must not cast a money-named variable with (float). Use Money::parseCents()."
            );

            foreach ($floatFunctions as $fn) {
                $this->assertStringNotContainsString(
                    $fn,
                    $contents,
                    "{$relativePath} must not parse money with {$fn}."
                );
            }
        }
    }
}
