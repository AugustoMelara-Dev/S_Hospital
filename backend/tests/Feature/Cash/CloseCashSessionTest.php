<?php

namespace Tests\Feature\Cash;

use App\Jobs\RunBackupJob;
use App\Models\CashMovement;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptSeries;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use LogicException;
use Spatie\Permission\Models\Permission;
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

        $this->createIssuedInstitutionalReceipt($invoiceId, $sessionId, $cashier);

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

    public function test_empty_zero_cash_session_can_close_with_audited_closing_movement(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashierWithOpenSession('0.00');
        $sessionId = $this->currentOpenSessionIdFor($cashier);

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$sessionId}/close", [
                'closing_amount' => '0.00',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', CashRegisterSession::STATUS_CLOSED)
            ->assertJsonPath('data.closing_amount', '0.00')
            ->assertJsonPath('data.difference_amount', '0.00');

        $this->assertDatabaseHas('cash_movements', [
            'cash_session_id' => $sessionId,
            'user_id' => $cashier->id,
            'type' => CashMovement::TYPE_CLOSING,
            'method' => CashMovement::TYPE_CLOSING,
            'amount' => '0.00',
        ]);
    }

    public function test_closed_cash_session_and_movements_are_immutable(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashierWithOpenSession('0.00');
        $sessionId = $this->currentOpenSessionIdFor($cashier);

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$sessionId}/close", [
                'closing_amount' => '0.00',
            ])
            ->assertOk();

        $session = CashRegisterSession::query()->findOrFail($sessionId);
        $movement = CashMovement::query()
            ->where('cash_session_id', $sessionId)
            ->where('type', CashMovement::TYPE_CLOSING)
            ->firstOrFail();

        try {
            $session->forceFill(['closing_amount' => '1.00'])->save();
            $this->fail('Closed cash sessions must reject later mutations.');
        } catch (LogicException $exception) {
            $this->assertStringContainsString('cerradas no se modifican', $exception->getMessage());
        }

        try {
            $movement->forceFill(['amount' => '1.00'])->save();
            $this->fail('Cash movements from closed sessions must reject later mutations.');
        } catch (LogicException $exception) {
            $this->assertStringContainsString('caja cerrada no se modifican', $exception->getMessage());
        }

        try {
            CashMovement::query()->create([
                'cash_session_id' => $sessionId,
                'user_id' => $cashier->id,
                'type' => CashMovement::TYPE_PAYMENT,
                'method' => 'cash',
                'amount' => '1.00',
                'occurred_at' => now(),
            ]);
            $this->fail('Closed cash sessions must reject new cash movements.');
        } catch (LogicException $exception) {
            $this->assertStringContainsString('caja cerrada no se modifican', $exception->getMessage());
        }

        $this->assertSame('0.00', $session->refresh()->closing_amount);
        $this->assertSame('0.00', $movement->refresh()->amount);
        $this->assertSame(1, CashMovement::query()->where('cash_session_id', $sessionId)->count());
    }

    public function test_close_any_permission_can_close_another_users_session_without_cash_close(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashierWithOpenSession('0.00');
        $sessionId = $this->currentOpenSessionIdFor($cashier);
        $supervisor = User::factory()->create();
        $supervisor->givePermissionTo([
            Permission::findOrCreate('cash.view', 'web'),
            Permission::findOrCreate('cash.close_any', 'web'),
        ]);

        $this->actingAs($supervisor)
            ->postJson("/api/cash-sessions/{$sessionId}/close", [
                'closing_amount' => '0.00',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', CashRegisterSession::STATUS_CLOSED)
            ->assertJsonPath('data.user_id', $cashier->id);

        $this->assertSame(CashRegisterSession::STATUS_CLOSED, CashRegisterSession::query()->findOrFail($sessionId)->status);
    }

    public function test_close_any_user_can_request_closable_current_cash_session_without_making_pos_current_global(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashierWithOpenSession('0.00');
        $sessionId = $this->currentOpenSessionIdFor($cashier);
        $supervisor = User::factory()->create();
        $supervisor->givePermissionTo([
            Permission::findOrCreate('cash.view', 'web'),
            Permission::findOrCreate('cash.close_any', 'web'),
        ]);

        $this->actingAs($supervisor)
            ->getJson('/api/cash-sessions/current')
            ->assertOk()
            ->assertJsonPath('data', null);

        $this->actingAs($supervisor)
            ->getJson('/api/cash-sessions/current?scope=closable')
            ->assertOk()
            ->assertJsonPath('data.id', $sessionId)
            ->assertJsonPath('data.user_id', $cashier->id);
    }

    private function seedBillingBase(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        FiscalSetting::query()->create([
            'receipt_template_mode' => 'thermal',
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

    private function cashierWithOpenSession(string $openingAmount = '500.00'): User
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');
        CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => $openingAmount,
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        return $cashier->refresh();
    }

    private function createIssuedInstitutionalReceipt(int $invoiceId, int $sessionId, User $cashier): void
    {
        $invoice = Invoice::query()->findOrFail($invoiceId);
        $number = 91000000 + $invoice->id;
        $series = InstitutionalReceiptSeries::query()->create([
            'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
            'series' => 'REC-CLOSE',
            'prefix' => 'RC',
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => $number,
            'active' => false,
        ]);

        InstitutionalReceipt::query()->create([
            'invoice_id' => $invoice->id,
            'payment_id' => Payment::query()
                ->where('invoice_id', $invoice->id)
                ->where('cash_session_id', $sessionId)
                ->where('status', Payment::STATUS_POSTED)
                ->value('id'),
            'cash_session_id' => $sessionId,
            'series_id' => $series->id,
            'receipt_number' => $number,
            'receipt_number_full' => 'REC-CLOSE-'.str_pad((string) $number, 8, '0', STR_PAD_LEFT),
            'status' => InstitutionalReceipt::STATUS_ISSUED,
            'amount' => $invoice->total,
            'amount_cents' => $invoice->total_cents,
            'issued_at' => now(),
            'issued_by' => $cashier->id,
            'payer_name' => $invoice->patient_name,
            'concept' => 'Servicios hospitalarios',
            'amount_words' => 'Monto de prueba',
            'template_code' => 'institutional_classic',
            'print_profile_code' => 'half_letter',
            'copy_mode' => 'original_only',
            'institution_snapshot' => ['hospital_name' => 'Hospital San Isidro'],
            'series_snapshot' => ['series' => 'REC-CLOSE'],
            'profile_snapshot' => ['code' => 'half_letter'],
            'invoice_snapshot' => ['invoice_number' => $invoice->invoice_number],
            'payment_snapshot' => null,
            'items_snapshot' => [],
        ]);
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
