<?php

namespace Tests\Feature;

use App\Actions\Billing\CreateInvoiceAction;
use App\Models\Area;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\ReceiptPrintProfile;
use App\Models\Service;
use App\Models\ServiceArea;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use LogicException;
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
            'paid_amount_cents' => 0,
            'balance_due' => '46.00',
            'balance_due_cents' => 4600,
            'subtotal_cents' => 4000,
            'tax_amount_cents' => 600,
            'discount_amount_cents' => 0,
            'total_cents' => 4600,
        ]);
        $this->assertDatabaseHas('invoice_items', [
            'invoice_id' => Invoice::query()->where('invoice_number', '000-001-01-00000001')->value('id'),
            'quantity_cents' => 200,
            'unit_price_cents' => 1500,
            'line_subtotal_cents' => 3000,
            'tax_amount_cents' => 450,
            'line_total_cents' => 3450,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $cashier->id,
            'action' => 'invoice.issued',
            'entity_type' => Invoice::class,
        ]);
        $this->assertSame(1, FiscalSequence::query()->where('document_type', 'invoice')->firstOrFail()->current_number);
    }

    public function test_invoice_receipt_paper_size_uses_resolved_print_profile(): void
    {
        $this->seedBillingBase();

        ReceiptPrintProfile::query()->create([
            'code' => ReceiptPrintProfile::CODE_A5,
            'name' => 'A5 horizontal',
            'paper_kind' => 'a5_landscape',
            'width_mm' => '210.00',
            'height_mm' => '148.00',
            'margin_top_mm' => '6.00',
            'margin_right_mm' => '6.00',
            'margin_bottom_mm' => '6.00',
            'margin_left_mm' => '6.00',
            'orientation' => 'landscape',
            'template_code' => 'institutional_classic',
            'font_family' => 'Arial, sans-serif',
            'font_scale' => '1.00',
            'copies_mode' => 'original_only',
            'show_copy_legend' => true,
            'show_physical_seal_space' => true,
            'use_logo' => false,
            'show_technical_fields' => false,
            'active' => true,
            'is_global_default' => true,
        ]);

        $cashier = $this->cashier();

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Paciente Perfil A5',
                'items' => [$this->invoiceItem('Glucosa')],
            ])
            ->assertCreated()
            ->json('data.id');

        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'receipt_paper_size' => 'a5',
        ]);
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

    public function test_patient_name_cannot_be_only_whitespace(): void
    {
        $this->seedBillingBase();

        $this->actingAs($this->cashier())
            ->postJson('/api/invoices', [
                'patient_name' => '   ',
                'items' => [$this->invoiceItem('Glucosa')],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('patient_name');
    }

    public function test_patient_name_above_180_chars_is_rejected(): void
    {
        $this->seedBillingBase();

        $this->actingAs($this->cashier())
            ->postJson('/api/invoices', [
                'patient_name' => str_repeat('A', 181),
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

    public function test_invoice_rejects_after_own_cash_session_is_closed(): void
    {
        $this->seedBillingBase();
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        $sessionId = $this->actingAs($cashier)
            ->postJson('/api/cash-sessions/open', [
                'opening_amount' => '100.00',
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$sessionId}/close", [
                'closing_amount' => '100.00',
            ])
            ->assertOk();

        $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [$this->invoiceItem('Glucosa')],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cash_session_id');

        $this->assertSame(0, Invoice::query()->count());
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

    public function test_invoice_rejects_hidden_or_non_billable_services(): void
    {
        $this->seedBillingBase();
        $hidden = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $nonBillable = Service::query()->where('name', 'Hemograma Completo')->firstOrFail();
        $hidden->forceFill(['visible_in_billing' => false])->save();
        $nonBillable->forceFill(['is_billable' => false])->save();

        $this->actingAs($this->cashier())
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [['service_id' => $hidden->id, 'quantity' => '1.00']],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('items.0.service_id');

        $this->actingAs($this->cashier())
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [['service_id' => $nonBillable->id, 'quantity' => '1.00']],
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
            ->assertJsonPath('data.items.0.area_name', 'Laboratorio')
            ->assertJsonPath('data.items.0.unit_price', '15.00')
            ->assertJsonPath('data.items.0.line_total', '17.25');
    }

    public function test_invoice_item_notes_are_trimmed_and_blank_notes_are_not_snapshotted(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $hemogram = Service::query()->where('name', 'Hemograma Completo')->firstOrFail();

        $invoice = app(CreateInvoiceAction::class)->execute([
            'patient_name' => 'Maria Lopez',
            'items' => [
                ['service_id' => $glucose->id, 'quantity' => '1.00', 'notes' => '  En ayunas  '],
                ['service_id' => $hemogram->id, 'quantity' => '1.00', 'notes' => '   '],
            ],
        ], $cashier);

        $notes = DB::table('invoice_items')
            ->where('invoice_id', $invoice->id)
            ->orderBy('id')
            ->pluck('notes')
            ->all();

        $this->assertSame(['En ayunas', null], $notes);
    }

    public function test_invoice_items_do_not_snapshot_scanner_or_barcode_codes(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $glucose->forceFill([
            'scan_code' => 'SCAN-GLU-001',
            'barcode' => 'BAR-GLU-001',
            'qr_code' => 'QR-GLU-001',
        ])->save();

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->json('data.id');

        $this->assertDatabaseHas('invoice_items', [
            'invoice_id' => $invoiceId,
            'service_name' => 'Glucosa',
            'scan_code' => null,
            'barcode' => null,
            'qr_code' => null,
        ]);
    }

    public function test_invoice_items_keep_service_area_snapshot_when_catalog_area_changes_later(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $laboratoryArea = Area::query()->where('slug', 'laboratorio')->firstOrFail();
        $rayosArea = Area::query()->where('slug', 'rayos-x')->firstOrFail();
        $laboratoryServiceArea = ServiceArea::query()->where('slug', 'laboratorio')->firstOrFail();
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
            ->assertJsonPath('data.items.0.service_area_id', $laboratoryServiceArea->id);
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

        $this->expectException(LogicException::class);
        $this->expectExceptionMessage('Las facturas no se eliminan; deben anularse con motivo y auditoria.');

        try {
            Invoice::query()->findOrFail($invoiceId)->delete();
        } finally {
            $this->assertDatabaseHas('invoices', ['id' => $invoiceId]);
            $this->assertDatabaseHas('invoice_items', ['invoice_id' => $invoiceId]);
        }
    }

    public function test_invoice_cannot_be_deleted_even_if_items_were_removed_first(): void
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

        DB::table('invoice_items')->where('invoice_id', $invoiceId)->delete();

        $this->expectException(LogicException::class);
        $this->expectExceptionMessage('Las facturas no se eliminan; deben anularse con motivo y auditoria.');

        try {
            Invoice::query()->findOrFail($invoiceId)->delete();
        } finally {
            $this->assertDatabaseHas('invoices', ['id' => $invoiceId]);
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
        $cashier = $this->cashier();
        // BUG-SEC-04: simulate the patient being pre-marked as
        // dialysis-prescribed by clinical staff; in production the cashier
        // would not have this permission. Granted here per-user so the
        // broader security invariant (cajero role lacks the permission) is
        // preserved for InvoiceDialysisPrescriptionTest.
        $cashier->givePermissionTo('patients.mark_dialysis_prescription');

        $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'dialysis_prescription' => true,
                'items' => [[
                    'service_id' => $erythropoietin->id,
                    'quantity' => '1.00',
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

    public function test_repeated_invoice_submit_with_same_idempotency_key_returns_original_invoice(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $payload = [
            'patient_name' => 'Maria Lopez',
            'items' => [$this->invoiceItem('Glucosa')],
        ];

        $first = $this->actingAs($cashier)
            ->withHeaders(['Idempotency-Key' => 'invoice-key-1'])
            ->postJson('/api/invoices', $payload)
            ->assertCreated()
            ->json('data');

        $second = $this->actingAs($cashier)
            ->withHeaders(['Idempotency-Key' => 'invoice-key-1'])
            ->postJson('/api/invoices', $payload)
            ->assertCreated()
            ->json('data');

        $this->assertSame($first['id'], $second['id']);
        $this->assertSame('000-001-01-00000001', $second['invoice_number']);
        $this->assertSame(1, Invoice::query()->count());
    }

    public function test_reused_invoice_idempotency_key_with_different_payload_returns_conflict(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();

        $this->actingAs($cashier)
            ->withHeaders(['Idempotency-Key' => 'invoice-key-conflict'])
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [$this->invoiceItem('Glucosa')],
            ])
            ->assertCreated();

        $this->actingAs($cashier)
            ->withHeaders(['Idempotency-Key' => 'invoice-key-conflict'])
            ->postJson('/api/invoices', [
                'patient_name' => 'Jose Perez',
                'items' => [$this->invoiceItem('Glucosa')],
            ])
            ->assertConflict();

        $this->assertSame(1, Invoice::query()->count());
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
            'receipt_template_mode' => 'thermal',
            'hospital_name' => 'Hospital San Isidro',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'receipt_paper_size' => 'half_letter',
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

        return $cashier->refresh();
    }

    public function test_duplicate_invoice_with_same_idempotency_key_creates_one_invoice(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $idempotencyKey = 'invoice-test-idem-'.uniqid();
        $payload = [
            'patient_name' => 'Paciente Idempotente',
            'items' => [
                ['service_id' => $glucose->id, 'quantity' => 1],
            ],
        ];

        $headers = [
            'Idempotency-Key' => $idempotencyKey,
            'Accept' => 'application/json',
        ];

        $first = $this->actingAs($cashier)
            ->postJson('/api/invoices', $payload, $headers)
            ->assertCreated();

        $second = $this->actingAs($cashier)
            ->postJson('/api/invoices', $payload, $headers);

        $second->assertCreated();
        $second->assertJsonPath('data.id', $first->json('data.id'));

        $this->assertSame(1, Invoice::query()->where('patient_name', 'Paciente Idempotente')->count());
    }

    public function test_invoice_without_idempotency_key_still_creates_unique_invoice(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $payload = [
            'patient_name' => 'Paciente Sin Key',
            'items' => [
                ['service_id' => $glucose->id, 'quantity' => 1],
            ],
        ];

        $this->actingAs($cashier)->postJson('/api/invoices', $payload)->assertCreated();
        $this->actingAs($cashier)->postJson('/api/invoices', $payload)->assertCreated();

        $this->assertSame(2, Invoice::query()->where('patient_name', 'Paciente Sin Key')->count());
    }
}
