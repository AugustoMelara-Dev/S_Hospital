<?php

namespace Tests\Feature;

use App\Actions\Billing\CreateInvoiceAction;
use App\Actions\Billing\VoidInvoiceAction;
use App\Actions\Cash\OpenCashSessionAction;
use App\Actions\Receipts\ReprintReceiptAction;
use App\Models\AuditLog;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptSeries;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\ReceiptPrintProfile;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\ReceiptPrintProfileSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class InvoiceHistoryReprintVoidTest extends TestCase
{
    use RefreshDatabase;

    public function test_invoice_history_is_paginated_filtered_and_recent_first(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $cashier = $this->cashier();
        $firstId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');
        $secondId = $this->createInvoice($cashier, 'Jose Perez', 'Hemograma Completo');

        Invoice::query()->whereKey($firstId)->update([
            'issued_at' => now()->subDay(),
            'status' => Invoice::STATUS_VOID,
            'void_reason' => 'Error de captura',
            'voided_by' => $admin->id,
            'voided_at' => now()->subDay(),
        ]);
        Invoice::query()->whereKey($secondId)->update(['issued_at' => now()]);

        $this->actingAs($admin)
            ->getJson('/api/invoices?date_from='.now()->subDays(2)->toDateString().'&patient=Maria&status=void')
            ->assertOk()
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.patient_name', 'Maria Lopez')
            ->assertJsonPath('data.0.status', Invoice::STATUS_VOID);

        $this->actingAs($admin)
            ->getJson('/api/invoices?date_from='.now()->subDays(2)->toDateString().'&invoice_number=00000002')
            ->assertOk()
            ->assertJsonPath('data.0.id', $secondId);
    }

    public function test_cashier_sees_only_own_invoices_from_current_day_by_default(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $otherCashier = $this->cashier();
        $ownTodayId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');
        $ownOldId = $this->createInvoice($cashier, 'Old Patient', 'Hemograma Completo');
        $otherTodayId = $this->createInvoice($otherCashier, 'Other Patient', 'Eritropoyetina');

        Invoice::query()->whereKey($ownOldId)->update(['issued_at' => now()->subDay()]);

        $response = $this->actingAs($cashier)
            ->getJson('/api/invoices?date_from='.now()->subDays(5)->toDateString().'&user_id='.$otherCashier->id)
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        $ids = collect($response->json('data'))->pluck('id');
        $this->assertTrue($ids->contains($ownTodayId));
        $this->assertFalse($ids->contains($ownOldId));
        $this->assertFalse($ids->contains($otherTodayId));
    }

    public function test_reports_view_does_not_grant_historical_invoice_access(): void
    {
        $this->seedBillingBase();
        $user = User::factory()->create();
        $user->givePermissionTo('invoices.view', 'invoices.create', 'reports.view');
        $otherCashier = $this->cashier();
        $oldId = $this->createInvoice($user, 'Own Old Patient', 'Glucosa');
        $otherTodayId = $this->createInvoice($otherCashier, 'Other Today', 'Hemograma Completo');

        Invoice::query()->whereKey($oldId)->update(['issued_at' => now()->subDay()]);

        $response = $this->actingAs($user)
            ->getJson('/api/invoices?date_from='.now()->subDays(5)->toDateString().'&user_id='.$otherCashier->id)
            ->assertOk()
            ->assertJsonPath('meta.total', 0);

        $ids = collect($response->json('data'))->pluck('id');
        $this->assertFalse($ids->contains($oldId));
        $this->assertFalse($ids->contains($otherTodayId));

        $this->actingAs($user)
            ->getJson("/api/invoices/{$otherTodayId}")
            ->assertForbidden();
    }

    public function test_invoice_void_permission_does_not_grant_historical_invoice_read_scope(): void
    {
        $this->seedBillingBase();
        $voidUser = User::factory()->create();
        $voidUser->givePermissionTo('invoices.view', 'invoices.void');
        $otherCashier = $this->cashier();
        $otherInvoiceId = $this->createInvoice($otherCashier, 'Other Patient', 'Hemograma Completo');

        $response = $this->actingAs($voidUser)
            ->getJson('/api/invoices?date_from='.now()->subDays(5)->toDateString().'&patient=Other')
            ->assertOk()
            ->assertJsonPath('meta.total', 0);

        $ids = collect($response->json('data'))->pluck('id');
        $this->assertFalse($ids->contains($otherInvoiceId));

        $this->actingAs($voidUser)
            ->getJson("/api/invoices/{$otherInvoiceId}")
            ->assertForbidden();
    }

    public function test_supervisor_and_admin_can_view_historical_invoices(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $oldId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');
        Invoice::query()->whereKey($oldId)->update(['issued_at' => now()->subDays(3)]);

        $this->actingAs($this->supervisor())
            ->getJson('/api/invoices?date_from='.now()->subDays(5)->toDateString().'&date_to='.now()->toDateString())
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $oldId);

        $this->actingAs($this->admin())
            ->getJson('/api/invoices?date_from='.now()->subDays(5)->toDateString().'&user_id='.$cashier->id)
            ->assertOk()
            ->assertJsonPath('meta.total', 1);
    }

    public function test_authorized_history_without_date_filters_returns_recent_invoices_across_days(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $oldId = $this->createInvoice($cashier, 'Paciente Anterior', 'Glucosa');
        $todayId = $this->createInvoice($cashier, 'Paciente Actual', 'Hemograma Completo');

        Invoice::query()->whereKey($oldId)->update(['issued_at' => now()->subDays(3)]);

        $response = $this->actingAs($this->admin())
            ->getJson('/api/invoices?per_page=5')
            ->assertOk()
            ->assertJsonPath('meta.total', 2);

        $this->assertSame([$todayId, $oldId], collect($response->json('data'))->pluck('id')->all());
    }

    public function test_invoice_detail_includes_snapshots_payments_cash_session_status_without_fiscal_sequence_relation(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated();

        $this->actingAs($cashier)
            ->getJson("/api/invoices/{$invoiceId}")
            ->assertOk()
            ->assertJsonPath('data.items.0.service_name', 'Glucosa')
            ->assertJsonPath('data.payments.0.amount', '17.25')
            ->assertJsonPath('data.cash_session.id', $sessionId)
            ->assertJsonPath('data.status', Invoice::STATUS_PAID)
            ->assertJsonPath('data.fiscal_cai', 'REAL-CAI-2026')
            ->assertJsonMissingPath('data.fiscal_sequence');
    }

    public function test_reprint_uses_snapshots_and_writes_audit_log(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');
        Service::query()->where('name', 'Glucosa')->update(['name' => 'Glucosa Cambiada', 'price' => '99.00']);

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/reprint", [
                'width' => 'half_letter',
                'reason' => 'Copia para paciente',
            ])
            ->assertOk()
            ->assertJsonPath('data.receipt.width', 'half_letter')
            ->assertJsonPath('data.receipt.items.0.service_name', 'Glucosa')
            ->assertJsonPath('data.receipt.items.0.unit_price', '15.00')
            ->assertJsonPath('data.receipt.institutional.copy_label', 'REIMPRESIÓN #1')
            ->assertJsonPath('data.receipt.legacy_reprint_count', 1)
            ->assertJsonPath('data.audit.action', 'invoice.reprinted')
            ->assertJsonPath('data.audit.legacy_reprint_count', 1);

        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'legacy_reprint_count' => 1,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $cashier->id,
            'action' => 'invoice.reprinted',
            'entity_type' => Invoice::class,
            'entity_id' => $invoiceId,
        ]);
    }

    public function test_legacy_reprint_action_increments_the_durable_counter_and_keeps_the_snapshot(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $invoice = Invoice::query()->findOrFail($this->createInvoice($cashier, 'Maria Lopez', 'Glucosa'));
        Service::query()->where('name', 'Glucosa')->update(['name' => 'Glucosa Cambiada', 'price' => '99.00']);

        $first = app(ReprintReceiptAction::class)->execute($invoice, $cashier, 'half_letter', 'Primera copia solicitada');
        $second = app(ReprintReceiptAction::class)->execute($invoice->fresh(), $cashier, 'half_letter', 'Segunda copia solicitada');

        $this->assertSame('REIMPRESIÓN #1', $first['receipt']['institutional']['copy_label']);
        $this->assertSame('REIMPRESIÓN #2', $second['receipt']['institutional']['copy_label']);
        $this->assertSame(1, $first['receipt']['legacy_reprint_count']);
        $this->assertSame(2, $second['receipt']['legacy_reprint_count']);
        $this->assertSame(1, $first['audit']['legacy_reprint_count']);
        $this->assertSame(2, $second['audit']['legacy_reprint_count']);

        // Snapshot financiero intacto: el catalogo cambio y el recibo no.
        $this->assertSame('Glucosa', $second['receipt']['items'][0]['service_name']);
        $this->assertSame('15.00', $second['receipt']['items'][0]['unit_price']);
        $this->assertSame('17.25', $second['receipt']['invoice']['total']);
        $this->assertSame('0.00', $second['receipt']['invoice']['paid_amount']);
        $this->assertSame('17.25', $second['receipt']['invoice']['balance_due']);

        $this->assertDatabaseHas('invoices', [
            'id' => $invoice->id,
            'legacy_reprint_count' => 2,
            'subtotal' => '15.00',
            'total' => '17.25',
        ]);
    }

    public function test_legacy_reprint_preserves_the_invoice_issued_at(): void
    {
        // M-W2-RCP-04: en MariaDB con explicit_defaults_for_timestamp=0 el UPDATE
        // de legacy_reprint_count reescribia issued_at; la accion ahora lo restaura.
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $invoice = Invoice::query()->findOrFail($this->createInvoice($cashier, 'Maria Lopez', 'Glucosa'));

        $issuedAt = now()->subDays(30)->startOfSecond()->format('Y-m-d H:i:s');
        Invoice::query()->whereKey($invoice->id)->update(['issued_at' => $issuedAt]);

        app(ReprintReceiptAction::class)->execute(
            $invoice->fresh(),
            $cashier,
            'half_letter',
            'Copia solicitada por el paciente',
        );

        $fresh = Invoice::query()->findOrFail($invoice->id);
        $this->assertSame(1, (int) $fresh->legacy_reprint_count);
        $this->assertSame(
            $issuedAt,
            (string) DB::table('invoices')->where('id', $invoice->id)->value('issued_at'),
            'Legacy reprint must not rewrite invoices.issued_at',
        );
    }

    public function test_sqlite_driver_does_not_reproduce_the_implicit_issued_at_rewrite(): void
    {
        if (DB::connection()->getDriverName() !== 'sqlite') {
            $this->markTestSkipped('Control de driver: el defecto real solo ocurre en MariaDB.');
        }

        $this->seedBillingBase();
        $cashier = $this->cashier();
        $invoice = Invoice::query()->findOrFail($this->createInvoice($cashier, 'Maria Lopez', 'Glucosa'));

        $issuedAt = now()->subDays(30)->startOfSecond()->format('Y-m-d H:i:s');
        Invoice::query()->whereKey($invoice->id)->update(['issued_at' => $issuedAt]);

        // UPDATE sin asignar issued_at: SQLite lo conserva (no hay ON UPDATE
        // implicito), por eso la prueba con poder es la de MariaDB.
        DB::table('invoices')->where('id', $invoice->id)->update(['legacy_reprint_count' => 7]);

        $this->assertSame(
            $issuedAt,
            (string) DB::table('invoices')->where('id', $invoice->id)->value('issued_at'),
            'SQLite has no implicit ON UPDATE; the MariaDB probe is the meaningful red test',
        );
    }

    public function test_reprint_uses_invoice_fiscal_snapshot_after_settings_change(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');

        FiscalSetting::query()->firstOrFail()->update([
            'hospital_name' => 'Hospital Cambiado',
            'rtn' => '99999999999999',
        ]);
        FiscalSequence::query()->where('document_type', 'invoice')->update([
            'prefix' => '999-999-99',
            'min_number' => 50,
            'max_number' => 60,
            'cai' => 'CAI-CAMBIADO',
            'valid_until' => now()->addYears(2)->toDateString(),
        ]);

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/reprint", [
                'width' => 'letter',
                'reason' => 'Copia solicitada por paciente',
            ])
            ->assertOk()
            ->assertJsonPath('data.receipt.hospital.name', 'S_Hospital')
            ->assertJsonPath('data.receipt.hospital.rtn', '08011999123456')
            ->assertJsonPath('data.receipt.fiscal.cai', 'REAL-CAI-2026')
            ->assertJsonPath('data.receipt.fiscal.authorized_range', '000-001-01-00000001 a 000-001-01-99999999')
            ->assertJsonPath('data.receipt.fiscal.valid_until', now()->addYear()->toDateString());
    }

    public function test_reprint_excludes_voided_payments_after_reversal(): void
    {
        $this->seedBillingBase();
        FiscalSetting::query()->update(['partial_payments_enabled' => true]);
        $cashier = $this->cashier();
        $supervisor = $this->supervisor();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');

        $cashPaymentId = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '10.00',
            ])
            ->assertCreated()
            ->json('data.payment.id');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_TRANSFER,
                'amount' => '7.25',
                'reference' => 'TRX-REPRINT-1',
            ])
            ->assertCreated()
            ->assertJsonPath('data.invoice.status', Invoice::STATUS_PAID);

        $this->actingAs($supervisor)
            ->postJson("/api/invoices/{$invoiceId}/payments/{$cashPaymentId}/void", [
                'reason' => 'Correccion antes de reimpresion',
            ])
            ->assertOk()
            ->assertJsonPath('data.invoice.status', Invoice::STATUS_PARTIAL);

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/reprint", [
                'width' => 'half_letter',
                'reason' => 'Copia con pago corregido',
            ])
            ->assertOk()
            ->assertJsonPath('data.audit.action', 'invoice.reprinted')
            ->assertJsonPath('data.receipt.invoice.status', Invoice::STATUS_PARTIAL)
            ->assertJsonPath('data.receipt.invoice.paid_amount', '7.25')
            ->assertJsonPath('data.receipt.invoice.balance_due', '10.00')
            ->assertJsonCount(1, 'data.receipt.payments')
            ->assertJsonPath('data.receipt.payments.0.method', Payment::METHOD_TRANSFER)
            ->assertJsonPath('data.receipt.payments.0.amount', '7.25')
            ->assertJsonPath('data.receipt.payments.0.reference', 'TRX-REPRINT-1');
    }

    public function test_cashier_cannot_reprint_other_or_old_invoice_without_reprint_any(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $otherCashier = $this->cashier();
        $ownOldId = $this->createInvoice($cashier, 'Old Patient', 'Glucosa');
        $otherId = $this->createInvoice($otherCashier, 'Other Patient', 'Hemograma Completo');
        Invoice::query()->whereKey($ownOldId)->update(['issued_at' => now()->subDay()]);

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$otherId}/reprint", [
                'width' => 'letter',
                'reason' => 'Validacion de permisos',
            ])
            ->assertForbidden();

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$ownOldId}/reprint", [
                'width' => 'letter',
                'reason' => 'Validacion de permisos',
            ])
            ->assertForbidden();
    }

    public function test_supervisor_and_admin_can_reprint_with_permission(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $oldId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');
        Invoice::query()->whereKey($oldId)->update(['issued_at' => now()->subDays(2)]);

        $this->actingAs($this->supervisor())
            ->postJson("/api/invoices/{$oldId}/reprint", [
                'width' => 'letter',
                'reason' => 'Copia autorizada por supervisor',
            ])
            ->assertOk();

        $this->actingAs($this->admin())
            ->postJson("/api/invoices/{$oldId}/reprint", [
                'width' => 'a5',
                'reason' => 'Copia autorizada por administrador',
            ])
            ->assertOk();

        $this->actingAs($this->admin())
            ->postJson("/api/invoices/{$oldId}/reprint", [
                'width' => '80mm',
                'reason' => 'Copia termica de auditoria',
            ])
            ->assertOk()
            ->assertJsonPath('data.receipt.width', '80mm');

        $this->actingAs($this->admin())
            ->postJson("/api/invoices/{$oldId}/reprint", [
                'width' => '58mm',
                'reason' => 'Copia termica compacta',
            ])
            ->assertOk()
            ->assertJsonPath('data.receipt.width', '58mm');

        $this->actingAs($this->admin())
            ->postJson("/api/invoices/{$oldId}/reprint", [
                'width' => 'ticket-roll',
                'reason' => 'Validacion de ancho invalido',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('width');
    }

    public function test_invoice_void_permission_does_not_grant_unrelated_receipt_access(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $voidOnlyUser = User::factory()->create();
        $voidOnlyUser->givePermissionTo(['receipts.view', 'invoices.void']);
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');

        $this->actingAs($voidOnlyUser)
            ->getJson("/api/invoices/{$invoiceId}/receipt?width=half_letter")
            ->assertForbidden();
    }

    public function test_invoice_void_permission_does_not_grant_unrelated_institutional_receipt_pdf_access(): void
    {
        $this->seedBillingBase();
        $this->seed(ReceiptPrintProfileSeeder::class);
        $cashier = $this->cashier();
        $voidOnlyUser = User::factory()->create();
        $voidOnlyUser->givePermissionTo(['receipts.view', 'invoices.void']);
        $invoice = Invoice::query()->findOrFail($this->createInvoice($cashier, 'Maria Lopez', 'Glucosa'));
        $series = InstitutionalReceiptSeries::query()->create([
            'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
            'series' => 'REC-A',
            'prefix' => 'RA',
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'max_number' => 100,
            'current_number' => 1,
            'active' => true,
        ]);
        $profile = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)
            ->firstOrFail();
        $receipt = InstitutionalReceipt::query()->create([
            'invoice_id' => $invoice->id,
            'payment_id' => null,
            'cash_session_id' => CashRegisterSession::query()->where('user_id', $cashier->id)->firstOrFail()->id,
            'series_id' => $series->id,
            'receipt_number' => 1,
            'receipt_number_full' => 'REC-A-00000001',
            'status' => InstitutionalReceipt::STATUS_ISSUED,
            'amount' => $invoice->total,
            'amount_cents' => 1725,
            'issued_at' => now()->subDay(),
            'issued_by' => $cashier->id,
            'payer_name' => $invoice->patient_name,
            'concept' => 'Servicios hospitalarios',
            'amount_words' => 'DIECISIETE LEMPIRAS CON 25/100 CENTAVOS',
            'template_code' => 'institutional_classic',
            'print_profile_code' => $profile->code,
            'copy_mode' => 'original_only',
            'institution_snapshot' => ['hospital_name' => 'Hospital San Isidro'],
            'series_snapshot' => ['series' => 'REC-A'],
            'profile_snapshot' => ['code' => $profile->code, 'paper_kind' => $profile->paper_kind],
            'invoice_snapshot' => ['id' => $invoice->id],
            'payment_snapshot' => null,
            'items_snapshot' => [],
        ]);

        $this->actingAs($voidOnlyUser)
            ->get("/api/institutional-receipts/{$receipt->id}/pdf")
            ->assertForbidden();
    }

    public function test_void_requires_permission_and_reason(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/void", ['reason' => 'Error de captura'])
            ->assertForbidden();

        $this->actingAs($this->supervisor())
            ->postJson("/api/invoices/{$invoiceId}/void", ['reason' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reason');

        $this->actingAs($this->supervisor())
            ->postJson("/api/invoices/{$invoiceId}/void", ['reason' => '   '])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reason');
    }

    public function test_void_action_rejects_short_reason_before_mutating_invoice(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $supervisor = $this->supervisor();
        $invoice = Invoice::query()->findOrFail($this->createInvoice($cashier, 'Maria Lopez', 'Glucosa'));

        try {
            app(VoidInvoiceAction::class)->execute($invoice, $supervisor, 'abc');
            $this->fail('Expected short void reason to be rejected.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('reason', $exception->errors());
        }

        $this->assertDatabaseHas('invoices', [
            'id' => $invoice->id,
            'status' => Invoice::STATUS_ISSUED,
            'void_reason' => null,
            'voided_by' => null,
            'voided_at' => null,
        ]);
    }

    public function test_reprint_any_permission_does_not_grant_invoice_void_operation_scope(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $reprintUser = User::factory()->create();
        $reprintUser->givePermissionTo(['invoices.void', 'receipts.reprint_any']);
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');

        $this->actingAs($reprintUser)
            ->postJson("/api/invoices/{$invoiceId}/void", [
                'reason' => 'Intento sin alcance operativo',
            ])
            ->assertForbidden();

        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'status' => Invoice::STATUS_ISSUED,
            'voided_by' => null,
            'voided_at' => null,
        ]);
    }

    public function test_void_marks_invoice_and_does_not_delete_items(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $supervisor = $this->supervisor();
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');
        $itemCount = Invoice::query()->findOrFail($invoiceId)->items()->count();

        $this->actingAs($supervisor)
            ->postJson("/api/invoices/{$invoiceId}/void", ['reason' => 'Paciente solicito correccion'])
            ->assertOk()
            ->assertJsonPath('data.status', Invoice::STATUS_VOID)
            ->assertJsonPath('data.void_reason', 'Paciente solicito correccion')
            ->assertJsonPath('data.voided_by.id', $supervisor->id);

        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'status' => Invoice::STATUS_VOID,
            'void_reason' => 'Paciente solicito correccion',
            'voided_by' => $supervisor->id,
        ]);
        $this->assertSame($itemCount, Invoice::query()->findOrFail($invoiceId)->items()->count());
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $supervisor->id,
            'action' => 'invoice.voided',
            'entity_type' => Invoice::class,
            'entity_id' => $invoiceId,
        ]);
    }

    public function test_void_paid_invoice_is_blocked_and_does_not_delete_payments_or_items(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');
        $itemCount = Invoice::query()->findOrFail($invoiceId)->items()->count();

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated();

        $this->actingAs($this->supervisor())
            ->postJson("/api/invoices/{$invoiceId}/void", ['reason' => 'Intento con pago'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('invoice')
            ->assertJsonPath(
                'errors.invoice.0',
                'No se puede anular una factura con pagos registrados sin flujo de reversión.',
            );

        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'status' => Invoice::STATUS_PAID,
        ]);
        $this->assertSame(1, Payment::query()->where('invoice_id', $invoiceId)->count());
        $this->assertSame($itemCount, Invoice::query()->findOrFail($invoiceId)->items()->count());
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'invoice.void_blocked_paid',
            'entity_type' => Invoice::class,
            'entity_id' => $invoiceId,
        ]);

        $audit = AuditLog::query()
            ->where('action', 'invoice.void_blocked_paid')
            ->where('entity_id', $invoiceId)
            ->firstOrFail();
        $this->assertSame(
            'No se puede anular una factura con pagos registrados sin flujo de reversión.',
            $audit->new_values['message'] ?? null,
        );
    }

    public function test_void_invoice_is_allowed_after_all_payments_are_reversed(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $supervisor = $this->supervisor();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');

        $paymentId = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated()
            ->json('data.payment.id');

        $this->actingAs($supervisor)
            ->postJson("/api/invoices/{$invoiceId}/payments/{$paymentId}/void", [
                'reason' => 'Pago reversado antes de anular factura',
            ])
            ->assertOk()
            ->assertJsonPath('data.invoice.status', Invoice::STATUS_ISSUED)
            ->assertJsonPath('data.invoice.paid_amount', '0.00')
            ->assertJsonPath('data.invoice.balance_due', '17.25');

        $this->actingAs($supervisor)
            ->postJson("/api/invoices/{$invoiceId}/void", [
                'reason' => 'Factura emitida por error y sin cobros vigentes',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', Invoice::STATUS_VOID)
            ->assertJsonPath('data.void_reason', 'Factura emitida por error y sin cobros vigentes')
            ->assertJsonPath('data.payments.0.status', Payment::STATUS_VOID);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $supervisor->id,
            'action' => 'invoice.voided',
            'entity_type' => Invoice::class,
            'entity_id' => $invoiceId,
        ]);
    }

    public function test_void_revalidates_payment_state_inside_transaction_before_marking_void(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');

        Payment::query()->create([
            'invoice_id' => $invoiceId,
            'cash_session_id' => $sessionId,
            'user_id' => $cashier->id,
            'method' => Payment::METHOD_CASH,
            'amount' => '17.25',
            'amount_cents' => 1725,
            'status' => Payment::STATUS_POSTED,
            'paid_at' => now(),
        ]);

        $this->actingAs($this->supervisor())
            ->postJson("/api/invoices/{$invoiceId}/void", ['reason' => 'Intento concurrente'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('invoice')
            ->assertJsonPath(
                'errors.invoice.0',
                'No se puede anular una factura con pagos registrados sin flujo de reversión.',
            );

        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'status' => Invoice::STATUS_ISSUED,
            'voided_by' => null,
            'voided_at' => null,
        ]);
    }

    public function test_receipt_view_reports_the_durable_counter_and_legacy_reprints_are_numbered_from_it(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');

        // GET (vista / primera impresion): informa el contador durable sin
        // incrementarlo y sin etiqueta de reimpresion.
        $this->actingAs($cashier)
            ->getJson("/api/invoices/{$invoiceId}/receipt?width=half_letter")
            ->assertOk()
            ->assertJsonPath('data.institutional.copy_label', 'Original')
            ->assertJsonPath('data.legacy_reprint_count', 0);

        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'legacy_reprint_count' => 0,
        ]);
        $this->assertSame(0, AuditLog::query()
            ->where('entity_type', Invoice::class)
            ->where('entity_id', $invoiceId)
            ->where('action', 'invoice.reprinted')
            ->count());

        foreach ([
            'Recibo original danado por impresora' => 1,
            'Segunda reimpresion por peticion del paciente' => 2,
        ] as $reason => $expectedNumber) {
            $this->actingAs($cashier)
                ->postJson("/api/invoices/{$invoiceId}/reprint", [
                    'width' => 'half_letter',
                    'reason' => $reason,
                ])
                ->assertOk()
                // El numero sale del contador durable (invoices.legacy_reprint_count),
                // nunca de COUNT(audit_logs) ni de un "#1" fabricado por la sesion.
                ->assertJsonPath('data.receipt.institutional.copy_label', "REIMPRESIÓN #{$expectedNumber}")
                ->assertJsonPath('data.receipt.legacy_reprint_count', $expectedNumber)
                ->assertJsonPath('data.audit.copy_label', "REIMPRESIÓN #{$expectedNumber}")
                ->assertJsonPath('data.audit.reason', $reason)
                ->assertJsonPath('data.audit.legacy_reprint_count', $expectedNumber)
                // El contador institucional no se reutiliza en el path legacy.
                ->assertJsonMissingPath('data.audit.reprint_count');
        }

        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'legacy_reprint_count' => 2,
        ]);

        // Sesion/usuario nuevo: el GET sigue reportando el contador persistente
        // y la etiqueta de la vista no se convierte en reimpresion.
        $this->actingAs($this->admin())
            ->getJson("/api/invoices/{$invoiceId}/receipt?width=half_letter")
            ->assertOk()
            ->assertJsonPath('data.legacy_reprint_count', 2)
            ->assertJsonPath('data.institutional.copy_label', 'Original');

        $this->assertSame(2, AuditLog::query()
            ->where('entity_type', Invoice::class)
            ->where('entity_id', $invoiceId)
            ->where('action', 'invoice.reprinted')
            ->count());
    }

    public function test_legacy_reprint_requires_a_human_reason_of_5_to_500_characters(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');

        foreach ([
            'missing reason' => [],
            'blank reason' => ['reason' => '     '],
            'reason too short' => ['reason' => 'abcd'],
            'reason too long' => ['reason' => str_repeat('a', 501)],
        ] as $payload) {
            $this->actingAs($cashier)
                ->postJson("/api/invoices/{$invoiceId}/reprint", [
                    'width' => 'half_letter',
                    ...$payload,
                ])
                ->assertUnprocessable()
                ->assertJsonValidationErrors('reason');
        }

        $this->assertSame(0, AuditLog::query()
            ->where('action', 'invoice.reprinted')
            ->count());
        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'legacy_reprint_count' => 0,
        ]);
    }

    public function test_legacy_reprint_action_rejects_backend_generated_reason_without_form_request(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $invoice = Invoice::query()->findOrFail($this->createInvoice($cashier, 'Maria Lopez', 'Glucosa'));

        try {
            app(ReprintReceiptAction::class)->execute($invoice, $cashier, 'half_letter');
            $this->fail('Expected a reprint without a human reason to be rejected.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('reason', $exception->errors());
        }

        $this->assertSame(0, AuditLog::query()
            ->where('action', 'invoice.reprinted')
            ->count());
        $this->assertDatabaseHas('invoices', [
            'id' => $invoice->id,
            'legacy_reprint_count' => 0,
        ]);
    }

    public function test_reprint_with_same_idempotency_key_replays_without_duplicating_audit(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');
        $payload = [
            'width' => 'half_letter',
            'reason' => 'Recibo original danado por impresora',
        ];

        $this->actingAs($cashier)
            ->withHeaders(['Idempotency-Key' => 'invoice-reprint-'.$invoiceId])
            ->postJson("/api/invoices/{$invoiceId}/reprint", $payload)
            ->assertOk()
            ->assertJsonPath('data.receipt.institutional.copy_label', 'REIMPRESIÓN #1')
            ->assertJsonPath('data.audit.reason', 'Recibo original danado por impresora');

        $this->actingAs($cashier)
            ->withHeaders(['Idempotency-Key' => 'invoice-reprint-'.$invoiceId])
            ->postJson("/api/invoices/{$invoiceId}/reprint", $payload)
            ->assertOk()
            ->assertHeader('Idempotent-Replay', 'true')
            ->assertJsonPath('data.receipt.institutional.copy_label', 'REIMPRESIÓN #1')
            ->assertJsonPath('data.audit.reason', 'Recibo original danado por impresora');

        $this->assertSame(1, AuditLog::query()
            ->where('entity_type', Invoice::class)
            ->where('entity_id', $invoiceId)
            ->where('action', 'invoice.reprinted')
            ->count());
        // El replay idempotente no vuelve a incrementar el contador durable.
        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'legacy_reprint_count' => 1,
        ]);
    }

    private function seedBillingBase(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        // Financial scenarios use a synthetic tariff and must not inherit production catalog prices.
        Service::query()->where('name', 'Hemograma Completo')->update(['price' => '10.00']);
        Service::query()->where('name', 'Eritropoyetina')->update(['price' => '25.00', 'taxable' => false, 'tax_rate_id' => null]);
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
            'cai' => 'REAL-CAI-2026',
            'valid_until' => now()->addYear()->toDateString(),
            'active' => true,
        ]);
    }

    private function createInvoice(User $cashier, string $patientName, string $serviceName): int
    {
        CashRegisterSession::query()->firstOrCreate(
            [
                'user_id' => $cashier->id,
                'status' => CashRegisterSession::STATUS_OPEN,
            ],
            [
                'open_user_id' => $cashier->id,
                'opening_amount' => '500.00',
                'opened_at' => now(),
            ],
        );

        return app(CreateInvoiceAction::class)
            ->execute([
                'patient_name' => $patientName,
                'items' => [[
                    'service_id' => Service::query()->where('name', $serviceName)->firstOrFail()->id,
                    'quantity' => '1.00',
                ]],
            ], $cashier->fresh())
            ->id;
    }

    private function openSession(User $cashier): int
    {
        return app(OpenCashSessionAction::class)
            ->execute(['opening_amount' => '500.00'], $cashier->fresh())
            ->id;
    }

    private function admin(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        return $admin->refresh()->load('roles.permissions');
    }

    private function supervisor(): User
    {
        $supervisor = User::factory()->create();
        $supervisor->assignRole('supervisor');

        return $supervisor->refresh()->load('roles.permissions');
    }

    private function cashier(): User
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        return $cashier->refresh()->load('roles.permissions');
    }
}
