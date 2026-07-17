<?php

namespace Tests\Feature\Testing;

use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class GoldenDatabaseCommandTest extends TestCase
{
    public function test_command_refuses_to_run_in_production(): void
    {
        Config::set('app.env', 'production');

        $this->artisan('testing:prepare-golden-database', [
            '--database' => 's_hospital_test_safe',
            '--dry-run' => true,
        ])
            ->expectsOutputToContain('Refusing to prepare a golden test database while APP_ENV=production.')
            ->assertFailed();
    }

    public function test_command_refuses_unsafe_database_names(): void
    {
        Config::set('app.env', 'testing');

        $this->artisan('testing:prepare-golden-database', [
            '--database' => 'hospital_billing',
            '--dry-run' => true,
        ])
            ->expectsOutputToContain('Refusing unsafe test database name: hospital_billing')
            ->assertFailed();
    }

    public function test_command_requires_exact_disposable_database_prefixes(): void
    {
        Config::set('app.env', 'testing');

        $this->artisan('testing:prepare-golden-database', [
            '--database' => 'customer_test_archive',
            '--dry-run' => true,
        ])
            ->expectsOutputToContain('Refusing unsafe test database name: customer_test_archive')
            ->assertFailed();

        $this->artisan('testing:prepare-golden-database', [
            '--database' => 's_hospital_test_goal',
            '--golden-database' => 'customer_golden_archive',
            '--dry-run' => true,
        ])
            ->expectsOutputToContain('Refusing unsafe golden database name: customer_golden_archive')
            ->assertFailed();
    }

    public function test_command_refuses_non_local_database_host_without_exact_confirmation(): void
    {
        Config::set('app.env', 'testing');
        Config::set('database.default', 'mysql');
        Config::set('database.connections.mysql.host', '192.168.1.10');
        putenv('HOSPITAL_CONFIRM_EXTERNAL_TEST_DB_HOST');
        putenv('HOSPITAL_TEST_DB_STRATEGY');

        $this->artisan('testing:prepare-golden-database', [
            '--database' => 's_hospital_test_goal',
            '--golden-database' => 's_hospital_golden_goal',
        ])
            ->expectsOutputToContain("Refusing database host '192.168.1.10' for golden tests.")
            ->assertFailed();
    }

    public function test_command_refuses_docker_database_host_without_golden_strategy(): void
    {
        Config::set('app.env', 'testing');
        Config::set('database.default', 'mysql');
        Config::set('database.connections.mysql.host', 'mysql');
        putenv('HOSPITAL_CONFIRM_EXTERNAL_TEST_DB_HOST');
        putenv('HOSPITAL_TEST_DB_STRATEGY');

        $this->artisan('testing:prepare-golden-database', [
            '--database' => 's_hospital_test_goal',
            '--golden-database' => 's_hospital_golden_goal',
        ])
            ->expectsOutputToContain("Refusing database host 'mysql' for golden tests.")
            ->assertFailed();
    }

    public function test_command_rejects_structured_database_host_without_converting_it_to_text(): void
    {
        Config::set('app.env', 'testing');
        Config::set('database.default', 'mysql');
        Config::set('database.connections.mysql.host', ['invalid']);

        $this->artisan('testing:prepare-golden-database', [
            '--database' => 's_hospital_test_goal',
            '--golden-database' => 's_hospital_golden_goal',
        ])
            ->expectsOutputToContain("Refusing database host '[invalid]' for golden tests.")
            ->assertFailed();
    }

    public function test_dry_run_reports_safe_database_and_migration_hash_without_creating_database(): void
    {
        Config::set('app.env', 'testing');

        $this->artisan('testing:prepare-golden-database', [
            '--database' => 's_hospital_test_goal',
            '--dry-run' => true,
        ])
            ->expectsOutputToContain('GOLDEN_DATABASE_DRY_RUN: YES')
            ->expectsOutputToContain('Target database: s_hospital_test_goal')
            ->expectsOutputToContain('Migration hash:')
            ->assertSuccessful();
    }
}
