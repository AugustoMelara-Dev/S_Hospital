<?php

namespace Tests\Unit;

use Tests\TestCase;

class WindowsInstallSecretsTest extends TestCase
{
    public function test_windows_setup_delegates_secret_generation_to_the_hardened_installer(): void
    {
        $setup = file_get_contents(base_path('../setup.bat'));

        $this->assertIsString($setup);
        $this->assertStringContainsString('scripts\deploy_hospital_lan.ps1', $setup);
        $this->assertStringNotContainsString('Get-Random', $setup);
        $this->assertStringNotContainsString('DB_'.'PASSWORD=', $setup);
    }

    public function test_ci_workflow_uses_ephemeral_mariadb_password_fallbacks(): void
    {
        $workflow = file_get_contents(base_path('../.github/workflows/ci.yml'));

        $this->assertIsString($workflow);
        $this->assertStringNotContainsString('ci-db-only-change-in-repo-settings', $workflow);
        $this->assertStringNotContainsString('ci-root-db-only-change-in-repo-settings', $workflow);
        $this->assertStringContainsString("format('ci-db-{0}', github.run_id)", $workflow);
        $this->assertStringContainsString("format('ci-root-db-{0}', github.run_id)", $workflow);
    }

    public function test_ci_workflow_does_not_define_empty_service_maps(): void
    {
        $workflow = file_get_contents(base_path('../.github/workflows/ci.yml'));

        $this->assertIsString($workflow);
        $lines = preg_split('/\R/', $workflow);

        $this->assertIsArray($lines);
        foreach ($lines as $index => $line) {
            if (preg_match('/^(?<indent>[ ]*)services:[ ]*$/', $line, $matches) !== 1) {
                continue;
            }

            $serviceIndent = strlen($matches['indent']);
            $nextEntryIndent = null;
            for ($candidate = $index + 1; $candidate < count($lines); $candidate++) {
                $nextLine = $lines[$candidate];
                if (trim($nextLine) === '' || str_starts_with(ltrim($nextLine), '#')) {
                    continue;
                }

                preg_match('/^(?<indent>[ ]*)/', $nextLine, $nextMatches);
                $nextEntryIndent = strlen($nextMatches['indent']);
                break;
            }

            $this->assertNotNull($nextEntryIndent, 'Every services map must contain a service entry.');
            $this->assertGreaterThan(
                $serviceIndent,
                $nextEntryIndent,
                'GitHub Actions rejects jobs whose services map is empty.',
            );
        }
    }

    public function test_ci_checks_backend_worktree_clean_immediately_after_phpunit(): void
    {
        $workflow = file_get_contents(base_path('../.github/workflows/ci.yml'));

        $this->assertIsString($workflow);
        $phpunit = strpos($workflow, '- name: Run PHPUnit');
        $cleanGate = strpos($workflow, '- name: Assert backend tests leave worktree clean');
        $pint = strpos($workflow, '- name: Run Pint code style');

        $this->assertNotFalse($phpunit);
        $this->assertNotFalse($cleanGate);
        $this->assertNotFalse($pint);
        $this->assertGreaterThan($phpunit, $cleanGate);
        $this->assertLessThan($pint, $cleanGate);
        $this->assertStringContainsString('git status --porcelain --untracked-files=all', $workflow);
    }

    public function test_ci_audits_frontend_dependencies_and_enforces_bundle_budget_in_order(): void
    {
        $frontendJob = $this->frontendCiJob();
        $install = strpos($frontendJob, '- name: Install frontend dependencies');
        $audit = strpos($frontendJob, '- name: Audit frontend dependencies');
        $typecheck = strpos($frontendJob, '- name: TypeScript typecheck');
        $build = strpos($frontendJob, '- name: Build');
        $budget = strpos($frontendJob, '- name: Enforce bundle budget');

        $this->assertNotFalse($install);
        $this->assertNotFalse($audit);
        $this->assertNotFalse($typecheck);
        $this->assertNotFalse($build);
        $this->assertNotFalse($budget);
        $this->assertGreaterThan($install, $audit);
        $this->assertGreaterThan($audit, $typecheck);
        $this->assertGreaterThan($build, $budget);
        $this->assertStringContainsString('pnpm audit --audit-level high', $frontendJob);
        $this->assertStringContainsString('pnpm run budget:bundle', $frontendJob);
        $this->assertStringNotContainsString('--ignore-registry-errors', $frontendJob);
    }

    public function test_ci_self_tests_and_runs_supply_chain_guard_before_registry_audit(): void
    {
        $frontendJob = $this->frontendCiJob();
        $install = strpos($frontendJob, '- name: Install frontend dependencies');
        $selfTest = strpos($frontendJob, '- name: Test supply-chain guard');
        $guard = strpos($frontendJob, '- name: Scan supply-chain indicators');
        $audit = strpos($frontendJob, '- name: Audit frontend dependencies');

        $this->assertNotFalse($install);
        $this->assertNotFalse($selfTest);
        $this->assertNotFalse($guard);
        $this->assertNotFalse($audit);
        $this->assertGreaterThan($install, $selfTest);
        $this->assertGreaterThan($selfTest, $guard);
        $this->assertGreaterThan($guard, $audit);
        $this->assertStringContainsString('shell: pwsh', $frontendJob);
        $this->assertStringContainsString('./scripts/security/test-supply-chain-check.ps1', $frontendJob);
        $this->assertStringContainsString('./scripts/security/supply-chain-check.ps1 -ProjectRoot . -SkipTemp', $frontendJob);
    }

    private function frontendCiJob(): string
    {
        $workflow = file_get_contents(base_path('../.github/workflows/ci.yml'));

        $this->assertIsString($workflow);
        $matched = preg_match('/^  frontend:\R(?<job>.*?)(?=^  e2e-mocked:)/ms', $workflow, $matches);

        $this->assertSame(1, $matched);

        return $matches['job'];
    }
}
