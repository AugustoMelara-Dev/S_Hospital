<?php

declare(strict_types=1);

namespace Tests\Feature\Resilience;

use App\Models\AuditLog;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Resilience audit: reprinting a receipt must NOT mutate the underlying
 * invoice or payment. A reprint is a read-only operation that should
 * emit one audit entry and otherwise leave the cashier ledger intact.
 */
class ReprintDoesNotMutateTest extends TestCase
{
    use RefreshDatabase;

    public function test_reprint_does_not_change_invoice_balance_or_status(): void
    {
        $this->seedBillingBase();
        $this->togglePartial(true);

        $cashier = $this->cashierWithOpenSession();
        $sessionId = $this->openSessionFor($cashier, '500.00');
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Reimprimir sin tocar',
                'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated();

        $before = Invoice::query()->findOrFail($invoiceId)->only([
            'paid_amount', 'paid_amount_cents', 'balance_due', 'balance_due_cents', 'status',
        ]);
        $paymentsBefore = Payment::query()->where('invoice_id', $invoiceId)->get()->toArray();

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/reprint", [
                'width' => '80mm',
                'reason' => 'Tiraje mojado por humedad',
            ])
            ->assertOk();

        $after = Invoice::query()->findOrFail($invoiceId)->only([
            'paid_amount', 'paid_amount_cents', 'balance_due', 'balance_due_cents', 'status',
        ]);
        $paymentsAfter = Payment::query()->where('invoice_id', $invoiceId)->get()->toArray();

        $this->assertSame($before, $after);
        $this->assertEquals($paymentsBefore, $paymentsAfter);

        $this->assertSame(1, AuditLog::query()
            ->where('action', 'invoice.reprinted')
            ->where('entity_id', $invoiceId)
            ->count());
    }

    public function test_reprint_requires_a_reason_for_auditability(): void
    {
        $this->seedBillingBase();
        $this->togglePartial(true);

        $cashier = $this->cashierWithOpenSession();
        $this->openSessionFor($cashier, '500.00');
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Reimpresion sin motivo',
                'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/reprint", [
                'width' => '80mm',
                'reason' => '',
            ])
            ->assertJsonValidationErrors('reason');

        $this->assertSame(0, AuditLog::query()
            ->where('action', 'invoice.reprinted')
            ->where('entity_id', $invoiceId)
            ->count());
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

    private function togglePartial(bool $enabled): void
    {
        FiscalSetting::query()->update(['partial_payments_enabled' => $enabled]);
    }

    private function cashierWithOpenSession(string $suffix = ''): User
    {
        $cashier = User::factory()->create([
            'username' => 'caj-re'.$suffix.'-'.uniqid(),
        ]);
        $cashier->assignRole('cajero');

        return $cashier->refresh();
    }

    private function openSessionFor(User $cashier, string $openingAmount): int
    {
        $session = CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => $openingAmount,
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        return (int) $session->id;
    }
}
