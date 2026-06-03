<?php

declare(strict_types=1);

namespace Tests\Coverage;

use PHPUnit\Framework\TestCase;
use PHPUnit\Runner\CodeCoverage;
use SebastianBergmann\CodeCoverage\Node\Directory;
use SebastianBergmann\CodeCoverage\Node\File;

/**
 * Phase B2 quality gate: refuse to ship when the cashier-facing Actions
 * (Billing / Cash / Payments / Backups / Receipts) drop below the agreed
 * 80% line coverage threshold.
 *
 * The gate is opt-in. Local dev without pcov/xdebug runs `vendor/bin/phpunit`
 * with no HOSPITAL_REQUIRE_COVERAGE set and the test is skipped with a
 * friendly message, so the suite stays green.
 *
 * In CI, GitHub Actions sets HOSPITAL_REQUIRE_COVERAGE=1 (see
 * .github/workflows/ci.yml, backend-sqlite and backend-mariadb jobs) and
 * invokes phpunit with the coverage config (phpunit.coverage.xml). The
 * global CodeCoverage singleton is then populated by the prior tests and
 * the assertion below fails with a per-module breakdown if any module is
 * below 80%.
 *
 * To enable locally:
 *   - xdebug: enable `zend_extension=xdebug` in php.ini with `xdebug.mode=coverage`
 *   - pcov:   enable `extension=pcov` and `pcov.enabled=1` in php.ini (faster, recommended)
 *   - run:    HOSPITAL_REQUIRE_COVERAGE=1 vendor/bin/phpunit -c phpunit.coverage.xml
 */
class CriticalModulesCoverageTest extends TestCase
{
    private const COVERAGE_THRESHOLD = 80.0;

    /**
     * @var list<string>
     */
    private const CRITICAL_MODULES = [
        'Billing',
        'Cash',
        'Payments',
        'Backups',
        'Receipts',
    ];

    public function test_critical_action_modules_meet_minimum_coverage(): void
    {
        if (! $this->isCoverageRequired()) {
            $this->markTestSkipped(
                'HOSPITAL_REQUIRE_COVERAGE is not set; skipping the 80% gate. '
                .'Set HOSPITAL_REQUIRE_COVERAGE=1 and run `vendor/bin/phpunit -c phpunit.coverage.xml` '
                .'to enforce the threshold locally.',
            );

            return;
        }

        $runner = CodeCoverage::instance();

        if (! $runner->isActive()) {
            $this->markTestSkipped(
                'HOSPITAL_REQUIRE_COVERAGE=1 but no coverage driver is active. '
                .'Enable pcov (recommended) or xdebug in php.ini, then run '
                .'`vendor/bin/phpunit -c phpunit.coverage.xml`.',
            );

            return;
        }

        $report = $runner->codeCoverage()->getReport();
        $moduleStats = $this->collectModuleStats($report);

        $lines = ['Critical action modules coverage gate (threshold: '
            .sprintf('%.1f%%', self::COVERAGE_THRESHOLD).'):'];

        $failures = [];

        foreach (self::CRITICAL_MODULES as $module) {
            $stats = $moduleStats[$module] ?? ['statements' => 0, 'covered' => 0, 'files' => []];

            if ($stats['statements'] === 0) {
                $lines[] = sprintf('  - %-10s NO STATEMENTS MEASURED', $module);
                $failures[] = sprintf('%s: no executable statements were measured.', $module);

                continue;
            }

            $percent = ($stats['covered'] / $stats['statements']) * 100;
            $status = $percent >= self::COVERAGE_THRESHOLD ? 'OK ' : 'FAIL';
            $lines[] = sprintf(
                '  - %-10s [%s] %5.2f%% (%d/%d statements across %d files)',
                $module,
                $status,
                $percent,
                $stats['covered'],
                $stats['statements'],
                count($stats['files']),
            );

            if ($percent < self::COVERAGE_THRESHOLD) {
                $failures[] = sprintf(
                    '%s is at %.2f%% (%.1f%% below the 80%% threshold). '
                    .'Files in module: %s',
                    $module,
                    $percent,
                    self::COVERAGE_THRESHOLD - $percent,
                    $this->formatUncoveredFiles($stats['files']),
                );
            }
        }

        $this->assertSame(
            [],
            $failures,
            "Coverage gate failed. Per-module breakdown:\n".implode("\n", $lines)
            ."\n\n".implode("\n", $failures),
        );
    }

    private function isCoverageRequired(): bool
    {
        $value = getenv('HOSPITAL_REQUIRE_COVERAGE');

        return $value === '1' || $value === 'true';
    }

    /**
     * @return array<string, array{statements: int, covered: int, files: list<string>}>
     */
    private function collectModuleStats(Directory $report): array
    {
        $stats = array_fill_keys(self::CRITICAL_MODULES, [
            'statements' => 0,
            'covered' => 0,
            'files' => [],
        ]);

        foreach ($report->files() as $file) {
            $module = $this->moduleForFile($file);

            if ($module === null) {
                continue;
            }

            $statements = $file->numberOfExecutableLines();
            $covered = $file->numberOfExecutedLines();

            $stats[$module]['statements'] += $statements;
            $stats[$module]['covered'] += $covered;
            $stats[$module]['files'][] = $this->relativePath($file);
        }

        foreach ($report->directories() as $directory) {
            $this->collectModuleStatsRecursive($directory, $stats);
        }

        return $stats;
    }

    /**
     * @param  array<string, array{statements: int, covered: int, files: list<string>}>  $stats
     */
    private function collectModuleStatsRecursive(Directory $directory, array &$stats): void
    {
        foreach ($directory->files() as $file) {
            $module = $this->moduleForFile($file);

            if ($module === null) {
                continue;
            }

            $statements = $file->numberOfExecutableLines();
            $covered = $file->numberOfExecutedLines();

            $stats[$module]['statements'] += $statements;
            $stats[$module]['covered'] += $covered;
            $stats[$module]['files'][] = $this->relativePath($file);
        }

        foreach ($directory->directories() as $child) {
            $this->collectModuleStatsRecursive($child, $stats);
        }
    }

    private function moduleForFile(File $file): ?string
    {
        $path = str_replace('\\', '/', $file->pathAsString());
        $needle = '/app/Actions/';

        $pos = strpos($path, $needle);

        if ($pos === false) {
            return null;
        }

        $after = substr($path, $pos + strlen($needle));
        $module = strtok($after, '/');

        if ($module === false) {
            return null;
        }

        return in_array($module, self::CRITICAL_MODULES, true) ? $module : null;
    }

    private function relativePath(File $file): string
    {
        $path = str_replace('\\', '/', $file->pathAsString());
        $needle = '/app/Actions/';

        $pos = strpos($path, $needle);

        if ($pos === false) {
            return $path;
        }

        return 'app/Actions/'.substr($path, $pos + strlen($needle));
    }

    /**
     * @param  list<string>  $files
     */
    private function formatUncoveredFiles(array $files): string
    {
        if ($files === []) {
            return '(no files measured)';
        }

        sort($files);

        return implode(', ', $files);
    }
}
