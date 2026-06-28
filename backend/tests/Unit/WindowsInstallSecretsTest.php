<?php

namespace Tests\Unit;

use Tests\TestCase;

class WindowsInstallSecretsTest extends TestCase
{
    public function test_windows_install_scripts_do_not_use_get_random_for_secret_generation(): void
    {
        $script = file_get_contents(base_path('../setup.bat'));

        $this->assertIsString($script);
        $this->assertStringNotContainsString('Get-Random', $script);
        $this->assertStringContainsString('RandomNumberGenerator', $script);
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
