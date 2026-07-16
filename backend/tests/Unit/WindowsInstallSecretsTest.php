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
}
