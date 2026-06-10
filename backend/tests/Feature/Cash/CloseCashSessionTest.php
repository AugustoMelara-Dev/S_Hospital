<?php

namespace Tests\Feature\Cash;

use App\Jobs\RunBackupJob;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Tests\TestCase;

class CloseCashSessionTest extends TestCase
{
    use RefreshDatabase;

    public function test_closing_cash_session_does_not_dispatch_run_backup_job(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashierWithOpenSession();
        $sessionId = $this->currentOpenSessionIdFor($cashier);

        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => 'cash',
                'amount' => '17.25',
            ])
            ->assertCreated();

        Bus::fake([RunBackupJob::class]);

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$sessionId}/close", [
                'closing_amount' => '517.25',
            ])
            ->assertOk();

        Bus::assertNotDispatched(RunBackupJob::class);
    }

    public function test_closing_cash_session_with_difference_does_not_dispatch_run_backup_job(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashierWithOpenSession();
        $sessionId = $this->currentOpenSessionIdFor($cashier);

        Bus::fake([RunBackupJob::class]);

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$sessionId}/close", [
                'closing_amount' => '499.00',
                'notes' => 'Faltante en caja',
            ])
            ->assertOk();

        Bus::assertNotDispatched(RunBackupJob::class);
    }

    private function seedBillingBase(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        FiscalSetting::query()->create([
            'hospital_name' => 'Hospital San Isidro',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'receipt_paper_size' => 'half_letter',
        ]);
        FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => '000-001-01',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 0,
            'cai' => 'TEST-CAI',
            'valid_until' => now()->addYear()->toDateString(),
            'active' => true,
        ]);
    }

    private function cashierWithOpenSession(): User
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');
        CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => '500.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        return $cashier->refresh();
    }

    private function currentOpenSessionIdFor(User $cashier): int
    {
        $session = CashRegisterSession::query()
            ->where('user_id', $cashier->id)
            ->where('status', CashRegisterSession::STATUS_OPEN)
            ->firstOrFail();

        return (int) $session->id;
    }
}
