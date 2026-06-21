<?php

namespace Tests\Unit;

use Tests\TestCase;

class WindowsInstallSecretsTest extends TestCase
{
    public function test_devex_compose_example_uses_required_secret_placeholders(): void
    {
        $compose = file_get_contents(base_path('../devex/docker-compose.example.yml'));

        $this->assertIsString($compose);
        $this->assertStringNotContainsString('hospital_dev', $compose);
        $this->assertStringNotContainsString('root_dev', $compose);
        $this->assertStringContainsString('${MYSQL_PASSWORD:?MYSQL_PASSWORD is required}', $compose);
        $this->assertStringContainsString('${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is required}', $compose);
    }

    public function test_windows_install_scripts_do_not_use_get_random_for_secret_generation(): void
    {
        foreach ([
            '../setup.bat',
            '../scripts/deploy_hospital_lan.ps1',
        ] as $relativePath) {
            $script = file_get_contents(base_path($relativePath));

            $this->assertIsString($script, $relativePath);
            $this->assertStringNotContainsString('Get-Random', $script, $relativePath);
            $this->assertStringContainsString('RandomNumberGenerator', $script, $relativePath);
        }
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
}
