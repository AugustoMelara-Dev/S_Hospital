<?php

namespace Tests\Feature;

use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Service;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PrepareE2eReleaseDataCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_prepares_idempotent_non_production_e2e_data(): void
    {
        $this->artisan('hospital:prepare-e2e-release-data', ['--json' => true, '--password' => 'TestPassword@E2E!'])
            ->assertSuccessful();

        $cashier = User::query()->where('username', 'cajero.e2e')->firstOrFail();

        $this->assertTrue($cashier->hasRole('cajero'));
        $this->assertDatabaseHas('users', [
            'username' => 'admin.e2e',
            'active' => true,
            'must_change_password' => false,
        ]);
        $this->assertDatabaseHas('users', [
            'username' => 'supervisor.e2e',
            'active' => true,
            'must_change_password' => false,
        ]);
        $this->assertDatabaseHas('fiscal_settings', [
            'id' => 1,
            'hospital_name' => 'Hospital San Isidro E2E',
            'default_tax_rate' => '15.00',
        ]);
        $this->assertSame(1, FiscalSequence::query()->where('document_type', 'invoice')->where('active', true)->count());
        $this->assertTrue(Service::query()->where('name', 'Glucosa')->where('active', true)->where('visible_in_billing', true)->where('is_billable', true)->exists());
        $this->assertTrue(Service::query()->where('name', 'Eritropoyetina')->where('special_rule_code', Service::ERYTHROPOIETIN_RULE)->exists());

        $this->assertSame(1, CashRegisterSession::query()
            ->where('user_id', $cashier->id)
            ->where('status', CashRegisterSession::STATUS_OPEN)
            ->count());

        $this->artisan('hospital:prepare-e2e-release-data', ['--json' => true, '--password' => 'TestPassword@E2E!'])
            ->assertSuccessful();

        $this->assertSame(1, CashRegisterSession::query()
            ->where('user_id', $cashier->id)
            ->where('status', CashRegisterSession::STATUS_OPEN)
            ->count());
        $this->assertSame('Hospital San Isidro E2E', FiscalSetting::query()->firstOrFail()->hospital_name);
    }

    public function test_command_fails_without_password(): void
    {
        $this->artisan('hospital:prepare-e2e-release-data', ['--json' => true])
            ->assertFailed()
            ->expectsOutput('The E2E seed password must be provided via --password or E2E_SEED_PASSWORD.');
    }
}
