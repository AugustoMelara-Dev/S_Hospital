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

    public function test_ci_scans_installed_frontend_dependencies_before_registry_audit(): void
    {
        $frontendJob = $this->frontendCiJob();
        $install = strpos($frontendJob, '- name: Install frontend dependencies');
        $postinstallGuard = strpos($frontendJob, '- name: Scan installed supply-chain indicators');
        $audit = strpos($frontendJob, '- name: Audit frontend dependencies');

        $this->assertNotFalse($install);
        $this->assertNotFalse($postinstallGuard);
        $this->assertNotFalse($audit);
        $this->assertGreaterThan($install, $postinstallGuard);
        $this->assertGreaterThan($postinstallGuard, $audit);
        $this->assertStringContainsString('shell: pwsh', $frontendJob);
        $this->assertStringContainsString('./scripts/security/supply-chain-check.ps1 -ProjectRoot . -SkipTemp', $frontendJob);
        $this->assertStringNotContainsString('- name: Test supply-chain guard', $frontendJob);
        $this->assertStringNotContainsString('- name: Scan dependency locks before install', $frontendJob);
    }

    public function test_frontend_pnpm_allows_only_the_reviewed_esbuild_dependency_build(): void
    {
        $configPath = base_path('../frontend/pnpm-workspace.yaml');

        $this->assertFileExists($configPath);
        $config = file_get_contents($configPath);

        $this->assertIsString($config);
        $normalized = str_replace("\r\n", "\n", trim($config));
        $this->assertSame("allowBuilds:\n  esbuild: true", $normalized);
        $this->assertStringNotContainsString('dangerouslyAllowAllBuilds', $normalized);
        $this->assertStringNotContainsString('strictDepBuilds: false', $normalized);
    }

    public function test_composer_allows_only_plugins_present_in_the_lockfile(): void
    {
        $manifest = json_decode(
            file_get_contents(base_path('composer.json')) ?: '',
            true,
            flags: JSON_THROW_ON_ERROR,
        );
        $lock = json_decode(
            file_get_contents(base_path('composer.lock')) ?: '',
            true,
            flags: JSON_THROW_ON_ERROR,
        );
        $allowedPlugins = array_keys(array_filter(
            $manifest['config']['allow-plugins'] ?? [],
            static fn (mixed $allowed): bool => $allowed === true,
        ));
        $lockedPlugins = [];

        foreach ([...$lock['packages'], ...$lock['packages-dev']] as $package) {
            if (($package['type'] ?? null) === 'composer-plugin') {
                $lockedPlugins[] = $package['name'];
            }
        }

        $this->assertSame(
            [],
            array_values(array_diff($allowedPlugins, $lockedPlugins)),
            'Composer plugins may execute code during installation; every grant must match a locked plugin.',
        );
    }

    public function test_ci_gates_every_dependency_install_job_on_the_supply_chain_preflight(): void
    {
        $supplyChainJob = $this->ciJob('supply-chain', 'backend-sqlite');
        $selfTest = strpos($supplyChainJob, '- name: Test supply-chain guard');
        $guard = strpos($supplyChainJob, '- name: Scan dependency locks before install');

        $this->assertNotFalse($selfTest);
        $this->assertNotFalse($guard);
        $this->assertGreaterThan($selfTest, $guard);
        $this->assertStringContainsString('./scripts/security/test-supply-chain-check.ps1', $supplyChainJob);
        $this->assertStringContainsString('./scripts/security/supply-chain-check.ps1 -ProjectRoot . -SkipTemp', $supplyChainJob);

        foreach ([
            $this->ciJob('backend-sqlite', 'backend-mariadb'),
            $this->ciJob('backend-mariadb', 'frontend'),
            $this->frontendCiJob(),
        ] as $installJob) {
            $this->assertMatchesRegularExpression('/^    needs: supply-chain$/m', $installJob);
        }
    }

    public function test_ci_audits_each_composer_lock_before_installing_backend_dependencies(): void
    {
        foreach ([
            $this->ciJob('backend-sqlite', 'backend-mariadb'),
            $this->ciJob('backend-mariadb', 'frontend'),
        ] as $backendJob) {
            $audit = strpos($backendJob, '- name: Composer audit');
            $install = strpos($backendJob, '- name: Install backend dependencies');

            $this->assertNotFalse($audit);
            $this->assertNotFalse($install);
            $this->assertGreaterThan($audit, $install);
            $this->assertSame(1, substr_count($backendJob, 'composer audit --locked --no-interaction'));
        }
    }

    public function test_ci_pins_every_external_action_to_a_reviewed_commit(): void
    {
        $workflow = file_get_contents(base_path('../.github/workflows/ci.yml'));

        $this->assertIsString($workflow);
        $matched = preg_match_all(
            '/^\s*-?\s*uses:\s+(?<action>[^@\s]+)@(?<ref>[^\s#]+)(?:\s+#\s*(?<version>\S+))?/m',
            $workflow,
            $actions,
            PREG_SET_ORDER,
        );

        $this->assertIsInt($matched);
        $this->assertGreaterThan(0, $matched);

        foreach ($actions as $action) {
            $this->assertMatchesRegularExpression(
                '/^[a-f0-9]{40}$/',
                $action['ref'],
                "{$action['action']} must be pinned to a full commit SHA.",
            );
            $this->assertMatchesRegularExpression(
                '/^(?:v)?\d+(?:\.\d+){2}$/',
                $action['version'] ?? '',
                "{$action['action']} must retain its reviewed release in a comment.",
            );
        }
    }

    public function test_dependabot_reviews_pinned_github_actions_weekly(): void
    {
        $configPath = base_path('../.github/dependabot.yml');

        $this->assertFileExists($configPath);
        $config = file_get_contents($configPath);

        $this->assertIsString($config);
        $this->assertStringContainsString('package-ecosystem: github-actions', $config);
        $this->assertStringContainsString('directory: "/"', $config);
        $this->assertStringContainsString('interval: weekly', $config);
        $this->assertSame(2, substr_count($config, 'package-ecosystem: docker'));
        $this->assertStringContainsString('directory: "/backend"', $config);
    }

    private function frontendCiJob(): string
    {
        return $this->ciJob('frontend', 'e2e-mocked');
    }

    private function ciJob(string $name, string $nextJob): string
    {
        $workflow = file_get_contents(base_path('../.github/workflows/ci.yml'));

        $this->assertIsString($workflow);
        $pattern = '/^  '.preg_quote($name, '/').':\R(?<job>.*?)(?=^  '.preg_quote($nextJob, '/').':)/ms';
        $matched = preg_match($pattern, $workflow, $matches);

        $this->assertSame(1, $matched);

        return $matches['job'];
    }
}
