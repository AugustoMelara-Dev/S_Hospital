<?php

namespace Tests\Feature;

use App\Actions\InstitutionalReceipts\InstitutionalReceiptPdfService;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptPrintEvent;
use App\Models\InstitutionalReceiptSeries;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Payment;
use App\Models\ReceiptPrintProfile;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Barryvdh\DomPDF\PDF as DomPdfWrapper;
use Database\Seeders\ReceiptPrintProfileSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class InstitutionalReceiptPdfTest extends TestCase
{
    use RefreshDatabase;

    public function test_classic_receipt_html_contains_institutional_fields_copies_and_no_technical_patient_fields(): void
    {
        $context = $this->createIssuedReceiptContext(copyMode: 'original_first_second');
        $html = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($context['receipt']);

        foreach ([
            'Gobierno de Honduras',
            'Secretaria de Salud',
            'Hospital San Isidro',
            'La Esperanza',
            'Recibo No.',
            'Serie',
            'Monto',
            'Fecha',
            'El',
            'Que',
            'Suscribe. CERTIFICA haber enterado en esta oficina la suma de',
            'Por',
            'Firma del enterante',
            'ORIGINAL',
            'PRIMERA COPIA',
            'SEGUNDA COPIA',
        ] as $needle) {
            $this->assertStringContainsString($needle, $html);
        }

        foreach ([
            'CAI',
            'audit',
            'user_id',
            'barcode',
            'qr_code',
            'Estado',
            '<img',
            'fake seal',
        ] as $forbidden) {
            $this->assertStringNotContainsString($forbidden, $html);
        }
    }

    public function test_draft_test_print_html_has_watermark_copy_label_and_does_not_reserve_number(): void
    {
        $context = $this->createIssuedReceiptContext(copyMode: 'original_first');
        $profile = $context['profile'];
        $series = $context['series'];
        $series->forceFill(['current_number' => 9])->save();

        $html = app(InstitutionalReceiptPdfService::class)->htmlForDraft([
            'payer_name' => 'Paciente de prueba',
            'concept' => 'Pago de prueba',
            'amount' => '25.00',
        ], $profile, $series->fresh());

        $this->assertStringContainsString('PRUEBA - SIN VALIDEZ', $html);
        $this->assertStringContainsString('ORIGINAL', $html);
        $this->assertStringContainsString('PRIMERA COPIA', $html);
        $this->assertSame(9, $series->fresh()->current_number);
    }

    public function test_classic_receipt_html_renders_authorized_logo_only_when_profile_enables_it(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('branding/logo.png', base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lP3dWQAAAABJRU5ErkJggg=='
        ));

        $withoutLogo = $this->createIssuedReceiptContext();
        $withoutLogoHtml = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($withoutLogo['receipt']);

        $this->assertStringNotContainsString('<img', $withoutLogoHtml);
        $withoutLogo['series']->forceFill(['active' => false])->save();

        $withLogo = $this->createIssuedReceiptContext(useLogo: true);
        $withLogoHtml = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($withLogo['receipt']);

        $this->assertStringContainsString('<img', $withLogoHtml);
        $this->assertStringContainsString('data:image/png;base64', $withLogoHtml);
        $this->assertNotEmpty($withLogo['receipt']->institution_snapshot['logo_sha256']);
    }

    public function test_receipt_html_sanitizes_css_context_settings(): void
    {
        $context = $this->createIssuedReceiptContext();
        $receipt = $context['receipt'];
        $receipt->forceFill([
            'series_snapshot' => [
                ...$receipt->series_snapshot,
                'receipt_number_color' => '#b91c1c; background:url(javascript:alert(1))',
            ],
            'profile_snapshot' => [
                ...$receipt->profile_snapshot,
                'font_family' => 'Arial; } body { background: red',
            ],
        ])->save();

        $html = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($receipt->fresh());

        $this->assertStringNotContainsString('javascript:', $html);
        $this->assertStringNotContainsString('background: red', $html);
        $this->assertStringContainsString('color: #b91c1c;', $html);
        $this->assertStringContainsString('font-family: Arial, sans-serif;', $html);
    }

    public function test_receipt_pdf_endpoint_requires_permission_streams_pdf_and_records_event(): void
    {
        $context = $this->createIssuedReceiptContext();
        $user = $context['user'];
        $receipt = $context['receipt'];
        $capturedHtml = '';
        $capturedPaper = null;

        Pdf::shouldReceive('loadHTML')
            ->once()
            ->with(\Mockery::on(function (string $html) use (&$capturedHtml): bool {
                $capturedHtml = $html;

                return str_contains($html, 'Recibo No.');
            }))
            ->andReturn(tap(\Mockery::mock(DomPdfWrapper::class), function ($pdf) use (&$capturedPaper): void {
                $pdf->shouldReceive('setPaper')
                    ->once()
                    ->with(\Mockery::on(function (array $paper) use (&$capturedPaper): bool {
                        $capturedPaper = $paper;

                        return $paper === [0, 0, 612, 396];
                    }))
                    ->andReturnSelf();
                $pdf->shouldReceive('output')
                    ->once()
                    ->andReturn('%PDF-issued');
            }));

        $this->actingAs($user)
            ->get("/api/institutional-receipts/{$receipt->id}/pdf")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertSee('%PDF-issued', false);

        $this->assertStringContainsString('El', $capturedHtml);
        $this->assertSame([0, 0, 612, 396], $capturedPaper);
        $this->assertDatabaseHas('institutional_receipt_print_events', [
            'institutional_receipt_id' => $receipt->id,
            'event_type' => InstitutionalReceiptPrintEvent::TYPE_ISSUED_PRINT,
            'user_id' => $user->id,
        ]);
    }

    public function test_cashier_cannot_stream_other_cashiers_receipt_pdf(): void
    {
        $context = $this->createIssuedReceiptContext();
        $otherCashier = User::factory()->create();
        $otherCashier->assignRole('cajero');

        $this->actingAs($otherCashier)
            ->get("/api/institutional-receipts/{$context['receipt']->id}/pdf")
            ->assertForbidden();
    }

    public function test_repeated_receipt_pdf_requires_reprint_permission_reason_and_tracks_reprint(): void
    {
        $context = $this->createIssuedReceiptContext();
        $user = $context['user'];
        $receipt = $context['receipt'];

        Pdf::shouldReceive('loadHTML')
            ->twice()
            ->andReturn(tap(\Mockery::mock(DomPdfWrapper::class), function ($pdf): void {
                $pdf->shouldReceive('setPaper')
                    ->twice()
                    ->with([0, 0, 612, 396])
                    ->andReturnSelf();
                $pdf->shouldReceive('output')
                    ->twice()
                    ->andReturn('%PDF-issued');
            }));

        $this->actingAs($user)
            ->get("/api/institutional-receipts/{$receipt->id}/pdf")
            ->assertOk();

        $this->actingAs($user)
            ->get("/api/institutional-receipts/{$receipt->id}/pdf")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reason');

        $this->actingAs($user)
            ->get("/api/institutional-receipts/{$receipt->id}/pdf?reason=Reposicion%20solicitada")
            ->assertOk();

        $this->assertSame(1, $receipt->fresh()->reprint_count);
        $this->assertDatabaseHas('institutional_receipt_print_events', [
            'institutional_receipt_id' => $receipt->id,
            'event_type' => InstitutionalReceiptPrintEvent::TYPE_REPRINT,
            'reason' => 'Reposicion solicitada',
            'user_id' => $user->id,
        ]);
    }

    public function test_test_print_endpoint_streams_draft_pdf_records_test_event_and_keeps_series_number(): void
    {
        $context = $this->createIssuedReceiptContext(copyMode: 'original_first');
        $admin = User::factory()->create();
        $admin->assignRole('admin');
        $series = $context['series'];
        $series->forceFill(['current_number' => 12])->save();

        Pdf::shouldReceive('loadHTML')
            ->once()
            ->with(\Mockery::on(fn (string $html): bool => str_contains($html, 'PRUEBA - SIN VALIDEZ')
                && str_contains($html, 'PRIMERA COPIA')
                && ! str_contains($html, 'CAI')
                && ! str_contains($html, 'qr_code')))
            ->andReturn(tap(\Mockery::mock(DomPdfWrapper::class), function ($pdf): void {
                $pdf->shouldReceive('setPaper')
                    ->once()
                    ->with([0, 0, 612, 396])
                    ->andReturnSelf();
                $pdf->shouldReceive('output')
                    ->once()
                    ->andReturn('%PDF-test');
            }));

        $this->actingAs($admin)
            ->post('/api/settings/institutional-receipts/test-print', [
                'profile_code' => ReceiptPrintProfile::CODE_HALF_LETTER,
                'payer_name' => 'Paciente de prueba',
                'concept' => 'Servicios de prueba',
                'amount' => '25.00',
            ])
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertHeader('X-Receipt-Test-Print', 'PRUEBA - SIN VALIDEZ')
            ->assertSee('%PDF-test', false);

        $this->assertSame(12, $series->fresh()->current_number);
        $this->assertDatabaseHas('institutional_receipt_print_events', [
            'institutional_receipt_id' => null,
            'event_type' => InstitutionalReceiptPrintEvent::TYPE_TEST_PRINT,
            'user_id' => $admin->id,
        ]);
    }

    /**
     * @return array{user: User, receipt: InstitutionalReceipt, profile: ReceiptPrintProfile, series: InstitutionalReceiptSeries}
     */
    private function createIssuedReceiptContext(string $copyMode = 'original_only', bool $useLogo = false): array
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        FiscalSetting::query()->create([
            'hospital_name' => 'Hospital San Isidro',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'receipt_width' => '80mm',
            'primary_color' => 'indigo',
            'address' => 'Barrio El Centro',
            'slogan' => 'Servicio institucional',
            'scanner_enabled' => false,
            'partial_payments_enabled' => false,
            'receipt_template_mode' => 'institutional',
            'receipt_paper_size' => 'half_letter',
            'government_line' => 'Gobierno de Honduras',
            'secretariat_line' => 'Secretaria de Salud',
            'receipt_location' => 'La Esperanza',
            'receipt_footer_text' => 'Copia generada desde datos del recibo',
        ]);

        $profile = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)
            ->firstOrFail();
        $profile->forceFill([
            'copies_mode' => $copyMode,
            'use_logo' => $useLogo,
        ])->save();

        $user = User::factory()->create(['name' => 'Cajera Uno']);
        $user->assignRole('cajero');

        $sequence = FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => '000-001-01',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 1,
            'cai' => 'CAI-TEST-RECEIPT-PDF-'.bin2hex(random_bytes(3)),
            'valid_until' => now()->addYear()->toDateString(),
            'active' => false,
        ]);

        $cashSession = CashRegisterSession::query()->create([
            'user_id' => $user->id,
            'open_user_id' => $user->id,
            'opening_amount' => '100.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        $invoice = Invoice::query()->create([
            'invoice_number' => 'INV-'.str_pad((string) random_int(1, 99999999), 8, '0', STR_PAD_LEFT),
            'fiscal_sequence_id' => $sequence->id,
            'hospital_name' => 'Hospital San Isidro',
            'hospital_address' => 'Barrio El Centro',
            'receipt_template_mode' => 'institutional',
            'receipt_paper_size' => 'half_letter',
            'receipt_government_line' => 'Gobierno de Honduras',
            'receipt_secretariat_line' => 'Secretaria de Salud',
            'receipt_location' => 'La Esperanza',
            'receipt_footer_text' => 'Gracias por su pago',
            'tax_label' => 'ISV',
            'tax_rate_snapshot' => '15.00',
            'patient_name' => 'Maria Lopez',
            'subtotal' => '1073.53',
            'subtotal_cents' => 107353,
            'tax_amount' => '161.03',
            'tax_amount_cents' => 16103,
            'discount_amount' => '0.00',
            'discount_amount_cents' => 0,
            'total' => '1234.56',
            'total_cents' => 123456,
            'paid_amount' => '1234.56',
            'paid_amount_cents' => 123456,
            'balance_due' => '0.00',
            'balance_due_cents' => 0,
            'status' => Invoice::STATUS_PAID,
            'cash_session_id' => $cashSession->id,
            'issued_by' => $user->id,
            'issued_at' => now(),
        ]);

        InvoiceItem::query()->create([
            'invoice_id' => $invoice->id,
            'service_name' => 'Consulta general',
            'category_name' => 'Consulta',
            'area_name' => 'Caja',
            'quantity' => '1.00',
            'quantity_cents' => 100,
            'unit_price' => '1073.53',
            'unit_price_cents' => 107353,
            'tax_rate' => '15.00',
            'tax_amount' => '161.03',
            'tax_amount_cents' => 16103,
            'line_subtotal' => '1073.53',
            'line_subtotal_cents' => 107353,
            'line_total' => '1234.56',
            'line_total_cents' => 123456,
            'special_rule_applied' => false,
        ]);

        Payment::query()->create([
            'invoice_id' => $invoice->id,
            'cash_session_id' => $cashSession->id,
            'user_id' => $user->id,
            'method' => Payment::METHOD_CASH,
            'amount' => '1234.56',
            'amount_cents' => 123456,
            'status' => Payment::STATUS_POSTED,
            'paid_at' => now(),
        ]);

        $seriesCode = 'REC-'.strtoupper(bin2hex(random_bytes(2)));
        $prefix = 'R'.strtoupper(bin2hex(random_bytes(1)));

        $series = InstitutionalReceiptSeries::query()->create([
            'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
            'series' => $seriesCode,
            'prefix' => $prefix,
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'max_number' => 100,
            'current_number' => 0,
            'range_authorization' => 'AUT-REC',
            'legal_text' => 'Suscribe. CERTIFICA haber enterado en esta oficina la suma de',
            'receipt_number_color' => '#b91c1c',
            'active' => true,
            'reprint_behavior' => InstitutionalReceiptSeries::REPRINT_AUDIT_ONLY,
            'void_behavior' => InstitutionalReceiptSeries::VOID_PERMISSION_REASON_AUDIT,
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        $receiptId = $this->actingAs($user)
            ->postJson('/api/institutional-receipts', [
                'invoice_id' => $invoice->id,
            ])
            ->assertCreated()
            ->json('data.id');

        return [
            'user' => $user,
            'receipt' => InstitutionalReceipt::query()->findOrFail($receiptId),
            'profile' => $profile->fresh(),
            'series' => $series->fresh(),
        ];
    }
}
