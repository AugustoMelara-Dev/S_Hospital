<?php

namespace Tests\Feature;

use App\Actions\Billing\CreateInvoiceAction;
use App\Models\AuditLog;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Invoice;
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
            'hospital_name' => 'Hospital General San Isidro',
            'default_tax_rate' => '15.00',
            'receipt_paper_size' => 'half_letter',
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
        $this->assertSame('Hospital General San Isidro', FiscalSetting::query()->firstOrFail()->hospital_name);
    }

    public function test_it_voids_stale_unpaid_release_invoices_before_reusing_the_e2e_cash_session(): void
    {
        $password = 'TestPassword@E2E!';
        $this->artisan('hospital:prepare-e2e-release-data', ['--password' => $password])
            ->assertSuccessful();

        $cashier = User::query()->where('username', 'cajero.e2e')->firstOrFail();
        $admin = User::query()->where('username', 'admin.e2e')->firstOrFail();
        $invoice = app(CreateInvoiceAction::class)->execute([
            'patient_name' => 'E2E Release Gate interrupted run',
            'items' => [[
                'service_id' => Service::query()->where('name', 'Glucosa')->firstOrFail()->id,
                'quantity' => '1.00',
            ]],
        ], $cashier);

        $this->assertSame(Invoice::STATUS_ISSUED, $invoice->status);

        $this->artisan('hospital:prepare-e2e-release-data', ['--password' => $password])
            ->assertSuccessful();

        $this->assertSame(Invoice::STATUS_VOID, $invoice->refresh()->status);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'invoice.voided',
            'entity_type' => Invoice::class,
            'entity_id' => $invoice->id,
            'reason' => 'Limpieza segura de ejecucion E2E interrumpida.',
        ]);
        $this->assertSame(0, Invoice::query()
            ->where('cash_session_id', $invoice->cash_session_id)
            ->whereIn('status', [Invoice::STATUS_ISSUED, Invoice::STATUS_PARTIAL])
            ->count());
        $this->assertTrue(AuditLog::query()->where('entity_id', $invoice->id)->exists());
    }

    public function test_it_closes_a_completed_e2e_session_and_opens_a_clean_session_for_the_next_run(): void
    {
        $password = 'TestPassword@E2E!';
        $this->artisan('hospital:prepare-e2e-release-data', ['--password' => $password])
            ->assertSuccessful();

        $cashier = User::query()->where('username', 'cajero.e2e')->firstOrFail();
        $oldSession = CashRegisterSession::query()
            ->where('user_id', $cashier->id)
            ->where('status', CashRegisterSession::STATUS_OPEN)
            ->firstOrFail();
        $invoice = app(CreateInvoiceAction::class)->execute([
            'patient_name' => 'E2E Release Gate completed run',
            'items' => [[
                'service_id' => Service::query()->where('name', 'Glucosa')->firstOrFail()->id,
                'quantity' => '1.00',
            ]],
        ], $cashier);

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoice->id}/payments", [
                'cash_session_id' => $oldSession->id,
                'method' => 'cash',
                'amount' => (string) $invoice->total,
            ])
            ->assertCreated();

        $this->artisan('hospital:prepare-e2e-release-data', ['--password' => $password])
            ->assertSuccessful();

        $newSession = CashRegisterSession::query()
            ->where('user_id', $cashier->id)
            ->where('status', CashRegisterSession::STATUS_OPEN)
            ->firstOrFail();
        $this->assertSame(CashRegisterSession::STATUS_CLOSED, $oldSession->refresh()->status);
        $this->assertNotSame($oldSession->id, $newSession->id);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'cash_session.closed',
            'entity_type' => CashRegisterSession::class,
            'entity_id' => $oldSession->id,
        ]);
    }

    public function test_it_does_not_close_other_users_legacy_open_sessions_during_e2e_preparation(): void
    {
        $password = 'TestPassword@E2E!';
        $this->artisan('hospital:prepare-e2e-release-data', ['--password' => $password])
            ->assertSuccessful();

        $cashier = User::query()->where('username', 'cajero.e2e')->firstOrFail();
        $e2eSession = CashRegisterSession::query()->where('user_id', $cashier->id)->firstOrFail();
        $otherUser = User::factory()->create();
        $otherSession = CashRegisterSession::query()->create([
            'user_id' => $otherUser->id,
            'open_user_id' => $otherUser->id,
            'opening_amount' => '0.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now()->subDay(),
        ]);
        app(CreateInvoiceAction::class)->execute([
            'patient_name' => 'E2E Release Gate interrupted run',
            'items' => [[
                'service_id' => Service::query()->where('name', 'Glucosa')->firstOrFail()->id,
                'quantity' => '1.00',
            ]],
        ], $cashier);

        $this->artisan('hospital:prepare-e2e-release-data', ['--password' => $password])
            ->assertSuccessful();

        $this->assertSame(CashRegisterSession::STATUS_OPEN, $e2eSession->refresh()->status);
        $this->assertSame(CashRegisterSession::STATUS_OPEN, $otherSession->refresh()->status);
    }

    public function test_it_closes_a_stale_e2e_supervisor_session_before_opening_the_cashier_session(): void
    {
        $password = 'TestPassword@E2E!';
        $this->artisan('hospital:prepare-e2e-release-data', ['--password' => $password])
            ->assertSuccessful();

        $cashier = User::query()->where('username', 'cajero.e2e')->firstOrFail();
        $supervisor = User::query()->where('username', 'supervisor.e2e')->firstOrFail();
        $staleSession = CashRegisterSession::query()
            ->where('user_id', $cashier->id)
            ->where('status', CashRegisterSession::STATUS_OPEN)
            ->firstOrFail();
        $staleSession->forceFill([
            'user_id' => $supervisor->id,
            'open_user_id' => $supervisor->id,
        ])->save();

        $this->artisan('hospital:prepare-e2e-release-data', ['--password' => $password])
            ->assertSuccessful();

        $this->assertSame(CashRegisterSession::STATUS_CLOSED, $staleSession->refresh()->status);
        $this->assertDatabaseHas('cash_register_sessions', [
            'user_id' => $cashier->id,
            'status' => CashRegisterSession::STATUS_OPEN,
        ]);
    }

    public function test_command_fails_without_password(): void
    {
        $this->artisan('hospital:prepare-e2e-release-data', ['--json' => true])
            ->assertFailed()
            ->expectsOutput('The E2E seed password must be provided via --password or E2E_SEED_PASSWORD.');
    }

    public function test_command_rejects_non_string_password_before_seeding_or_creating_users(): void
    {
        $this->artisan('hospital:prepare-e2e-release-data', [
            '--json' => true,
            '--password' => true,
        ])
            ->assertFailed()
            ->expectsOutput('The E2E seed password must be a non-empty string.');

        $this->assertDatabaseMissing('users', ['username' => 'admin.e2e']);
        $this->assertDatabaseMissing('users', ['username' => 'supervisor.e2e']);
        $this->assertDatabaseMissing('users', ['username' => 'cajero.e2e']);
    }
}
