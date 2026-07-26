<?php

namespace Tests\Feature\Accounting;

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
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class MixedDialysisAccountingFactsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);

        FiscalSetting::query()->create([
            'receipt_template_mode' => 'institutional',
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

    public function test_mixed_dialysis_basket_reconciles_reports_service_ranking_and_receipt(): void
    {
        $cashier = $this->cashierWithOpenSession();
        $session = CashRegisterSession::query()
            ->where('user_id', $cashier->id)
            ->firstOrFail();
        $product = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $product->forceFill([
            'price' => '900.00',
            'taxable' => false,
            'special_rule_code' => null,
        ])->save();
        $erythropoietin = Service::query()
            ->where('name', 'Eritropoyetina')
            ->firstOrFail();

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Paciente con receta',
                'dialysis_prescription' => true,
                'items' => [
                    ['service_id' => $product->id, 'quantity' => '1.00'],
                    ['service_id' => $erythropoietin->id, 'quantity' => '1.00'],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('data.total', '900.00')
            ->json('data.id');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $session->id,
                'method' => Payment::METHOD_CASH,
                'amount' => '900.00',
            ])
            ->assertCreated()
            ->assertJsonPath('data.invoice.status', Invoice::STATUS_PAID);

        $invoice = Invoice::query()->with('items')->findOrFail($invoiceId);
        $this->assertSame(90000, $invoice->total_cents);
        $this->assertSame(90000, $invoice->paid_amount_cents);
        $this->assertSame(90000, $invoice->items->sum('line_total_cents'));

        $query = http_build_query([
            'date_from' => now()->toDateString(),
            'date_to' => now()->toDateString(),
        ]);
        $admin = $this->admin();

        $this->actingAs($admin)
            ->getJson("/api/reports/income?{$query}")
            ->assertOk()
            ->assertJsonPath('data.total_billed', '900.00')
            ->assertJsonPath('data.total_collected', '900.00')
            ->assertJsonPath('data.total_pending', '0.00')
            ->assertJsonPath('data.payments_by_method.cash', '900.00')
            ->assertJsonPath('data.invoice_count', 1)
            ->assertJsonPath('data.payment_count', 1);

        $this->actingAs($admin)
            ->getJson("/api/reports/services?{$query}")
            ->assertOk()
            ->assertJsonCount(2, 'data.services')
            ->assertJsonFragment([
                'service' => 'Glucosa',
                'total' => '900.00',
            ])
            ->assertJsonFragment([
                'service' => 'Eritropoyetina',
                'total' => '0.00',
            ]);

        $this->actingAs($cashier)
            ->getJson("/api/invoices/{$invoiceId}/receipt?width=half_letter")
            ->assertOk()
            ->assertJsonPath('data.width', 'half_letter')
            ->assertJsonPath('data.invoice.total', '900.00')
            ->assertJsonPath('data.invoice.paid_amount', '900.00')
            ->assertJsonPath('data.invoice.balance_due', '0.00')
            ->assertJsonCount(2, 'data.items')
            ->assertJsonFragment([
                'service_name' => 'Glucosa',
                'line_total' => '900.00',
                'special_rule_applied' => false,
            ])
            ->assertJsonFragment([
                'service_name' => 'Eritropoyetina',
                'line_total' => '0.00',
                'special_rule_applied' => true,
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

    private function admin(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        return $admin->refresh();
    }
}
