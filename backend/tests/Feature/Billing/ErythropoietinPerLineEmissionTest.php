<?php

declare(strict_types=1);

namespace Tests\Feature\Billing;

use App\Models\CashMovement;
use App\Models\CashRegisterSession;
use App\Models\Category;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * T-BE-01 — MANDATO_DEV §8: la gratuidad por receta/dialisis es EXCLUSIVA del
 * medicamento elegible (services.special_rule_code = ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION),
 * se evalua por linea y una emision totalmente gratuita NO crea cobro ficticio.
 *
 * Los importes son sinteticos y los servicios son no gravables para aislar la
 * regla (la exencion de impuestos no sustituye la gratuidad).
 */
class ErythropoietinPerLineEmissionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedBillingBase();
    }

    public function test_case_1_epo_without_condition_is_charged_full_price(): void
    {
        $cashier = $this->cashier();
        $epo = $this->service('Eritropoyetina 2000 UI', '25.00', Service::ERYTHROPOIETIN_RULE);

        $invoiceId = $this->emit($cashier, [$this->line($epo, '1.00')])
            ->assertCreated()
            ->assertJsonPath('data.subtotal', '25.00')
            ->assertJsonPath('data.total', '25.00')
            ->assertJsonPath('data.status', Invoice::STATUS_ISSUED)
            ->assertJsonPath('data.settlement', Invoice::SETTLEMENT_PENDING)
            ->assertJsonPath('data.items.0.special_rule_applied', false)
            ->assertJsonPath('data.items.0.unit_price', '25.00')
            ->assertJsonPath('data.items.0.line_total', '25.00')
            ->json('data.id');

        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'total' => '25.00',
            'total_cents' => 2500,
            'settlement' => Invoice::SETTLEMENT_PENDING,
        ]);
        $this->assertDatabaseMissing('payments', ['invoice_id' => $invoiceId]);
    }

    public function test_case_2_epo_with_condition_is_zero_and_emitted_without_charge(): void
    {
        $cashier = $this->cashier();
        $epo = $this->service('Eritropoyetina 2000 UI', '25.00', Service::ERYTHROPOIETIN_RULE);

        $invoiceId = $this->emit($cashier, [$this->line($epo, '1.00')], dialysis: true)
            ->assertCreated()
            ->assertJsonPath('data.total', '0.00')
            ->assertJsonPath('data.status', Invoice::STATUS_PAID)
            ->assertJsonPath('data.settlement', Invoice::SETTLEMENT_FREE_BY_RULE)
            ->assertJsonPath('data.items.0.special_rule_applied', true)
            ->assertJsonPath('data.items.0.unit_price', '0.00')
            ->assertJsonPath('data.items.0.line_total', '0.00')
            ->json('data.id');

        // T-BE-02: se persiste el precio registrado (catalogo) y el ajuste por
        // regla; el ajuste es informativo y ya esta incluido en unit_price_cents.
        $this->assertDatabaseHas('invoice_items', [
            'invoice_id' => $invoiceId,
            'service_id' => $epo->id,
            'special_rule_applied' => true,
            'unit_price_cents' => 0,
            'unit_price_registered_cents' => 2500,
            'rule_adjustment_cents' => 2500,
            'line_total_cents' => 0,
        ]);
        // Sin cobro ficticio ni movimiento de caja.
        $this->assertDatabaseMissing('payments', ['invoice_id' => $invoiceId]);
        $this->assertDatabaseMissing('cash_movements', ['type' => CashMovement::TYPE_PAYMENT]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'invoice.issued_without_charge',
            'entity_type' => Invoice::class,
            'entity_id' => $invoiceId,
        ]);
    }

    public function test_case_3_epo_with_condition_plus_ten_products_only_epo_is_free(): void
    {
        $cashier = $this->cashier();
        $epo = $this->service('Eritropoyetina 2000 UI', '25.00', Service::ERYTHROPOIETIN_RULE);
        $products = [];
        for ($i = 0; $i < 10; $i++) {
            $products[] = $this->line($this->service('Producto '.$i, '100.00'), '1.00');
        }

        $invoiceId = $this->emit($cashier, array_merge([$this->line($epo, '1.00')], $products), dialysis: true)
            ->assertCreated()
            ->assertJsonPath('data.total', '1000.00')
            ->assertJsonPath('data.settlement', Invoice::SETTLEMENT_PENDING)
            ->assertJsonPath('data.items.0.special_rule_applied', true)
            ->assertJsonPath('data.items.0.line_total', '0.00')
            ->json('data.id');

        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'total_cents' => 100000,
        ]);
        // El resto de lineas conserva su precio completo.
        $this->assertSame(
            100000,
            (int) Invoice::query()->findOrFail($invoiceId)->items()->sum('line_total_cents')
        );

        // T-BE-02: la linea gratuita guarda su precio registrado y su ajuste;
        // las lineas cobradas guardan ajuste 0.
        $this->assertDatabaseHas('invoice_items', [
            'invoice_id' => $invoiceId,
            'service_id' => $epo->id,
            'unit_price_cents' => 0,
            'unit_price_registered_cents' => 2500,
            'rule_adjustment_cents' => 2500,
        ]);
        $this->assertDatabaseHas('invoice_items', [
            'invoice_id' => $invoiceId,
            'unit_price_cents' => 10000,
            'unit_price_registered_cents' => 10000,
            'rule_adjustment_cents' => 0,
        ]);
    }

    public function test_case_4_same_cart_without_condition_totals_full_price(): void
    {
        $cashier = $this->cashier();
        $epo = $this->service('Eritropoyetina 2000 UI', '25.00', Service::ERYTHROPOIETIN_RULE);
        $products = [];
        for ($i = 0; $i < 10; $i++) {
            $products[] = $this->line($this->service('Producto '.$i, '100.00'), '1.00');
        }

        $this->emit($cashier, array_merge([$this->line($epo, '1.00')], $products), dialysis: false)
            ->assertCreated()
            ->assertJsonPath('data.total', '1025.00')
            ->assertJsonPath('data.items.0.special_rule_applied', false)
            ->assertJsonPath('data.items.0.line_total', '25.00');
    }

    public function test_case_5_active_condition_without_eligible_item_frees_nothing(): void
    {
        $cashier = $this->cashier();
        $other = $this->service('Servicio general', '100.00');

        $this->emit($cashier, [$this->line($other, '1.00')], dialysis: true)
            ->assertCreated()
            ->assertJsonPath('data.total', '100.00')
            ->assertJsonPath('data.settlement', Invoice::SETTLEMENT_PENDING)
            ->assertJsonPath('data.items.0.special_rule_applied', false)
            ->assertJsonPath('data.items.0.unit_price', '100.00');
    }

    public function test_case_6_another_medicine_with_similar_name_keeps_its_price(): void
    {
        $cashier = $this->cashier();
        // Mismo nombre/precio pero SIN el codigo de regla elegible.
        $similar = $this->service('Eritropoyetina Similar', '25.00');

        $this->emit($cashier, [$this->line($similar, '1.00')], dialysis: true)
            ->assertCreated()
            ->assertJsonPath('data.total', '25.00')
            ->assertJsonPath('data.items.0.special_rule_applied', false)
            ->assertJsonPath('data.items.0.special_rule_code', null)
            ->assertJsonPath('data.items.0.line_total', '25.00');
    }

    public function test_case_7_epo_plus_billable_dialysis_concept_and_others_only_epo_is_adjusted(): void
    {
        $cashier = $this->cashier();
        $epo = $this->service('Eritropoyetina 2000 UI', '25.00', Service::ERYTHROPOIETIN_RULE);
        $dialysisService = $this->service('Sesion de dialisis', '500.00');
        $other = $this->service('Producto adicional', '100.00');

        $this->emit($cashier, [
            $this->line($epo, '1.00'),
            $this->line($dialysisService, '1.00'),
            $this->line($other, '1.00'),
        ], dialysis: true)
            ->assertCreated()
            ->assertJsonPath('data.total', '600.00')
            ->assertJsonPath('data.items.0.special_rule_applied', true)
            ->assertJsonPath('data.items.0.line_total', '0.00')
            ->assertJsonPath('data.items.1.special_rule_applied', false)
            ->assertJsonPath('data.items.1.line_total', '500.00')
            ->assertJsonPath('data.items.2.line_total', '100.00');
    }

    public function test_case_8_user_without_permission_manipulating_flags_and_prices_is_rejected(): void
    {
        $issuer = $this->issuerWithoutDialysisPermission();
        $epo = $this->service('Eritropoyetina 2000 UI', '25.00', Service::ERYTHROPOIETIN_RULE);

        $this->actingAs($issuer)
            ->postJson('/api/invoices', [
                'patient_name' => 'Paciente manipulado',
                'dialysis_prescription' => true,
                'items' => [[
                    'service_id' => $epo->id,
                    'quantity' => '1.00',
                    'unit_price' => '0.01',
                    'price' => '0.01',
                ]],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('dialysis_prescription');

        $this->assertSame(0, Invoice::query()->count());
        $this->assertSame(0, Payment::query()->count());
    }

    public function test_case_8b_authorized_user_manipulated_prices_are_ignored_catalog_is_authoritative(): void
    {
        $cashier = $this->cashier();
        $epo = $this->service('Eritropoyetina 2000 UI', '25.00', Service::ERYTHROPOIETIN_RULE);

        $this->emit($cashier, [[
            'service_id' => $epo->id,
            'quantity' => '1.00',
            'unit_price' => '0.01',
            'price' => '0.01',
            'line_total' => '0.01',
        ]], dialysis: false)
            ->assertCreated()
            ->assertJsonPath('data.total', '25.00')
            ->assertJsonPath('data.items.0.unit_price', '25.00');
    }

    public function test_multiple_quantities_and_duplicate_epo_lines_do_not_extend_the_benefit(): void
    {
        $cashier = $this->cashier();
        $epo = $this->service('Eritropoyetina 2000 UI', '25.00', Service::ERYTHROPOIETIN_RULE);
        $other = $this->service('Producto no elegible', '100.00');

        $invoiceId = $this->emit($cashier, [
            $this->line($epo, '2.00'),
            $this->line($epo, '3.00'),
            $this->line($other, '1.00'),
        ], dialysis: true)
            ->assertCreated()
            ->assertJsonPath('data.total', '100.00')
            ->assertJsonPath('data.items.0.special_rule_applied', true)
            ->assertJsonPath('data.items.0.line_total', '0.00')
            ->assertJsonPath('data.items.1.special_rule_applied', true)
            ->assertJsonPath('data.items.1.line_total', '0.00')
            ->assertJsonPath('data.items.2.special_rule_applied', false)
            ->assertJsonPath('data.items.2.line_total', '100.00')
            ->json('data.id');

        $this->assertDatabaseHas('invoices', ['id' => $invoiceId, 'total_cents' => 10000]);
    }

    public function test_condition_does_not_replace_tax_rules_for_other_lines(): void
    {
        $cashier = $this->cashier();
        $taxable = $this->service('Servicio gravable', '100.00', taxable: true);
        $epo = $this->service('Eritropoyetina 2000 UI', '25.00', Service::ERYTHROPOIETIN_RULE);

        $this->emit($cashier, [
            $this->line($taxable, '1.00'),
            $this->line($epo, '1.00'),
        ], dialysis: true)
            ->assertCreated()
            ->assertJsonPath('data.total', '115.00')
            ->assertJsonPath('data.tax_amount', '15.00')
            ->assertJsonPath('data.items.0.special_rule_applied', false)
            ->assertJsonPath('data.items.0.tax_amount', '15.00')
            ->assertJsonPath('data.items.1.special_rule_applied', true)
            ->assertJsonPath('data.items.1.line_total', '0.00');
    }

    public function test_preview_exposes_registered_price_adjustment_cause_and_final_amount_per_line(): void
    {
        $cashier = $this->cashier();
        $epo = $this->service('Eritropoyetina 2000 UI', '25.00', Service::ERYTHROPOIETIN_RULE);
        $other = $this->service('Producto no elegible', '100.00');

        $this->actingAs($cashier)
            ->postJson('/api/invoices/preview', [
                'dialysis_prescription' => true,
                'items' => [
                    $this->line($epo, '2.00'),
                    $this->line($other, '1.00'),
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.totals.total_cents', 10000)
            ->assertJsonPath('data.items.0.unit_price_registered_cents', 2500)
            ->assertJsonPath('data.items.0.unit_price_cents', 0)
            ->assertJsonPath('data.items.0.rule_adjustment_cents', 5000)
            ->assertJsonPath('data.items.0.special_rule_applied', true)
            ->assertJsonPath('data.items.0.line_total_cents', 0)
            ->assertJsonPath('data.items.0.rule_cause', 'Medicamento elegible sin cobro por receta/dialisis autorizada ('.Service::ERYTHROPOIETIN_RULE.').')
            ->assertJsonPath('data.items.1.unit_price_registered_cents', 10000)
            ->assertJsonPath('data.items.1.unit_price_cents', 10000)
            ->assertJsonPath('data.items.1.rule_adjustment_cents', 0)
            ->assertJsonPath('data.items.1.special_rule_applied', false)
            ->assertJsonPath('data.items.1.rule_cause', null)
            ->assertJsonPath('data.items.1.line_total_cents', 10000);
    }

    public function test_preview_tax_unavailable_never_reports_a_fake_zero(): void
    {
        $cashier = $this->cashier();
        $taxable = $this->service('Servicio gravable', '100.00', taxable: true);
        FiscalSetting::query()->update(['default_tax_rate' => '-5.00']);

        $response = $this->actingAs($cashier)
            ->postJson('/api/invoices/preview', [
                'items' => [$this->line($taxable, '1.00')],
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'tax_unavailable')
            ->assertJsonPath('data.totals.total_cents', null)
            ->assertJsonPath('data.items.0.line_total_cents', null)
            ->assertJsonPath('data.items.0.unit_price_cents', 10000);

        $this->assertNotNull($response->json('data.message'));
    }

    // --- helpers ---------------------------------------------------------

    private function emit(User $issuer, array $items, bool $dialysis = false)
    {
        $payload = [
            'patient_name' => 'Paciente sintetico',
            'items' => $items,
        ];

        if ($dialysis) {
            $payload['dialysis_prescription'] = true;
        }

        return $this->actingAs($issuer)->postJson('/api/invoices', $payload);
    }

    /**
     * @return array{service_id: int, quantity: string}
     */
    private function line(Service $service, string $quantity): array
    {
        return ['service_id' => $service->id, 'quantity' => $quantity];
    }

    private function service(
        string $name,
        string $price,
        ?string $specialRule = null,
        bool $taxable = false,
    ): Service {
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

    private function issuerWithoutDialysisPermission(): User
    {
        $user = User::factory()->create();
        $user->givePermissionTo(['invoices.create', 'cash.view']);
        CashRegisterSession::query()->create([
            'user_id' => $user->id,
            'open_user_id' => $user->id,
            'opening_amount' => '500.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        return $user->refresh();
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
