<?php

namespace Tests\Feature\Fiscal;

use App\Actions\InstitutionalReceipts\BuildInstitutionalReceiptSnapshotAction;
use App\Models\Area;
use App\Models\CashRegisterSession;
use App\Models\Category;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\InstitutionalReceiptSeries;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\ReceiptPrintProfile;
use App\Models\Service;
use App\Models\TaxRate;
use App\Models\User;
use Database\Seeders\ReceiptPrintProfileSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaxRateInvoiceSnapshotTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_issued_invoice_keeps_its_line_tax_rate_when_the_rate_changes(): void
    {
        $context = $this->billingContext();
        $service = $this->service($context['category'], $context['area'], 'Consulta', '100.00', $context['rate15']);

        $invoiceId = $this->actingAs($context['cashier'])
            ->postJson('/api/invoices', [
                'patient_name' => 'Paciente Historico',
                'items' => [['service_id' => $service->id, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->assertJsonPath('data.tax_amount', '15.00')
            ->assertJsonPath('data.items.0.tax_rate', '15.00')
            ->json('data.id');

        $this->actingAs($context['admin'])
            ->patchJson("/api/tax-rates/{$context['rate15']->id}", [
                'name' => 'ISV 18 %',
                'percentage' => 18,
                'active' => true,
                'is_default' => true,
                'reason' => 'El hospital actualizo su tasa vigente.',
            ])
            ->assertOk();

        $item = InvoiceItem::query()->where('invoice_id', $invoiceId)->sole();
        $invoice = Invoice::query()->findOrFail($invoiceId);
        $this->assertSame('15.00', $item->tax_rate);
        $this->assertSame(1500, $item->tax_amount_cents);
        $this->assertSame('15.00', (string) $invoice->tax_rate_snapshot);

        // New operations use the current percentage of the same catalog rate.
        $this->actingAs($context['cashier'])
            ->postJson('/api/invoices/preview', [
                'items' => [['service_id' => $service->id, 'quantity' => '1.00']],
            ])
            ->assertOk()
            ->assertJsonPath('data.items.0.tax_rate', '18.00')
            ->assertJsonPath('data.totals.tax_cents', 1800)
            ->assertJsonPath('data.tax_breakdown.0.rate', '18.00')
            ->assertJsonPath('data.tax_breakdown.0.base_cents', 10000)
            ->assertJsonPath('data.tax_breakdown.0.tax_cents', 1800)
            ->assertJsonPath('data.tax_breakdown.0.base_label', 'Gravado 18 %')
            ->assertJsonPath('data.tax_breakdown.0.tax_label', 'ISV 18 %');
    }

    public function test_receipt_snapshot_exposes_the_exact_tax_breakdown_shape(): void
    {
        $this->seed(ReceiptPrintProfileSeeder::class);
        $context = $this->billingContext();
        $invoice = $this->issuedMixedInvoice($context);
        $series = InstitutionalReceiptSeries::query()->create([
            'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
            'series' => 'REC-F2B',
            'prefix' => 'RF2',
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 0,
            'active' => true,
            'reprint_behavior' => InstitutionalReceiptSeries::REPRINT_AUDIT_ONLY,
            'void_behavior' => InstitutionalReceiptSeries::VOID_PERMISSION_REASON_AUDIT,
        ]);
        $profile = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_LETTER_PORTRAIT)
            ->firstOrFail();
        $session = CashRegisterSession::query()
            ->where('user_id', $context['cashier']->id)
            ->where('status', CashRegisterSession::STATUS_OPEN)
            ->firstOrFail();

        $snapshot = app(BuildInstitutionalReceiptSnapshotAction::class)->execute(
            $invoice,
            $series,
            $profile,
            $context['cashier'],
            $session,
            null,
            'RF2-00000001',
        );

        $breakdown = $snapshot['invoice_snapshot']['tax_breakdown'];
        $this->assertSame(
            ['rate', 'base_cents', 'tax_cents', 'base_label', 'tax_label'],
            array_keys($breakdown[0]),
        );
        $this->assertSame(['18.00', '15.00', '0.00'], array_column($breakdown, 'rate'));
        $this->assertSame(1000, $breakdown[0]['base_cents']);
        $this->assertSame(180, $breakdown[0]['tax_cents']);
        $this->assertSame('Gravado 18 %', $breakdown[0]['base_label']);
        $this->assertSame('ISV 18 %', $breakdown[0]['tax_label']);
        $this->assertSame(2000, $breakdown[1]['base_cents']);
        $this->assertSame(300, $breakdown[1]['tax_cents']);
        $this->assertSame(500, $breakdown[2]['base_cents']);
        $this->assertSame(0, $breakdown[2]['tax_cents']);
        $this->assertSame('Exento', $breakdown[2]['base_label']);
        $this->assertSame('Exento', $breakdown[2]['tax_label']);
        $this->assertSame($breakdown, $snapshot['institution_snapshot']['tax_breakdown']);
        $this->assertSame(480, array_sum(array_column($breakdown, 'tax_cents')));
    }

    /**
     * @return array{admin: User, cashier: User, category: Category, area: Area, rate15: TaxRate}
     */
    private function billingContext(): array
    {
        FiscalSetting::query()->create([
            'hospital_name' => 'Hospital Sintetico',
            'rtn' => '08011999000001',
            'default_tax_rate' => '15.00',
            'receipt_template_mode' => 'institutional',
            'receipt_paper_size' => 'half_letter',
        ]);
        FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => '000-001-01',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 0,
            'cai' => 'CAI-F2B-TEST',
            'valid_until' => now()->addYear()->toDateString(),
            'active' => true,
        ]);

        $admin = User::factory()->create();
        $admin->assignRole('admin');
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');
        CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => '500.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        $rate15 = TaxRate::query()->create([
            'name' => 'ISV 15 %',
            'percentage' => '15.00',
            'active' => true,
            'is_default' => true,
        ]);
        TaxRate::query()->create([
            'name' => 'ISV 18 %',
            'percentage' => '18.00',
            'active' => true,
            'is_default' => false,
        ]);

        return [
            'admin' => $admin->refresh(),
            'cashier' => $cashier->refresh(),
            'category' => Category::factory()->create(),
            'area' => Area::query()->create([
                'name' => 'Laboratorio',
                'slug' => 'laboratorio-'.uniqid(),
                'active' => true,
            ]),
            'rate15' => $rate15,
        ];
    }

    /**
     * @param  array{admin: User, cashier: User, category: Category, area: Area, rate15: TaxRate}  $context
     */
    private function service(
        Category $category,
        Area $area,
        string $name,
        string $price,
        ?TaxRate $rate,
    ): Service {
        return Service::factory()->create([
            'category_id' => $category->id,
            'area_id' => $area->id,
            'name' => $name,
            'slug' => str()->slug($name).'-'.uniqid(),
            'price' => $price,
            'taxable' => $rate !== null,
            'tax_rate_id' => $rate?->id,
        ]);
    }

    /**
     * @param  array{admin: User, cashier: User, category: Category, area: Area, rate15: TaxRate}  $context
     */
    private function issuedMixedInvoice(array $context): Invoice
    {
        $rate18 = TaxRate::query()->where('percentage', '18.00')->firstOrFail();
        $invoice = Invoice::query()->create([
            'invoice_number' => 'INV-F2B-00000001',
            'fiscal_sequence_id' => FiscalSequence::query()->value('id'),
            'cash_session_id' => CashRegisterSession::query()->value('id'),
            'hospital_name' => 'Hospital Sintetico',
            'hospital_rtn' => '08011999000001',
            'receipt_template_mode' => 'institutional',
            'receipt_paper_size' => 'half_letter',
            'tax_label' => 'ISV',
            'tax_rate_snapshot' => '15.00',
            'patient_name' => 'Paciente Mixto',
            'subtotal' => '35.00',
            'subtotal_cents' => 3500,
            'tax_amount' => '4.80',
            'tax_amount_cents' => 480,
            'discount_amount' => '0.00',
            'discount_amount_cents' => 0,
            'total' => '39.80',
            'total_cents' => 3980,
            'paid_amount' => '39.80',
            'paid_amount_cents' => 3980,
            'balance_due' => '0.00',
            'balance_due_cents' => 0,
            'status' => Invoice::STATUS_PAID,
            'issued_by' => $context['cashier']->id,
            'issued_at' => now(),
        ]);

        $lines = [
            ['Servicio 18', '10.00', 1000, '18.00', 180],
            ['Servicio 15', '20.00', 2000, '15.00', 300],
            ['Servicio exento', '5.00', 500, '0.00', 0],
        ];

        foreach ($lines as [$name, $price, $cents, $taxRate, $taxCents]) {
            InvoiceItem::query()->create([
                'invoice_id' => $invoice->id,
                'service_name' => $name,
                'category_name' => 'Laboratorio',
                'area_name' => 'Laboratorio',
                'quantity' => '1.00',
                'quantity_cents' => 100,
                'unit_price' => $price,
                'unit_price_cents' => $cents,
                'tax_rate' => $taxRate,
                'tax_amount' => number_format($taxCents / 100, 2, '.', ''),
                'tax_amount_cents' => $taxCents,
                'line_subtotal' => $price,
                'line_subtotal_cents' => $cents,
                'line_total' => number_format(($cents + $taxCents) / 100, 2, '.', ''),
                'line_total_cents' => $cents + $taxCents,
                'special_rule_applied' => false,
            ]);
        }

        return $invoice->fresh(['items']);
    }
}
