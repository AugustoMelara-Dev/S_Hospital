<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\Invoice;
use App\Models\User;
use App\Support\InvoiceAccess;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvoiceAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_cajero_can_operate_own_invoice_emitted_today(): void
    {
        $cashier = $this->cajero();
        $invoice = $this->invoiceFor($cashier, today: true);

        app(InvoiceAccess::class)->authorizeOperationalAccess($cashier, $invoice);

        $this->assertTrue(app(InvoiceAccess::class)->canOperateInvoice($cashier, $invoice));
    }

    public function test_cajero_cannot_operate_another_cashier_invoice(): void
    {
        $cashier = $this->cajero();
        $other = $this->cajero();
        $invoice = $this->invoiceFor($other, today: true);

        $this->expectException(AuthorizationException::class);

        app(InvoiceAccess::class)->authorizeOperationalAccess($cashier, $invoice);
    }

    public function test_cajero_cannot_operate_own_invoice_emitted_yesterday(): void
    {
        $cashier = $this->cajero();
        $invoice = $this->invoiceFor($cashier, today: false);

        $this->expectException(AuthorizationException::class);

        app(InvoiceAccess::class)->authorizeOperationalAccess($cashier, $invoice);
    }

    public function test_admin_can_operate_any_invoice(): void
    {
        $admin = $this->admin();
        $invoice = $this->invoiceFor($admin, today: false);

        app(InvoiceAccess::class)->authorizeOperationalAccess($admin, $invoice);

        $this->assertTrue(app(InvoiceAccess::class)->canOperateInvoice($admin, $invoice));
    }

    public function test_admin_can_access_any_invoice(): void
    {
        $admin = $this->admin();
        $invoice = $this->invoiceFor($admin, today: false);

        $this->assertTrue(app(InvoiceAccess::class)->canAccessAnyInvoice($admin));
    }

    public function test_cajero_cannot_access_any_invoice(): void
    {
        $cashier = $this->cajero();

        $this->assertFalse(app(InvoiceAccess::class)->canAccessAnyInvoice($cashier));
    }

    public function test_supervisor_can_access_any_invoice(): void
    {
        $supervisor = $this->supervisor();

        $this->assertTrue(app(InvoiceAccess::class)->canAccessAnyInvoice($supervisor));
    }

    private function cajero(): User
    {
        $user = User::factory()->create([
            'username' => 'cajero-access-'.uniqid(),
            'email' => 'cajero-'.uniqid().'@hospital.local',
            'must_change_password' => false,
            'active' => true,
        ]);
        $user->assignRole('cajero');

        return $user;
    }

    private function admin(): User
    {
        $user = User::factory()->create([
            'username' => 'admin-access-'.uniqid(),
            'email' => 'admin-'.uniqid().'@hospital.local',
            'must_change_password' => false,
            'active' => true,
        ]);
        $user->assignRole('admin');

        return $user;
    }

    private function supervisor(): User
    {
        $user = User::factory()->create([
            'username' => 'supervisor-access-'.uniqid(),
            'email' => 'supervisor-'.uniqid().'@hospital.local',
            'must_change_password' => false,
            'active' => true,
        ]);
        $user->assignRole('supervisor');

        return $user;
    }

    private function invoiceFor(User $issuer, bool $today): Invoice
    {
        $cashier = $this->cajero();
        CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => '500.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        $sequence = FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => '000-001-01',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => random_int(1, 99999999),
            'cai' => 'TEST-CAI',
            'valid_until' => now()->addYear()->toDateString(),
            'active' => true,
        ]);

        return Invoice::query()->create([
            'invoice_number' => '000-001-01-'.str_pad((string) random_int(1, 99999999), 8, '0', STR_PAD_LEFT),
            'fiscal_sequence_id' => $sequence->id,
            'patient_name' => 'Paciente de prueba',
            'subtotal' => '10.00',
            'tax_amount' => '1.50',
            'total' => '11.50',
            'paid_amount' => '0.00',
            'balance_due' => '11.50',
            'status' => Invoice::STATUS_ISSUED,
            'cash_session_id' => null,
            'issued_by' => $issuer->id,
            'issued_at' => $today ? now() : now()->subDay(),
        ]);
    }
}
