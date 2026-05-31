<?php

namespace Tests\Feature;

use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\Service;
use App\Models\ServiceArea;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvoiceCreationTest extends TestCase
{
    use RefreshDatabase;

    public function test_cashier_can_create_invoice_with_multiple_services_and_backend_totals(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $hemogram = Service::query()->where('name', 'Hemograma Completo')->firstOrFail();

        $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [
                    ['service_id' => $glucose->id, 'quantity' => '2.00'],
                    ['service_id' => $hemogram->id, 'quantity' => '1.00'],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('data.invoice_number', '000-001-01-00000001')
            ->assertJsonPath('data.patient_name', 'Maria Lopez')
            ->assertJsonPath('data.subtotal', '40.00')
            ->assertJsonPath('data.tax_amount', '6.00')
            ->assertJsonPath('data.discount_amount', '0.00')
            ->assertJsonPath('data.total', '46.00')
            ->assertJsonPath('data.paid_amount', '0.00')
            ->assertJsonPath('data.balance_due', '46.00')
            ->assertJsonPath('data.status', Invoice::STATUS_ISSUED)
            ->assertJsonCount(2, 'data.items');

        $this->assertDatabaseHas('invoices', [
            'invoice_number' => '000-001-01-00000001',
            'patient_name' => 'Maria Lopez',
            'issued_by' => $cashier->id,
            'status' => Invoice::STATUS_ISSUED,
            'paid_amount' => '0.00',
            'balance_due' => '46.00',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $cashier->id,
            'action' => 'invoice.issued',
            'entity_type' => Invoice::class,
        ]);
        $this->assertSame(1, FiscalSequence::query()->where('document_type', 'invoice')->firstOrFail()->current_number);
    }

    public function test_patient_name_is_required(): void
    {
        $this->seedBillingBase();

        $this->actingAs($this->cashier())
            ->postJson('/api/invoices', [
                'patient_name' => '',
                'items' => [$this->invoiceItem('Glucosa')],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('patient_name');
    }

    public function test_invoice_requires_open_cash_session(): void
    {
        $this->seedBillingBase();
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [$this->invoiceItem('Glucosa')],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cash_session_id');
    }

    public function test_invoice_requires_items(): void
    {
        $this->seedBillingBase();

        $this->actingAs($this->cashier())
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('items');
    }

    public function test_invoice_rejects_inactive_service(): void
    {
        $this->seedBillingBase();
        $service = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $service->forceFill(['active' => false])->save();

        $this->actingAs($this->cashier())
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [['service_id' => $service->id, 'quantity' => '1.00']],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('items.0.service_id');
    }

    public function test_invoice_rejects_missing_service(): void
    {
        $this->seedBillingBase();

        $this->actingAs($this->cashier())
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [['service_id' => 999999, 'quantity' => '1.00']],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('items.0.service_id');
    }

    public function test_invoice_rejects_non_positive_quantity(): void
    {
        $this->seedBillingBase();

        $this->actingAs($this->cashier())
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [$this->invoiceItem('Glucosa', '0.00')],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('items.0.quantity');
    }

    public function test_invoice_items_keep_snapshots_when_service_price_changes_later(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->json('data.id');

        $glucose->forceFill(['name' => 'Glucosa Editada', 'price' => '99.00'])->save();

        $this->actingAs($cashier)
            ->getJson("/api/invoices/{$invoiceId}")
            ->assertOk()
            ->assertJsonPath('data.items.0.service_name', 'Glucosa')
            ->assertJsonPath('data.items.0.category_name', 'Laboratorio')
            ->assertJsonPath('data.items.0.unit_price', '15.00')
            ->assertJsonPath('data.items.0.line_total', '17.25');
    }

    public function test_invoice_items_keep_service_area_snapshot_when_catalog_area_changes_later(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $laboratoryArea = ServiceArea::query()->where('slug', 'laboratorio')->firstOrFail();
        $rayosArea = ServiceArea::query()->where('slug', 'rayos-x')->firstOrFail();
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $glucose->forceFill(['area_id' => $laboratoryArea->id])->save();

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->assertJsonPath('data.items.0.service_area_name', 'Laboratorio')
            ->json('data.id');

        $glucose->forceFill(['area_id' => $rayosArea->id])->save();

        $this->actingAs($cashier)
            ->getJson("/api/invoices/{$invoiceId}")
            ->assertOk()
            ->assertJsonPath('data.items.0.service_name', 'Glucosa')
            ->assertJsonPath('data.items.0.service_area_name', 'Laboratorio')
            ->assertJsonPath('data.items.0.service_area_id', $laboratoryArea->id);
    }

    public function test_invoice_with_items_cannot_be_deleted_and_lose_fiscal_history(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [$this->invoiceItem('Glucosa')],
            ])
            ->assertCreated()
            ->json('data.id');

        $this->expectException(QueryException::class);

        try {
            Invoice::query()->findOrFail($invoiceId)->delete();
        } finally {
            $this->assertDatabaseHas('invoices', ['id' => $invoiceId]);
            $this->assertDatabaseHas('invoice_items', ['invoice_id' => $invoiceId]);
        }
    }

    public function test_erythropoietin_normal_is_charged_at_twenty_five(): void
    {
        $this->seedBillingBase();
        $erythropoietin = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();

        $this->actingAs($this->cashier())
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [['service_id' => $erythropoietin->id, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->assertJsonPath('data.items.0.unit_price', '25.00')
            ->assertJsonPath('data.items.0.special_rule_applied', false)
            ->assertJsonPath('data.total', '28.75');
    }

    public function test_erythropoietin_with_dialysis_prescription_is_free_and_snapshotted(): void
    {
        $this->seedBillingBase();
        $erythropoietin = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();

        $this->actingAs($this->cashier())
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [[
                    'service_id' => $erythropoietin->id,
                    'quantity' => '1.00',
                    'dialysis_prescription' => true,
                ]],
            ])
            ->assertCreated()
            ->assertJsonPath('data.items.0.unit_price', '0.00')
            ->assertJsonPath('data.items.0.special_rule_code', Service::ERYTHROPOIETIN_RULE)
            ->assertJsonPath('data.items.0.special_rule_applied', true)
            ->assertJsonPath('data.total', '0.00');
    }

    public function test_dialysis_prescription_does_not_discount_other_services(): void
    {
        $this->seedBillingBase();
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $this->actingAs($this->cashier())
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [[
                    'service_id' => $glucose->id,
                    'quantity' => '1.00',
                    'dialysis_prescription' => true,
                ]],
            ])
            ->assertCreated()
            ->assertJsonPath('data.items.0.unit_price', '15.00')
            ->assertJsonPath('data.items.0.special_rule_applied', false)
            ->assertJsonPath('data.total', '17.25');
    }

    public function test_invoice_requires_active_fiscal_sequence(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $this->createFiscalSettings();

        $this->actingAs($this->cashier())
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [$this->invoiceItem('Glucosa')],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('fiscal_sequence');
    }

    public function test_invoice_rejects_active_sequence_with_empty_cai(): void
    {
        $this->seedBillingBase(cai: '');

        $this->actingAs($this->cashier())
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [$this->invoiceItem('Glucosa')],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cai');
    }

    public function test_invoice_rejects_expired_fiscal_sequence(): void
    {
        $this->seedBillingBase(validUntil: now()->subDay()->toDateString());

        $this->actingAs($this->cashier())
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [$this->invoiceItem('Glucosa')],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('valid_until');
    }

    public function test_invoice_rejects_sequence_outside_range(): void
    {
        $this->seedBillingBase(currentNumber: 1, maxNumber: 1);

        $this->actingAs($this->cashier())
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [$this->invoiceItem('Glucosa')],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('current_number');
    }

    public function test_two_invoice_emissions_do_not_duplicate_invoice_number(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();

        $first = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [$this->invoiceItem('Glucosa')],
            ])
            ->assertCreated()
            ->json('data.invoice_number');

        $second = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Jose Perez',
                'items' => [$this->invoiceItem('Hemograma Completo')],
            ])
            ->assertCreated()
            ->json('data.invoice_number');

        $this->assertSame('000-001-01-00000001', $first);
        $this->assertSame('000-001-01-00000002', $second);
        $this->assertNotSame($first, $second);
        $this->assertSame(2, Invoice::query()->distinct('invoice_number')->count('invoice_number'));
    }

    public function test_user_without_invoice_create_permission_cannot_emit_invoice(): void
    {
        $this->seedBillingBase();
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [$this->invoiceItem('Glucosa')],
            ])
            ->assertForbidden();
    }

    public function test_invoice_show_requires_invoice_view_permission(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [$this->invoiceItem('Glucosa')],
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs(User::factory()->create())
            ->getJson("/api/invoices/{$invoiceId}")
            ->assertForbidden();

        $this->actingAs($cashier)
            ->getJson("/api/invoices/{$invoiceId}")
            ->assertOk()
            ->assertJsonPath('data.invoice_number', '000-001-01-00000001');
    }

    private function seedBillingBase(
        string $cai = 'TEST-CAI',
        ?string $validUntil = null,
        int $currentNumber = 0,
        int $maxNumber = 99999999,
    ): void {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $this->createFiscalSettings();
        FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => '000-001-01',
            'min_number' => 1,
            'max_number' => $maxNumber,
            'current_number' => $currentNumber,
            'cai' => $cai,
            'valid_until' => $validUntil ?? now()->addYear()->toDateString(),
            'active' => true,
        ]);
    }

    private function createFiscalSettings(): void
    {
        FiscalSetting::query()->create([
            'hospital_name' => 'Hospital Demo',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'receipt_width' => '80mm',
        ]);
    }

    /**
     * @return array{service_id: int, quantity: string}
     */
    private function invoiceItem(string $serviceName, string $quantity = '1.00'): array
    {
        return [
            'service_id' => Service::query()->where('name', $serviceName)->firstOrFail()->id,
            'quantity' => $quantity,
        ];
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

        return $cashier;
    }
}
