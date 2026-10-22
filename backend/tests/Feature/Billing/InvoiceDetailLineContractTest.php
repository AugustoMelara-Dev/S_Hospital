<?php

declare(strict_types=1);

namespace Tests\Feature\Billing;

use App\Models\CashRegisterSession;
use App\Models\Category;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * C2-B8 (V05): el detalle de factura `GET /api/invoices/{id}` debe entregar por
 * linea el mismo contrato que la valoracion: precio registrado, ajuste por regla,
 * causa textual y procedencia del ajuste.
 *
 * Caso critico: una linea historica backfilleada conserva `rule_adjustment_cents
 * = 0`, pero se marca `rule_adjustment_persisted = false` para que el consumidor
 * no presente "0.00" como ajuste medido.
 */
class InvoiceDetailLineContractTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedBillingBase();
    }

    public function test_detail_exposes_persisted_rule_contract_per_line(): void
    {
        $cashier = $this->cashier();
        $epo = $this->service('Eritropoyetina 2000 UI', '25.00', Service::ERYTHROPOIETIN_RULE);
        $other = $this->service('Producto no elegible', '100.00');

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => "O'Brien María",
                'dialysis_prescription' => true,
                'items' => [
                    ['service_id' => $epo->id, 'quantity' => '2.00'],
                    ['service_id' => $other->id, 'quantity' => '1.00'],
                ],
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($cashier)
            ->getJson('/api/invoices/'.$invoiceId)
            ->assertOk()
            ->assertJsonPath('data.patient_name', "O'Brien María")
            ->assertJsonPath('data.items.0.unit_price_registered_cents', 2500)
            ->assertJsonPath('data.items.0.unit_price_registered', '25.00')
            ->assertJsonPath('data.items.0.unit_price_cents', 0)
            ->assertJsonPath('data.items.0.rule_adjustment_cents', 5000)
            ->assertJsonPath('data.items.0.rule_adjustment', '50.00')
            ->assertJsonPath('data.items.0.rule_adjustment_persisted', true)
            ->assertJsonPath('data.items.0.special_rule_applied', true)
            ->assertJsonPath('data.items.0.rule_cause', 'Medicamento elegible sin cobro por receta/dialisis autorizada ('.Service::ERYTHROPOIETIN_RULE.').')
            // Linea cobrada: ajuste 0 exacto, sin regla.
            ->assertJsonPath('data.items.1.unit_price_registered_cents', 10000)
            ->assertJsonPath('data.items.1.rule_adjustment_cents', 0)
            ->assertJsonPath('data.items.1.rule_adjustment_persisted', true)
            ->assertJsonPath('data.items.1.special_rule_applied', false)
            ->assertJsonPath('data.items.1.rule_cause', null);
    }

    public function test_backfilled_historical_line_reports_unknown_adjustment_instead_of_zero(): void
    {
        $cashier = $this->cashier();
        $epo = $this->service('Eritropoyetina 2000 UI', '25.00', Service::ERYTHROPOIETIN_RULE);

        $invoice = $this->emit($cashier, $epo);
        $item = $invoice->items()->firstOrFail();

        // Reproduce el backfill de la migracion 2026_09_18_000002: el precio de
        // catalogo nunca se guardo y el ajuste quedo en el default 0.
        $item->forceFill([
            'unit_price_registered_cents' => $item->unit_price_cents,
            'rule_adjustment_cents' => 0,
        ])->save();

        $this->actingAs($cashier)
            ->getJson('/api/invoices/'.$invoice->id)
            ->assertOk()
            ->assertJsonPath('data.items.0.special_rule_applied', true)
            ->assertJsonPath('data.items.0.unit_price_registered_cents', 0)
            ->assertJsonPath('data.items.0.rule_adjustment_cents', 0)
            // El 0 almacenado no es un ajuste medido: se declara desconocido.
            ->assertJsonPath('data.items.0.rule_adjustment_persisted', false)
            ->assertJsonPath('data.items.0.rule_cause', 'Medicamento elegible sin cobro por receta/dialisis autorizada ('.Service::ERYTHROPOIETIN_RULE.').');
    }

    private function emit(User $cashier, Service $epo): Invoice
    {
        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Paciente historico',
                'dialysis_prescription' => true,
                'items' => [['service_id' => $epo->id, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->assertJsonPath('data.settlement', Invoice::SETTLEMENT_FREE_BY_RULE)
            ->json('data.id');

        return Invoice::query()->with('items')->findOrFail($invoiceId);
    }

    private function service(string $name, string $price, ?string $specialRule = null, bool $taxable = false): Service
    {
        $category = Category::factory()->create();

        return Service::factory()->create([
            'name' => $name,
            'price' => $price,
            'taxable' => $taxable,
            'special_rule_code' => $specialRule,
            'active' => true,
            'visible_in_billing' => true,
            'is_billable' => true,
            'category_id' => $category->id,
        ]);
    }

    private function cashier(): User
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

    private function seedBillingBase(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

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
}
