<?php

declare(strict_types=1);

namespace Tests\Feature\Billing;

use App\Models\CashRegisterSession;
use App\Models\Category;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\IdempotencyKey;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptSeries;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\ReceiptPrintProfileSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * R2-MONEY-BE — HTTP contract for POST /api/invoices/preview.
 *
 * The preview is the server-side prevalidation the POS must consume instead of
 * recomputing fiscal math in the browser. It must return integer cents per
 * concept, expose the applied rate and its origin, distinguish legitimate zero
 * from unavailable tax, and never write (no correlative, invoice, payment,
 * receipt or idempotency row).
 *
 * The 15% rate used here is a TEST FIXTURE, not a fiscal decision.
 */
class InvoicePreviewContractTest extends TestCase
{
    use RefreshDatabase;

    public function test_preview_returns_integer_cents_and_does_not_emit_anything(): void
    {
        $this->seedBillingBase();
        $cashier = $this->userWithRole('cajero');
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $sequence = FiscalSequence::query()->firstOrFail();
        $sequence->forceFill(['current_number' => 5])->save();

        $response = $this->actingAs($cashier)
            ->postJson('/api/invoices/preview', [
                'items' => [['service_id' => $glucose->id, 'quantity' => '2.00']],
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'ok')
            ->assertJsonPath('data.currency', 'HNL')
            ->assertJsonPath('data.tax.label', 'ISV')
            ->assertJsonPath('data.tax.available', true)
            ->assertJsonPath('data.tax.rate', '15.00')
            ->assertJsonPath('data.tax.rate_basis_points', 1500)
            ->assertJsonPath('data.tax.origin', 'fiscal_settings')
            ->assertJsonPath('data.totals.subtotal_cents', 3000)
            ->assertJsonPath('data.totals.taxable_base_cents', 3000)
            ->assertJsonPath('data.totals.exempt_cents', 0)
            ->assertJsonPath('data.totals.tax_cents', 450)
            ->assertJsonPath('data.totals.discount_cents', 0)
            ->assertJsonPath('data.totals.total_cents', 3450)
            ->assertJsonPath('data.items.0.taxable', true)
            ->assertJsonPath('data.items.0.quantity_cents', 200)
            ->assertJsonPath('data.items.0.line_subtotal_cents', 3000)
            ->assertJsonPath('data.items.0.tax_cents', 450)
            ->assertJsonPath('data.items.0.line_total_cents', 3450)
            ->assertJsonPath('data.emission.persisted', false)
            ->assertJsonPath('data.emission.invoice_created', false)
            ->assertJsonPath('data.emission.fiscal_number_consumed', false)
            ->assertJsonPath('data.emission.payment_created', false)
            ->assertJsonPath('data.emission.institutional_receipt_created', false);

        $this->assertNull($response->json('data.zero_reason'));
        $this->assertIsInt($response->json('data.totals.subtotal_cents'));
        $this->assertIsInt($response->json('data.totals.tax_cents'));
        $this->assertIsInt($response->json('data.totals.total_cents'));

        // No emission side effects.
        $this->assertSame(0, Invoice::query()->count());
        $this->assertSame(0, Payment::query()->count());
        $this->assertSame(0, InstitutionalReceipt::query()->count());
        $this->assertSame(0, IdempotencyKey::query()->count());
        $this->assertSame(5, (int) FiscalSequence::query()->findOrFail($sequence->id)->current_number);
    }

    public function test_preview_does_not_require_an_open_cash_session(): void
    {
        $this->seedBillingBase();
        $cashier = $this->userWithRole('cajero');
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $this->assertSame(0, CashRegisterSession::query()->count());

        $this->actingAs($cashier)
            ->postJson('/api/invoices/preview', [
                'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
            ])
            ->assertOk()
            ->assertJsonPath('data.totals.total_cents', 1725);
    }

    public function test_operational_receipt_preview_uses_real_cart_without_persisting_or_consuming_numbers(): void
    {
        $this->seedBillingBase();
        $this->seed(ReceiptPrintProfileSeeder::class);
        $cashier = $this->userWithRole('cajero');
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $erythropoietin = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();
        $sequence = FiscalSequence::query()->firstOrFail();
        $sequence->forceFill(['current_number' => 17])->save();
        $receiptSeries = InstitutionalReceiptSeries::query()->create([
            'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
            'series' => 'REC-PREVIEW',
            'prefix' => 'RP',
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 9,
            'active' => true,
        ]);

        $response = $this->actingAs($cashier)
            ->postJson('/api/invoices/receipt-preview', [
                'patient_name' => '  María   Preview  ',
                'dialysis_prescription' => true,
                'items' => [
                    ['service_id' => $erythropoietin->id, 'quantity' => '1.00'],
                    ['service_id' => $glucose->id, 'quantity' => '1001.25'],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.draft', true)
            ->assertJsonPath('data.watermark', 'BORRADOR - SIN VALIDEZ')
            ->assertJsonPath('data.reserved_number', false)
            ->assertJsonPath('data.document.draft', true)
            ->assertJsonPath('data.valuation.items.0.special_rule_applied', true)
            ->assertJsonPath('data.valuation.items.1.quantity_cents', 100125)
            ->assertJsonPath('data.valuation.emission.persisted', false);

        $html = (string) $response->json('data.html');
        $this->assertStringContainsString('BORRADOR - SIN VALIDEZ', $html);
        $this->assertStringContainsString('María Preview', $html);
        $this->assertStringContainsString('Eritropoyetina', $html);
        $this->assertStringContainsString('Glucosa', $html);
        $this->assertStringContainsString('Sin cobro por receta', $html);

        $this->assertSame(0, Invoice::query()->count());
        $this->assertSame(0, Payment::query()->count());
        $this->assertSame(0, InstitutionalReceipt::query()->count());
        $this->assertSame(0, IdempotencyKey::query()->count());
        $this->assertSame(17, (int) $sequence->fresh()->current_number);
        $this->assertSame(9, (int) $receiptSeries->fresh()->current_number);
    }

    public function test_preview_requires_authentication(): void
    {
        $this->seedBillingBase();

        $this->postJson('/api/invoices/preview', [
            'items' => [['service_id' => 1, 'quantity' => '1.00']],
        ])->assertStatus(401);
    }

    public function test_preview_requires_invoices_create_permission(): void
    {
        $this->seedBillingBase();
        $outsider = User::factory()->create();
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $this->actingAs($outsider)
            ->postJson('/api/invoices/preview', [
                'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
            ])
            ->assertForbidden();
    }

    public function test_preview_rejects_dialysis_flag_without_permission(): void
    {
        $this->seedBillingBase();
        $supervisor = $this->userWithRole('supervisor');
        $erythropoietin = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();

        $this->actingAs($supervisor)
            ->postJson('/api/invoices/preview', [
                'dialysis_prescription' => true,
                'items' => [['service_id' => $erythropoietin->id, 'quantity' => '1.00']],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('dialysis_prescription');
    }

    public function test_preview_applies_free_erythropoietin_with_permission_as_zero_total(): void
    {
        $this->seedBillingBase();
        $cashier = $this->userWithRole('cajero');
        $erythropoietin = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();

        $this->actingAs($cashier)
            ->postJson('/api/invoices/preview', [
                'dialysis_prescription' => true,
                'items' => [['service_id' => $erythropoietin->id, 'quantity' => '1.00']],
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'zero_total')
            ->assertJsonPath('data.zero_reason', 'all_lines_free_by_rule')
            ->assertJsonPath('data.totals.subtotal_cents', 0)
            ->assertJsonPath('data.totals.tax_cents', 0)
            ->assertJsonPath('data.totals.total_cents', 0)
            ->assertJsonPath('data.items.0.special_rule_applied', true)
            ->assertJsonPath('data.items.0.unit_price_cents', 0);
    }

    public function test_preview_uses_authorized_catalog_price_and_tax_for_erythropoietin_without_prescription(): void
    {
        $this->seedBillingBase();
        $cashier = $this->userWithRole('cajero');
        $erythropoietin = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();
        $erythropoietin->forceFill([
            'price' => '40.00',
            'taxable' => true,
        ])->save();

        $this->actingAs($cashier)
            ->postJson('/api/invoices/preview', [
                'dialysis_prescription' => false,
                'items' => [['service_id' => $erythropoietin->id, 'quantity' => '1.00']],
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'ok')
            ->assertJsonPath('data.totals.subtotal_cents', 4000)
            ->assertJsonPath('data.totals.taxable_base_cents', 4000)
            ->assertJsonPath('data.totals.tax_cents', 600)
            ->assertJsonPath('data.totals.total_cents', 4600)
            ->assertJsonPath('data.items.0.taxable', true)
            ->assertJsonPath('data.items.0.special_rule_applied', false);
    }

    public function test_preview_reports_exempt_lines_as_zero_tax_not_unavailable(): void
    {
        $this->seedBillingBase();
        $cashier = $this->userWithRole('cajero');
        $exempt = $this->makeService('10.00', taxable: false);

        $this->actingAs($cashier)
            ->postJson('/api/invoices/preview', [
                'items' => [['service_id' => $exempt->id, 'quantity' => '1.00']],
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'zero_tax')
            ->assertJsonPath('data.tax.available', true)
            ->assertJsonPath('data.totals.subtotal_cents', 1000)
            ->assertJsonPath('data.totals.taxable_base_cents', 0)
            ->assertJsonPath('data.totals.exempt_cents', 1000)
            ->assertJsonPath('data.totals.tax_cents', 0)
            ->assertJsonPath('data.totals.total_cents', 1000)
            ->assertJsonPath('data.items.0.taxable', false);
    }

    public function test_preview_reports_unparseable_tax_rate_as_unavailable_not_as_zero(): void
    {
        $this->seedBillingBase();
        $cashier = $this->userWithRole('cajero');
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        // A stored value the regular parser rejects (negative is not a valid
        // percentage in this domain). The endpoint must say "unavailable",
        // never return a fake 0 tax.
        FiscalSetting::query()->update(['default_tax_rate' => '-5.00']);

        $response = $this->actingAs($cashier)
            ->postJson('/api/invoices/preview', [
                'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'tax_unavailable')
            ->assertJsonPath('data.tax.available', false)
            ->assertJsonPath('data.tax.rate', null)
            ->assertJsonPath('data.tax.rate_basis_points', null)
            ->assertJsonPath('data.tax.origin', 'unavailable')
            ->assertJsonPath('data.totals.subtotal_cents', 1500)
            ->assertJsonPath('data.totals.total_cents', null)
            ->assertJsonPath('data.items.0.tax_cents', null)
            ->assertJsonPath('data.items.0.line_total_cents', null);

        $this->assertNull($response->json('data.totals.tax_cents'));
    }

    public function test_preview_rejects_a_service_emission_would_reject(): void
    {
        $this->seedBillingBase();
        $cashier = $this->userWithRole('cajero');
        $inactive = $this->makeService('10.00', active: false);

        $this->actingAs($cashier)
            ->postJson('/api/invoices/preview', [
                'items' => [['service_id' => $inactive->id, 'quantity' => '1.00']],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('items.0.service_id');
    }

    /**
     * The whole point of the contract: the preview must reconcile with the
     * invoice the server actually emits for the same basket.
     */
    public function test_preview_totals_match_the_emitted_invoice_for_the_same_basket(): void
    {
        $this->seedBillingBase();
        $cashier = $this->userWithRole('cajero');
        $this->openSessionFor($cashier);
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $exempt = $this->makeService('10.00', taxable: false);
        $erythropoietin = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();

        $items = [
            ['service_id' => $glucose->id, 'quantity' => '2.00'],
            ['service_id' => $exempt->id, 'quantity' => '1.00'],
            ['service_id' => $erythropoietin->id, 'quantity' => '1.00'],
        ];

        $preview = $this->actingAs($cashier)
            ->postJson('/api/invoices/preview', [
                'dialysis_prescription' => true,
                'items' => $items,
            ])
            ->assertOk();

        $invoice = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Reconciliacion Preview',
                'dialysis_prescription' => true,
                'items' => $items,
            ])
            ->assertCreated()
            ->json('data');

        $this->assertSame($invoice['subtotal_cents'], $preview->json('data.totals.subtotal_cents'));
        $this->assertSame($invoice['tax_amount_cents'], $preview->json('data.totals.tax_cents'));
        $this->assertSame($invoice['total_cents'], $preview->json('data.totals.total_cents'));
        $this->assertSame($invoice['discount_amount_cents'], $preview->json('data.totals.discount_cents'));
        $this->assertSame((string) $invoice['tax_rate_snapshot'], $preview->json('data.tax.rate'));
    }

    /**
     * Edge amounts must stay integer cents: 0 valid/exempt, 0.01, 999.99,
     * 1000.00, 1029.25, 1046.50 and 10000.00, with integer and fractional quantities.
     *
     * Expected tax uses the same half-up integer rule as the domain action.
     *
     * @return array<string, array{string, string, int, int, int}>
     */
    public static function edgeAmountProvider(): array
    {
        return [
            'one cent' => ['0.01', '1', 1, 0, 1],
            '999.99' => ['999.99', '1', 99999, 15000, 114999],
            '1000.00' => ['1000.00', '1', 100000, 15000, 115000],
            '1029.25' => ['1029.25', '1', 102925, 15439, 118364],
            '1046.50' => ['1046.50', '1', 104650, 15698, 120348],
            '10000.00' => ['10000.00', '1', 1000000, 150000, 1150000],
            '1029.25 x2' => ['1029.25', '2', 205850, 30878, 236728],
            '1046.50 x2.25' => ['1046.50', '2.25', 235463, 35319, 270782],
        ];
    }

    #[DataProvider('edgeAmountProvider')]
    public function test_preview_edge_amounts_are_integer_cents(
        string $price,
        string $quantity,
        int $expectedSubtotal,
        int $expectedTax,
        int $expectedTotal,
    ): void {
        $this->seedBillingBase();
        $cashier = $this->userWithRole('cajero');
        $service = $this->makeService($price);

        $response = $this->actingAs($cashier)
            ->postJson('/api/invoices/preview', [
                'items' => [['service_id' => $service->id, 'quantity' => $quantity]],
            ])
            ->assertOk();

        $this->assertSame($expectedSubtotal, $response->json('data.totals.subtotal_cents'));
        $this->assertSame($expectedTax, $response->json('data.totals.tax_cents'));
        $this->assertSame($expectedTotal, $response->json('data.totals.total_cents'));
        $this->assertIsInt($response->json('data.totals.total_cents'));
    }

    public function test_preview_zero_price_is_a_legitimate_zero_total_not_unavailable(): void
    {
        $this->seedBillingBase();
        $cashier = $this->userWithRole('cajero');
        $free = $this->makeService('0.00', taxable: false);

        $this->actingAs($cashier)
            ->postJson('/api/invoices/preview', [
                'items' => [['service_id' => $free->id, 'quantity' => '1.00']],
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'zero_total')
            ->assertJsonPath('data.zero_reason', 'configured_zero_price')
            ->assertJsonPath('data.tax.available', true)
            ->assertJsonPath('data.totals.total_cents', 0);
    }

    private function seedBillingBase(): void
    {
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

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create([
            'username' => $role.'-'.uniqid(),
        ]);
        $user->assignRole($role);

        return $user->refresh();
    }

    private function openSessionFor(User $user): void
    {
        CashRegisterSession::query()->create([
            'user_id' => $user->id,
            'open_user_id' => $user->id,
            'opening_amount' => '500.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);
    }

    private function makeService(
        string $price,
        bool $taxable = true,
        bool $active = true,
    ): Service {
        $category = Category::factory()->create();

        return Service::factory()->create([
            'name' => 'Servicio preview '.uniqid(),
            'price' => $price,
            'taxable' => $taxable,
            'active' => $active,
            'visible_in_billing' => true,
            'is_billable' => true,
            'special_rule_code' => null,
            'category_id' => $category->id,
        ]);
    }
}
