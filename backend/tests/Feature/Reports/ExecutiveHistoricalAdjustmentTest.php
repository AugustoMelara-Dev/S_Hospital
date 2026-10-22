<?php

declare(strict_types=1);

namespace Tests\Feature\Reports;

use App\Actions\Billing\CreateInvoiceAction;
use App\Actions\Reports\ExecutiveReportService;
use App\Models\CashRegisterSession;
use App\Models\Category;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * C2-B8: el reporte ejecutivo no debe inventar un ajuste 0.00 en lineas
 * historicas backfilleadas. La procedencia se deriva de la evidencia inmutable
 * de la linea (precio registrado > precio efectivo persistence), no del catalogo.
 */
class ExecutiveHistoricalAdjustmentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedBillingBase();
    }

    public function test_persisted_epo_line_reports_its_real_adjustment(): void
    {
        $cashier = $this->cashier();
        $epo = $this->service('Eritropoyetina 2000 UI', '25.00', Service::ERYTHROPOIETIN_RULE);
        $this->emitFree($cashier, $epo, '1.00');

        $report = $this->report();

        $this->assertTrue($report['detail'][0]['rule_adjustment_persisted']);
        $this->assertSame('25.00', $report['detail'][0]['rule_adjustment']);
        $this->assertTrue($report['gratuities'][0]['adjustment_persisted']);
        $this->assertSame('25.00', $report['gratuities'][0]['adjustment_value']);
        $this->assertTrue($report['summary']['gratuity_adjustment_persisted']);
        $this->assertSame('25.00', $report['summary']['gratuity_adjustment_total']);
    }

    public function test_backfilled_historical_line_is_not_presented_as_zero_adjustment(): void
    {
        $cashier = $this->cashier();
        $epo = $this->service('Eritropoyetina 2000 UI', '25.00', Service::ERYTHROPOIETIN_RULE);
        $invoice = $this->emitFree($cashier, $epo, '1.00');

        $item = $invoice->items()->firstOrFail();
        // Backfill de la migracion 2026_09_18_000002.
        $item->forceFill([
            'unit_price_registered_cents' => $item->unit_price_cents,
            'rule_adjustment_cents' => 0,
        ])->save();

        $report = $this->report();

        $this->assertFalse($report['detail'][0]['rule_adjustment_persisted']);
        $this->assertSame('0.00', $report['detail'][0]['rule_adjustment']);
        $this->assertFalse($report['gratuities'][0]['adjustment_persisted']);
        // El ajuste desconocido NO entra en la suma: no se inventa 0.00 como dato.
        $this->assertFalse($report['summary']['gratuity_adjustment_persisted']);
        $this->assertSame('0.00', $report['summary']['gratuity_adjustment_total']);
        // La gratuidad en si si queda identificada: la cantidad entregada existe.
        $this->assertSame(1, $report['summary']['gratuity_item_count']);
        $this->assertTrue($report['detail'][0]['is_free']);
    }

    /**
     * @return array<string, mixed>
     */
    private function report(): array
    {
        $today = Carbon::now('America/Tegucigalpa')->toDateString();

        return app(ExecutiveReportService::class)->report([
            'date_from' => $today,
            'date_to' => $today,
        ]);
    }

    private function emitFree(User $cashier, Service $epo, string $quantity): Invoice
    {
        $invoice = app(CreateInvoiceAction::class)->execute([
            'patient_name' => 'Paciente historico',
            'items' => [['service_id' => $epo->id, 'quantity' => $quantity]],
            'dialysis_prescription' => true,
        ], $cashier->fresh());

        return $invoice->load('items');
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
