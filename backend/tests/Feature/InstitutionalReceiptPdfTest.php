<?php

namespace Tests\Feature;

use App\Actions\InstitutionalReceipts\AmountToSpanishWords;
use App\Actions\InstitutionalReceipts\InstitutionalReceiptHtmlBuilder;
use App\Actions\InstitutionalReceipts\InstitutionalReceiptPdfService;
use App\Actions\InstitutionalReceipts\VoidInstitutionalReceiptAction;
use App\Models\AuditLog;
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
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
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
            'Hospital General San Isidro',
            'RTN 08011999123456',
            'Tel. 2444-0000',
            'La Esperanza',
            'Recibo No.',
            'Serie',
            'Factura',
            'CAI fiscal',
            'CAI-TEST-RECEIPT-PDF-',
            'Rango fiscal autorizado',
            '000-001-01-00000001 a 000-001-01-99999999',
            'Fecha límite de emisión',
            '31/12/2027',
            'Estado',
            'Fecha recibo',
            'Paciente / enterante',
            'Detalle de servicios',
            'Consulta general',
            'Subtotal',
            'Exento',
            'ISV 15.00%',
            'Total',
            'Pagado',
            'Saldo',
            'Monto en letras',
            'Suscribe. CERTIFICA haber enterado en esta oficina la suma de',
            'Firma del enterante',
            'ORIGINAL',
            'PRIMERA COPIA',
            'SEGUNDA COPIA',
        ] as $needle) {
            $this->assertStringContainsString($needle, $html);
        }

        $this->assertMatchesRegularExpression('/>Caja<.*#\d+/s', $html);

        foreach ([
            'audit',
            'user_id',
            'barcode',
            'qr_code',
            '<img',
            'fake seal',
        ] as $forbidden) {
            $this->assertStringNotContainsString($forbidden, $html);
        }

        $this->assertStringContainsString('thead', $html);
        $this->assertStringContainsString('page-break-inside: avoid', $html);
        $this->assertStringContainsString('--institutional-accent: #111827;', $html);
        $this->assertStringNotContainsString('#0f766e', $html);
        $this->assertStringNotContainsString('#ecfdf5', $html);
        $this->assertStringContainsString('class="receipt-layout profile-', $html);
        $this->assertStringContainsString('class="meta-table receipt-meta-panel"', $html);
        $this->assertSame('2027-12-31', data_get($context['receipt']->invoice_snapshot, 'fiscal_valid_until'));
    }

    public function test_copy_modes_render_the_expected_pages_and_copy_labels(): void
    {
        $expectations = [
            'original_only' => [
                'pages' => 1,
                'present' => ['ORIGINAL'],
                'absent' => ['PRIMERA COPIA', 'SEGUNDA COPIA'],
            ],
            'original_first' => [
                'pages' => 2,
                'present' => ['ORIGINAL', 'PRIMERA COPIA'],
                'absent' => ['SEGUNDA COPIA'],
            ],
            'original_first_second' => [
                'pages' => 3,
                'present' => ['ORIGINAL', 'PRIMERA COPIA', 'SEGUNDA COPIA'],
                'absent' => [],
            ],
        ];

        foreach ($expectations as $copyMode => $expectation) {
            $context = $this->createIssuedReceiptContext(copyMode: $copyMode);
            $html = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($context['receipt']);

            $this->assertSame($copyMode, $context['receipt']->copy_mode, $copyMode);
            $this->assertSame(
                $expectation['pages'],
                substr_count($html, 'class="receipt-page'),
                "{$copyMode}: page count",
            );

            foreach ($expectation['present'] as $label) {
                $this->assertStringContainsString($label, $html, "{$copyMode}: {$label}");
            }

            foreach ($expectation['absent'] as $label) {
                $this->assertStringNotContainsString($label, $html, "{$copyMode}: {$label}");
            }

            // Release the single active series before building the next context.
            $context['series']->forceFill(['active' => false])->save();
        }
    }

    public function test_issued_receipt_keeps_its_copy_mode_snapshot_after_profile_changes(): void
    {
        $context = $this->createIssuedReceiptContext(copyMode: 'original_first_second');
        $receipt = $context['receipt'];
        $profile = $context['profile'];

        $before = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($receipt);
        $this->assertSame(3, substr_count($before, 'class="receipt-page'));

        $profile->forceFill(['copies_mode' => 'original_only'])->save();

        $after = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($receipt->fresh());
        $this->assertSame(3, substr_count($after, 'class="receipt-page'));
        $this->assertSame('original_first_second', $receipt->fresh()->copy_mode);
    }

    public function test_first_print_is_never_marked_and_reprints_use_the_persistent_counter(): void
    {
        $context = $this->createIssuedReceiptContext(copyMode: 'original_first');
        $user = $context['user'];
        $receipt = $context['receipt'];
        $service = app(InstitutionalReceiptPdfService::class);

        // Emisión + document request before any recorded print: original, unmarked.
        $originalHtml = $service->htmlForReceipt($receipt);
        $this->assertStringNotContainsString('REIMPRESIÓN', $originalHtml);
        $this->assertStringContainsString('ORIGINAL', $originalHtml);
        $this->assertStringContainsString('PRIMERA COPIA', $originalHtml);

        // Primera solicitud autorizada de impresión (issued_print, no reason).
        $service->recordReceiptPrintEvent($receipt, $user);
        $receipt->refresh();

        $firstReprintHtml = $service->htmlForReceipt($receipt);
        $this->assertStringContainsString('REIMPRESIÓN #1', $firstReprintHtml);
        // The legend is additional: the original copy labels and snapshot stay.
        $this->assertStringContainsString('ORIGINAL', $firstReprintHtml);
        $this->assertStringContainsString('PRIMERA COPIA', $firstReprintHtml);
        $this->assertSame('1234.56', $receipt->amount);
        $this->assertSame('1234.56', data_get($receipt->invoice_snapshot, 'total'));
        $this->assertSame(0, $receipt->reprint_count);

        // Reimpresión #1 (human reason): counter moves to 1, next legend is #2.
        $service->recordReceiptPrintEvent(
            $receipt->fresh(),
            $user,
            'Reposicion solicitada por extravio del comprobante',
        );
        $receipt->refresh();

        $this->assertSame(1, $receipt->reprint_count);
        $secondReprintHtml = $service->htmlForReceipt($receipt);
        $this->assertStringContainsString('REIMPRESIÓN #2', $secondReprintHtml);
        $this->assertStringContainsString('ORIGINAL', $secondReprintHtml);
        $this->assertSame('1234.56', $receipt->amount);
    }

    public function test_reprint_legend_does_not_depend_on_prunable_invoice_reprinted_audit_logs(): void
    {
        $context = $this->createIssuedReceiptContext();
        $receipt = $context['receipt'];

        // Podable audit rows must not create a reprint legend by themselves.
        AuditLog::query()->create([
            'user_id' => $context['user']->id,
            'action' => 'invoice.reprinted',
            'entity_type' => Invoice::class,
            'entity_id' => $receipt->invoice_id,
            'new_values' => ['invoice_number' => $receipt->invoice_snapshot['invoice_number'] ?? null],
        ]);

        $html = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($receipt);
        $this->assertStringNotContainsString('REIMPRESIÓN', $html);

        // The persistent column keeps controlling the legend even without new audit rows.
        $receipt->forceFill(['reprint_count' => 1])->save();
        $htmlWithCounter = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($receipt->fresh());
        $this->assertStringContainsString('REIMPRESIÓN #2', $htmlWithCounter);
    }

    public function test_pdf_reprint_request_requires_a_human_reason_after_the_first_print(): void
    {
        $context = $this->createIssuedReceiptContext();
        $user = $context['user'];
        $receipt = $context['receipt'];

        $this->actingAs($user)
            ->postJson("/api/institutional-receipts/{$receipt->id}/print-events")
            ->assertCreated();

        // GET remains a read-only view/download: no reason is required.
        $this->actingAs($user)
            ->get("/api/institutional-receipts/{$receipt->id}/pdf")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf');

        // POST is a reprint request now: reason 5-500 is mandatory and validated.
        $this->actingAs($user)
            ->postJson("/api/institutional-receipts/{$receipt->id}/pdf")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reason');

        $this->actingAs($user)
            ->postJson("/api/institutional-receipts/{$receipt->id}/pdf", ['reason' => 'abc'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reason');

        $this->actingAs($user)
            ->postJson("/api/institutional-receipts/{$receipt->id}/pdf", [
                'reason' => 'Reposicion solicitada por extravio del comprobante',
            ])
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf');

        // The reprint is durably recorded on this route too: the persistent
        // counter advances and a `reprint` event carries the human reason, so
        // repeated POST /pdf requests can never reuse the same REIMPRESIÓN #1.
        $freshReceipt = $receipt->fresh();
        $this->assertSame(1, $freshReceipt->reprint_count);
        $this->assertSame(2, $freshReceipt->printEvents()->count());
        $this->assertDatabaseHas('institutional_receipt_print_events', [
            'institutional_receipt_id' => $receipt->id,
            'event_type' => InstitutionalReceiptPrintEvent::TYPE_REPRINT,
            'reason' => 'Reposicion solicitada por extravio del comprobante',
            'user_id' => $user->id,
        ]);
    }

    public function test_post_pdf_reprint_consumes_a_distinct_persistent_number_and_keeps_the_receipt_number(): void
    {
        $context = $this->createIssuedReceiptContext();
        $user = $context['user'];
        $receipt = $context['receipt'];
        $receiptNumber = $receipt->receipt_number_full;
        $capturedHtml = [];

        $this->actingAs($user)
            ->postJson("/api/institutional-receipts/{$receipt->id}/print-events")
            ->assertCreated();

        Pdf::shouldReceive('loadHTML')
            ->twice()
            ->andReturnUsing(function (string $html) use (&$capturedHtml): DomPdfWrapper {
                $capturedHtml[] = $html;

                return tap(\Mockery::mock(DomPdfWrapper::class), function ($pdf): void {
                    $pdf->shouldReceive('setPaper')->andReturnSelf();
                    $pdf->shouldReceive('output')->andReturn('%PDF-reprint');
                });
            });

        foreach ([1, 2] as $expectedReprintNumber) {
            $this->actingAs($user)
                ->postJson("/api/institutional-receipts/{$receipt->id}/pdf", [
                    'reason' => "Reposicion solicitada numero {$expectedReprintNumber}",
                ])
                ->assertOk()
                ->assertHeader('Content-Type', 'application/pdf')
                ->assertSee('%PDF-reprint', false);
        }

        $this->assertStringContainsString('REIMPRESIÓN #1', $capturedHtml[0]);
        $this->assertStringContainsString('REIMPRESIÓN #2', $capturedHtml[1]);

        $freshReceipt = $receipt->fresh();
        $this->assertSame(2, $freshReceipt->reprint_count);
        $this->assertSame(
            $receiptNumber,
            $freshReceipt->receipt_number_full,
            'Reprints must never renumber the first delivery',
        );
        $this->assertSame(3, $freshReceipt->printEvents()->count());
    }

    public function test_post_pdf_after_first_print_requires_reprint_permission(): void
    {
        $context = $this->createIssuedReceiptContext();
        $receipt = $context['receipt'];

        // First logical print: no reprint permission needed.
        $this->actingAs($context['user'])
            ->postJson("/api/institutional-receipts/{$receipt->id}/print-events")
            ->assertCreated();

        // A viewer-owner without receipts.reprint cannot turn POST /pdf into a reprint.
        $viewer = User::factory()->create();
        $viewer->givePermissionTo('receipts.view');

        $this->actingAs($viewer)
            ->postJson("/api/institutional-receipts/{$receipt->id}/pdf", [
                'reason' => 'Reposicion solicitada por extravio',
            ])
            ->assertForbidden();

        $this->assertSame(0, $receipt->fresh()->reprint_count);
        $this->assertSame(1, $receipt->fresh()->printEvents()->count());
    }

    public function test_post_pdf_reprint_idempotency_replay_does_not_advance_the_counter_twice(): void
    {
        $context = $this->createIssuedReceiptContext();
        $user = $context['user'];
        $receipt = $context['receipt'];

        $this->actingAs($user)
            ->postJson("/api/institutional-receipts/{$receipt->id}/print-events")
            ->assertCreated();

        Pdf::shouldReceive('loadHTML')
            ->once()
            ->andReturn(tap(\Mockery::mock(DomPdfWrapper::class), function ($pdf): void {
                $pdf->shouldReceive('setPaper')->andReturnSelf();
                $pdf->shouldReceive('output')->andReturn('%PDF-reprint');
            }));

        $payload = ['reason' => 'Reposicion solicitada por extravio del comprobante'];

        $this->actingAs($user)
            ->withHeaders(['Idempotency-Key' => 'rcp01-pdf-reprint-1'])
            ->postJson("/api/institutional-receipts/{$receipt->id}/pdf", $payload)
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf');

        $this->actingAs($user)
            ->withHeaders(['Idempotency-Key' => 'rcp01-pdf-reprint-1'])
            ->postJson("/api/institutional-receipts/{$receipt->id}/pdf", $payload)
            ->assertOk()
            ->assertHeader('Idempotent-Replay', 'true');

        $this->assertSame(1, $receipt->fresh()->reprint_count);
        $this->assertSame(2, $receipt->fresh()->printEvents()->count());
    }

    public function test_first_print_pdf_request_without_prior_print_accepts_an_optional_valid_reason(): void
    {
        $context = $this->createIssuedReceiptContext();
        $user = $context['user'];
        $receipt = $context['receipt'];

        $this->actingAs($user)
            ->postJson("/api/institutional-receipts/{$receipt->id}/pdf", [
                'reason' => 'Emision manual de recibo faltante',
            ])
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf');

        // A provided reason that is too short is still rejected, even on a first print.
        $this->actingAs($user)
            ->postJson("/api/institutional-receipts/{$receipt->id}/pdf", ['reason' => 'abc'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reason');

        $this->assertSame(0, $receipt->fresh()->reprint_count);
        $this->assertDatabaseMissing('institutional_receipt_print_events', [
            'institutional_receipt_id' => $receipt->id,
        ]);
    }

    public function test_classic_receipt_uses_a_minimal_monochrome_print_contract(): void
    {
        $context = $this->createIssuedReceiptContext();
        $html = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($context['receipt']);

        $this->assertStringContainsString('data-receipt-style="minimal-monochrome"', $html);
        $this->assertStringNotContainsString('style="color:', $html);
        $this->assertStringNotContainsString('background: #111827', $html);
        $this->assertStringNotContainsString('color: #ffffff', $html);
        $this->assertStringContainsString('.section-title', $html);
        $this->assertStringContainsString('border-bottom: 1px solid #111827', $html);
    }

    public function test_classic_receipt_omits_fiscal_authorization_when_snapshot_has_no_fiscal_data(): void
    {
        $context = $this->createIssuedReceiptContext();
        $snapshot = $context['receipt']->invoice_snapshot;
        $snapshot['fiscal_cai'] = null;
        $snapshot['fiscal_range_from'] = null;
        $snapshot['fiscal_range_to'] = null;
        $snapshot['fiscal_valid_until'] = null;
        $context['receipt']->forceFill(['invoice_snapshot' => $snapshot])->save();

        $html = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($context['receipt']->fresh());

        $this->assertStringNotContainsString('CAI fiscal', $html);
        $this->assertStringNotContainsString('Rango fiscal autorizado', $html);
        $this->assertStringNotContainsString('Fecha límite de emisión', $html);
    }

    public function test_classic_receipt_keeps_summary_together_without_making_signatures_part_of_the_same_indivisible_block(): void
    {
        $context = $this->createIssuedReceiptContext();
        $html = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($context['receipt']);

        $this->assertMatchesRegularExpression(
            '/\.receipt-summary\s*\{[^}]*page-break-inside:\s*avoid;[^}]*break-inside:\s*avoid;/s',
            $html,
        );
        $this->assertMatchesRegularExpression(
            '/<div class="receipt-summary">.*<table class="totals-table">.*Monto en letras.*<\/div>\s*<table class="signature-grid">/s',
            $html,
        );
        $this->assertDoesNotMatchRegularExpression(
            '/\.receipt-closing-block\s*\{[^}]*(?:page-break-inside|break-inside):\s*avoid;/s',
            $html,
        );
        $this->assertMatchesRegularExpression(
            '/\.items-table\s+tbody\s+tr\s*\{[^}]*page-break-inside:\s*avoid;[^}]*break-inside:\s*avoid;/s',
            $html,
        );
        $this->assertMatchesRegularExpression(
            '/\.items-table\s+thead\s*\{[^}]*display:\s*table-header-group;/s',
            $html,
        );
    }

    public function test_authorized_receipt_preview_reuses_pdf_html_without_recording_print_audit(): void
    {
        $context = $this->createIssuedReceiptContext();
        $user = $context['user'];
        $receipt = $context['receipt'];
        $expectedHtml = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($receipt);

        $this->actingAs($user)
            ->get("/api/institutional-receipts/{$receipt->id}/pdf?preview=1")
            ->assertOk()
            ->assertHeader('Content-Type', 'text/html; charset=UTF-8')
            ->assertContent($expectedHtml);

        $this->assertDatabaseMissing('institutional_receipt_print_events', [
            'institutional_receipt_id' => $receipt->id,
        ]);
        $this->assertSame(0, $receipt->fresh()->reprint_count);
    }

    public function test_four_item_receipt_fits_one_page_on_primary_print_profiles(): void
    {
        $context = $this->createIssuedReceiptContext();
        $receipt = $context['receipt'];
        $baseItem = $receipt->items_snapshot[0];
        $receipt->forceFill([
            'amount' => '4938.24',
            'amount_cents' => 493824,
            'amount_words' => app(AmountToSpanishWords::class)->forCents(493824),
            'invoice_snapshot' => [
                ...$receipt->invoice_snapshot,
                'subtotal' => '4294.12',
                'subtotal_cents' => 429412,
                'tax_amount' => '644.12',
                'tax_amount_cents' => 64412,
                'total' => '4938.24',
                'total_cents' => 493824,
                'paid_amount' => '4938.24',
                'paid_amount_cents' => 493824,
            ],
            'items_snapshot' => collect(range(1, 4))
                ->map(fn (int $index): array => [
                    ...$baseItem,
                    'service_name' => "Servicio hospitalario {$index}",
                ])
                ->all(),
        ])->save();

        $qaOutputDirectory = trim((string) env('RECEIPT_QA_OUTPUT_DIR'));

        foreach ([
            ReceiptPrintProfile::CODE_LETTER => 'letter_landscape',
            ReceiptPrintProfile::CODE_HALF_LETTER => 'half_letter_landscape',
            ReceiptPrintProfile::CODE_A5 => 'a5_landscape',
        ] as $code => $paperKind) {
            $profile = ReceiptPrintProfile::query()->where('code', $code)->firstOrFail();
            $receipt->forceFill([
                'print_profile_code' => $code,
                'profile_snapshot' => [
                    ...$receipt->profile_snapshot,
                    'code' => $code,
                    'name' => $profile->name,
                    'paper_kind' => $paperKind,
                    'width_mm' => (string) $profile->width_mm,
                    'height_mm' => (string) $profile->height_mm,
                    'font_scale' => (string) $profile->font_scale,
                ],
            ])->save();

            $pdf = app(InstitutionalReceiptPdfService::class)->pdfForReceipt($receipt->fresh());
            $pageCount = preg_match_all('/\/Type\s*\/Page\b/', $pdf);

            $this->assertSame(1, $pageCount, $code);

            if ($qaOutputDirectory !== '') {
                File::ensureDirectoryExists($qaOutputDirectory);
                File::put($qaOutputDirectory.DIRECTORY_SEPARATOR.$code.'.pdf', $pdf);
            }
        }

        if ($qaOutputDirectory !== '') {
            foreach ([ReceiptPrintProfile::CODE_THERMAL_80, ReceiptPrintProfile::CODE_THERMAL_58] as $code) {
                $profile = ReceiptPrintProfile::query()->where('code', $code)->firstOrFail();
                $receipt->forceFill([
                    'print_profile_code' => $code,
                    'profile_snapshot' => [
                        ...$receipt->profile_snapshot,
                        'code' => $code,
                        'name' => $profile->name,
                        'paper_kind' => $profile->paper_kind,
                        'width_mm' => (string) $profile->width_mm,
                        'height_mm' => (string) $profile->height_mm,
                        'font_scale' => (string) $profile->font_scale,
                    ],
                ])->save();

                File::put(
                    $qaOutputDirectory.DIRECTORY_SEPARATOR.$code.'.pdf',
                    app(InstitutionalReceiptPdfService::class)->pdfForReceipt($receipt->fresh()),
                );
            }
        }
    }

    public function test_receipt_html_escapes_patient_services_notes_and_reference_without_raw_snapshot_data(): void
    {
        $context = $this->createIssuedReceiptContext();
        $receipt = $context['receipt'];

        $receipt->forceFill([
            'payer_name' => '<script>alert("patient")</script>',
            'concept' => '<img src=x onerror=alert(1)>',
            'items_snapshot' => [[
                'service_name' => '<script>alert("service")</script>',
                'category_name' => '<b>Categoria</b>',
                'area_name' => 'Caja',
                'quantity' => '1.00',
                'unit_price' => '25.00',
                'unit_price_cents' => 2500,
                'tax_rate' => '0.00',
                'tax_amount' => '0.00',
                'tax_amount_cents' => 0,
                'line_subtotal' => '25.00',
                'line_subtotal_cents' => 2500,
                'line_total' => '25.00',
                'line_total_cents' => 2500,
                'notes' => '<script>alert("notes")</script>',
            ]],
            'payment_snapshot' => [
                ...$receipt->payment_snapshot,
                'selected_payment' => [
                    'method' => 'transfer',
                    'amount' => '25.00',
                    'amount_cents' => 2500,
                    'reference' => '<script>alert("reference")</script>',
                    'paid_at' => now()->toIso8601String(),
                    'cashier_name' => 'Cajera Uno',
                ],
            ],
        ])->save();

        $html = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($receipt->fresh());

        $this->assertStringContainsString('&lt;script&gt;alert(&quot;patient&quot;)&lt;/script&gt;', $html);
        $this->assertStringContainsString('&lt;script&gt;alert(&quot;service&quot;)&lt;/script&gt;', $html);
        $this->assertStringContainsString('&lt;script&gt;alert(&quot;notes&quot;)&lt;/script&gt;', $html);
        $this->assertStringContainsString('&lt;script&gt;alert(&quot;reference&quot;)&lt;/script&gt;', $html);
        $this->assertStringNotContainsString('<script>', $html);
        $this->assertStringNotContainsString('items_snapshot', $html);
        $this->assertStringNotContainsString('payment_snapshot', $html);
    }

    public function test_receipt_html_supports_many_items_and_all_print_profiles_without_barcode_or_qr(): void
    {
        $context = $this->createIssuedReceiptContext();
        $receipt = $context['receipt'];
        $items = collect(range(1, 100))
            ->map(fn (int $index): array => [
                'service_name' => "Servicio hospitalario extendido {$index}",
                'category_name' => 'Categoria de prueba',
                'area_name' => 'Area administrativa',
                'quantity' => '1.00',
                'unit_price' => '1.00',
                'unit_price_cents' => 100,
                'tax_rate' => '0.00',
                'tax_amount' => '0.00',
                'tax_amount_cents' => 0,
                'line_subtotal' => '1.00',
                'line_subtotal_cents' => 100,
                'line_total' => '1.00',
                'line_total_cents' => 100,
                'notes' => str_repeat('Descripcion larga ', 6),
            ])
            ->all();

        $receipt->forceFill(['items_snapshot' => $items])->save();

        foreach ([
            ReceiptPrintProfile::CODE_HALF_LETTER => 'half_letter_landscape',
            ReceiptPrintProfile::CODE_LETTER => 'letter_landscape',
            ReceiptPrintProfile::CODE_A5 => 'a5_landscape',
            ReceiptPrintProfile::CODE_THERMAL_80 => 'thermal_80mm',
            ReceiptPrintProfile::CODE_THERMAL_58 => 'thermal_58mm',
        ] as $code => $paperKind) {
            $profile = ReceiptPrintProfile::query()->where('code', $code)->firstOrFail();
            $html = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($receipt->forceFill([
                'print_profile_code' => $code,
                'profile_snapshot' => [
                    ...$receipt->profile_snapshot,
                    'code' => $code,
                    'name' => $profile->name,
                    'paper_kind' => $paperKind,
                    'width_mm' => (string) $profile->width_mm,
                    'height_mm' => (string) $profile->height_mm,
                    'font_scale' => (string) $profile->font_scale,
                ],
            ]));

            $this->assertStringContainsString('Servicio hospitalario extendido 100', $html);
            $this->assertStringContainsString('thead', $html);
            $this->assertStringContainsString('page-break-inside: avoid', $html);
            $this->assertStringNotContainsString('barcode', $html);
            $this->assertStringNotContainsString('qr_code', $html);
        }
    }

    public function test_primary_receipt_profiles_keep_mixed_payments_in_the_compact_table(): void
    {
        $receipt = $this->receiptWithTwoPostedPayments();

        foreach ([
            ReceiptPrintProfile::CODE_LETTER,
            ReceiptPrintProfile::CODE_HALF_LETTER,
            ReceiptPrintProfile::CODE_A5,
        ] as $code) {
            $html = app(InstitutionalReceiptPdfService::class)
                ->htmlForReceipt($this->receiptUsingProfile($receipt, $code));

            $this->assertStringContainsString('<section class="receipt-page primary-paper">', $html, $code);
            $this->assertStringContainsString('<table class="items-table payment-table">', $html, $code);
            $this->assertMatchesRegularExpression(
                '/<table class="items-table payment-table">.*Fecha.*Método.*Monto.*Referencia.*Cajero.*<\/table>/s',
                $html,
                $code,
            );
            $this->assertStringNotContainsString('<div class="thermal-payment-list">', $html, $code);
            $this->assertStringNotContainsString('<div class="thermal-meta-list', $html, $code);
        }
    }

    public function test_thermal_receipt_profiles_stack_mixed_payments_and_essential_metadata(): void
    {
        $receipt = $this->receiptWithTwoPostedPayments();
        $qaOutputDirectory = trim((string) env('RECEIPT_THERMAL_PAYMENT_QA_OUTPUT_DIR'));

        foreach ([
            ReceiptPrintProfile::CODE_THERMAL_80,
            ReceiptPrintProfile::CODE_THERMAL_58,
        ] as $code) {
            $thermalReceipt = $this->receiptUsingProfile($receipt, $code);
            $service = app(InstitutionalReceiptPdfService::class);
            $html = $service->htmlForReceipt($thermalReceipt);

            $this->assertStringContainsString('<div class="thermal-payment-list">', $html, $code);
            $this->assertSame(2, substr_count($html, 'class="thermal-payment-card"'), $code);
            $this->assertStringNotContainsString('<table class="items-table payment-table">', $html, $code);
            $this->assertMatchesRegularExpression(
                '/Pago 1.*Fecha.*15\/07\/2026 08:30.*Método.*Efectivo.*Monto.*L\. 600\.00.*Referencia.*Sin referencia.*Cajero.*Cajera Uno/s',
                $html,
                $code,
            );
            $this->assertMatchesRegularExpression(
                '/Pago 2.*Fecha.*15\/07\/2026 08:35.*Método.*Transferencia.*Monto.*L\. 634\.56.*Referencia.*TRX-THERMAL.*Cajero.*Cajera Dos/s',
                $html,
                $code,
            );
            $this->assertStringContainsString('<div class="thermal-meta-list thermal-document-meta">', $html, $code);
            $this->assertStringContainsString('<div class="thermal-meta-list thermal-operation-meta">', $html, $code);
            $this->assertStringNotContainsString('<table class="meta-table">', $html, $code);
            foreach ([
                'Factura',
                'Serie',
                'Estado',
                'Fecha recibo',
                'CAI fiscal',
                'Rango fiscal autorizado',
                'Fecha límite de emisión',
                'Paciente / enterante',
                'Caja',
                'Método',
            ] as $essentialLabel) {
                $this->assertStringContainsString($essentialLabel, $html, "{$code}: {$essentialLabel}");
            }
            $this->assertMatchesRegularExpression(
                '/\.thermal-payment-card\s*\{[^}]*page-break-inside:\s*avoid;[^}]*break-inside:\s*avoid;/s',
                $html,
                $code,
            );

            $pdf = $service->pdfForReceipt($thermalReceipt);
            $pageCount = preg_match_all('/\/Type\s*\/Page\b/', $pdf);

            $this->assertStringStartsWith('%PDF', $pdf, $code);
            $this->assertGreaterThanOrEqual(1, $pageCount, $code);
            $this->assertLessThanOrEqual(6, $pageCount, $code);

            if ($qaOutputDirectory !== '') {
                File::ensureDirectoryExists($qaOutputDirectory);
                File::put(
                    $qaOutputDirectory.DIRECTORY_SEPARATOR."{$code}-mixed-payments.pdf",
                    $pdf,
                );
            }
        }
    }

    public function test_receipt_pdf_generation_supports_many_items_and_all_real_print_profiles_without_mutating_snapshots(): void
    {
        $context = $this->createIssuedReceiptContext();
        $receipt = $context['receipt'];
        $items = collect(range(1, 100))
            ->map(fn (int $index): array => [
                'service_name' => "Servicio hospitalario extendido {$index}",
                'category_name' => 'Categoria de prueba',
                'area_name' => 'Area administrativa',
                'quantity' => $index === 1 ? '0.00' : '1.00',
                'unit_price' => $index === 1 ? '0.00' : '9999.99',
                'unit_price_cents' => $index === 1 ? 0 : 999999,
                'tax_rate' => '15.00',
                'tax_amount' => $index === 1 ? '0.00' : '1500.00',
                'tax_amount_cents' => $index === 1 ? 0 : 150000,
                'line_subtotal' => $index === 1 ? '0.00' : '9999.99',
                'line_subtotal_cents' => $index === 1 ? 0 : 999999,
                'line_total' => $index === 1 ? '0.00' : '11499.99',
                'line_total_cents' => $index === 1 ? 0 : 1149999,
                'notes' => str_repeat('Descripcion larga ', 8),
            ])
            ->all();
        $originalSeriesSnapshot = $receipt->series_snapshot;
        $originalReceiptNumber = $receipt->receipt_number_full;
        $originalSeriesCurrentNumber = $context['series']->fresh()->current_number;

        $receipt->forceFill(['items_snapshot' => $items])->save();

        foreach ([
            ReceiptPrintProfile::CODE_HALF_LETTER => 'half_letter_landscape',
            ReceiptPrintProfile::CODE_LETTER => 'letter_landscape',
            ReceiptPrintProfile::CODE_A5 => 'a5_landscape',
            ReceiptPrintProfile::CODE_THERMAL_80 => 'thermal_80mm',
            ReceiptPrintProfile::CODE_THERMAL_58 => 'thermal_58mm',
        ] as $code => $paperKind) {
            $profile = ReceiptPrintProfile::query()->where('code', $code)->firstOrFail();
            $receipt->forceFill([
                'print_profile_code' => $code,
                'profile_snapshot' => [
                    ...$receipt->profile_snapshot,
                    'code' => $code,
                    'name' => $profile->name,
                    'paper_kind' => $paperKind,
                    'width_mm' => (string) $profile->width_mm,
                    'height_mm' => (string) $profile->height_mm,
                    'font_scale' => (string) $profile->font_scale,
                ],
            ])->save();

            $pdf = app(InstitutionalReceiptPdfService::class)->pdfForReceipt($receipt->fresh());

            $this->assertStringStartsWith('%PDF', $pdf, $code);
            $this->assertGreaterThan(1000, strlen($pdf), $code);
            $this->assertSame($originalReceiptNumber, $receipt->fresh()->receipt_number_full);
            $this->assertSame($originalSeriesSnapshot, $receipt->fresh()->series_snapshot);
            $this->assertSame($originalSeriesCurrentNumber, $context['series']->fresh()->current_number);
        }
    }

    public function test_receipt_pdf_page_matrix_is_bounded_and_monotonic_for_supported_profiles(): void
    {
        $context = $this->createIssuedReceiptContext();
        $receipt = $context['receipt'];
        $baseItem = $receipt->items_snapshot[0];
        $qaOutputDirectory = trim((string) env('RECEIPT_QA_MATRIX_OUTPUT_DIR'));
        $maxPages = [
            ReceiptPrintProfile::CODE_LETTER => 4,
            ReceiptPrintProfile::CODE_HALF_LETTER => 7,
            ReceiptPrintProfile::CODE_A5 => 7,
            ReceiptPrintProfile::CODE_CUSTOM_SMALL => 12,
            ReceiptPrintProfile::CODE_THERMAL_80 => 12,
            ReceiptPrintProfile::CODE_THERMAL_58 => 18,
        ];

        foreach ($maxPages as $code => $maximumPageCount) {
            $profile = ReceiptPrintProfile::query()->where('code', $code)->firstOrFail();
            $previousPageCount = 0;

            foreach ([1, 5, 15, 30, 60] as $itemCount) {
                $receipt->forceFill([
                    'print_profile_code' => $code,
                    'profile_snapshot' => [
                        ...$receipt->profile_snapshot,
                        'code' => $code,
                        'name' => $profile->name,
                        'paper_kind' => $profile->paper_kind,
                        'width_mm' => (string) $profile->width_mm,
                        'height_mm' => (string) $profile->height_mm,
                        'font_scale' => (string) $profile->font_scale,
                    ],
                    'items_snapshot' => collect(range(1, $itemCount))
                        ->map(fn (int $index): array => [
                            ...$baseItem,
                            'service_name' => "Servicio hospitalario {$index}",
                        ])
                        ->all(),
                ])->save();

                $service = app(InstitutionalReceiptPdfService::class);
                $freshReceipt = $receipt->fresh();
                $html = $service->htmlForReceipt($freshReceipt);
                $pdf = $service->pdfForReceipt($freshReceipt);
                $pageCount = preg_match_all('/\/Type\s*\/Page\b/', $pdf);
                $case = "{$code} with {$itemCount} items";

                $this->assertStringStartsWith('%PDF', $pdf, $case);
                foreach (range(1, $itemCount) as $index) {
                    $this->assertSame(
                        1,
                        preg_match_all(
                            '/>\s*'.preg_quote("Servicio hospitalario {$index}", '/').'\s*</u',
                            $html,
                        ),
                        "{$case}: every service must be present exactly once in the shared HTML source",
                    );
                }
                $this->assertMatchesRegularExpression(
                    '/\.items-table\s+thead\s*\{[^}]*display:\s*table-header-group;/s',
                    $html,
                    "{$case}: table header must repeat after a page break",
                );
                $this->assertMatchesRegularExpression(
                    '/\.items-table\s+tbody\s+tr\s*\{[^}]*page-break-inside:\s*avoid;[^}]*break-inside:\s*avoid;/s',
                    $html,
                    "{$case}: service rows must remain indivisible",
                );
                $this->assertMatchesRegularExpression(
                    '/<div class="receipt-summary">.*Monto en letras.*<\/div>\s*<table class="signature-grid">/s',
                    $html,
                    "{$case}: summary and signatures must remain complete and ordered",
                );
                $this->assertGreaterThanOrEqual($previousPageCount, $pageCount, $case);
                $this->assertLessThanOrEqual($maximumPageCount, $pageCount, $case);
                // The 180x95 mm support-only carriage is not the principal
                // delivery and is narrow enough that a complete receipt (header,
                // detail, totals, signature block) can exceed one sheet. The
                // mandate forbids hiding rows or shrinking all the type to force
                // `pages = 1`, so this format is allowed a second sheet. The
                // strict one-page-per-copy guarantee for the principal delivery is
                // asserted on the real engine in InstitutionalReceiptCompactTemplateTest
                // for 1, 5 and 11 ordinary lines (carta vertical and A4).

                if ($qaOutputDirectory !== '') {
                    File::ensureDirectoryExists($qaOutputDirectory);
                    File::put(
                        $qaOutputDirectory.DIRECTORY_SEPARATOR."{$code}-{$itemCount}-items.pdf",
                        $pdf,
                    );
                }

                // The strict one-page-per-copy requirement belongs to the NEW
                // principal delivery (carta vertical / A4 compact). It is asserted
                // on the real engine in InstitutionalReceiptCompactTemplateTest.
                // These landscape/thermal profiles are historical compatibility
                // layouts and only need to stay bounded and monotonic here.

                $previousPageCount = $pageCount;
            }
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
        $this->assertStringNotContainsString('style="color:', $html);
        $this->assertStringContainsString('font-family: Arial, sans-serif;', $html);
    }

    public function test_draft_receipt_rejects_structured_text_and_amount_values(): void
    {
        $context = $this->createIssuedReceiptContext();
        $profile = ReceiptPrintProfile::query()->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)->firstOrFail();

        $html = app(InstitutionalReceiptHtmlBuilder::class)->forDraft([
            'amount' => ['invalid'],
            'payer_name' => ['invalid'],
            'concept' => ['invalid'],
        ], $profile, $context['series']);

        $this->assertStringContainsString('Paciente de prueba', $html);
        $this->assertStringContainsString('Servicios hospitalarios de prueba', $html);
        $this->assertMatchesRegularExpression('/<td>Total<\/td>\s*<td class="money">\s*—\s*<\/td>/', $html);
        $this->assertStringNotContainsString('Array', $html);
    }

    public function test_receipt_html_uses_safe_defaults_for_invalid_profile_snapshot_values(): void
    {
        $context = $this->createIssuedReceiptContext();
        $receipt = $context['receipt'];
        $receipt->forceFill([
            'profile_snapshot' => [
                ...$receipt->profile_snapshot,
                'code' => ['invalid'],
                'font_scale' => ['invalid'],
                'margin_top_mm' => ['invalid'],
                'margin_right_mm' => ['invalid'],
                'margin_bottom_mm' => ['invalid'],
                'margin_left_mm' => ['invalid'],
            ],
            'invoice_snapshot' => [
                ...$receipt->invoice_snapshot,
                'subtotal_cents' => null,
                'subtotal' => ['invalid'],
            ],
        ])->save();

        $html = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($receipt->fresh());

        $this->assertStringContainsString('margin: 6mm 6mm 6mm 6mm;', $html);
        $this->assertStringContainsString('font-size: 10.5px;', $html);
        $this->assertMatchesRegularExpression('/<td>Subtotal<\/td>\s*<td class="money">\s*—\s*<\/td>/', $html);
        $this->assertStringNotContainsString('Array', $html);
    }

    public function test_receipt_pdf_endpoint_requires_permission_streams_pdf_without_recording_event(): void
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
        $this->assertDatabaseMissing('institutional_receipt_print_events', [
            'institutional_receipt_id' => $receipt->id,
        ]);
    }

    public function test_receipt_pdf_uses_safe_content_disposition_filename_when_receipt_number_is_tampered(): void
    {
        $context = $this->createIssuedReceiptContext();
        $user = $context['user'];
        $receipt = $context['receipt'];
        $tamperedReceiptNumber = "../bad\r\nname\"";

        $receipt->forceFill([
            'receipt_number_full' => $tamperedReceiptNumber,
        ])->save();

        Pdf::shouldReceive('loadHTML')
            ->once()
            ->andReturn(tap(\Mockery::mock(DomPdfWrapper::class), function ($pdf): void {
                $pdf->shouldReceive('setPaper')
                    ->once()
                    ->with([0, 0, 612, 396])
                    ->andReturnSelf();
                $pdf->shouldReceive('output')
                    ->once()
                    ->andReturn('%PDF-issued');
            }));

        $response = $this->actingAs($user)
            ->get("/api/institutional-receipts/{$receipt->id}/pdf")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertSee('%PDF-issued', false);

        $contentDisposition = $response->headers->get('Content-Disposition');

        $this->assertSame('inline; filename="recibo-institucional.pdf"', $contentDisposition);
        $this->assertStringNotContainsString('bad', (string) $contentDisposition);
        $this->assertStringNotContainsString("\r", (string) $contentDisposition);
        $this->assertStringNotContainsString("\n", (string) $contentDisposition);
        $this->assertStringNotContainsString('"name', (string) $contentDisposition);
        $this->assertStringNotContainsString('..', (string) $contentDisposition);
        $this->assertSame($tamperedReceiptNumber, $receipt->fresh()->receipt_number_full);
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

    public function test_repeated_receipt_pdf_is_read_only_and_print_events_track_reprints(): void
    {
        $context = $this->createIssuedReceiptContext();
        $user = $context['user'];
        $receipt = $context['receipt'];

        Pdf::shouldReceive('loadHTML')
            ->times(4)
            ->andReturn(tap(\Mockery::mock(DomPdfWrapper::class), function ($pdf): void {
                $pdf->shouldReceive('setPaper')
                    ->times(4)
                    ->with([0, 0, 612, 396])
                    ->andReturnSelf();
                $pdf->shouldReceive('output')
                    ->times(4)
                    ->andReturn('%PDF-issued');
            }));

        $this->actingAs($user)
            ->get("/api/institutional-receipts/{$receipt->id}/pdf")
            ->assertOk();

        $this->actingAs($user)
            ->get("/api/institutional-receipts/{$receipt->id}/pdf")
            ->assertOk();

        $this->actingAs($user)
            ->get("/api/institutional-receipts/{$receipt->id}/pdf?reason=Reposicion%20solicitada")
            ->assertOk();

        $this->actingAs($user)
            ->postJson("/api/institutional-receipts/{$receipt->id}/pdf", [
                'reason' => 'Reposicion solicitada',
            ])
            ->assertOk();

        $this->assertSame(0, $receipt->fresh()->reprint_count);
        $this->assertDatabaseMissing('institutional_receipt_print_events', [
            'institutional_receipt_id' => $receipt->id,
        ]);

        $this->actingAs($user)
            ->postJson("/api/institutional-receipts/{$receipt->id}/print-events")
            ->assertCreated()
            ->assertJsonPath('data.event.event_type', InstitutionalReceiptPrintEvent::TYPE_ISSUED_PRINT)
            ->assertJsonPath('data.receipt.reprint_count', 0);

        $this->actingAs($user)
            ->postJson("/api/institutional-receipts/{$receipt->id}/print-events")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reason');

        $this->actingAs($user)
            ->postJson("/api/institutional-receipts/{$receipt->id}/print-events", [
                'reason' => 'Reposicion solicitada',
            ])
            ->assertCreated()
            ->assertJsonPath('data.event.event_type', InstitutionalReceiptPrintEvent::TYPE_REPRINT)
            ->assertJsonPath('data.receipt.reprint_count', 1);

        $this->assertSame(1, $receipt->fresh()->reprint_count);
        $this->assertDatabaseHas('institutional_receipt_print_events', [
            'institutional_receipt_id' => $receipt->id,
            'event_type' => InstitutionalReceiptPrintEvent::TYPE_REPRINT,
            'reason' => 'Reposicion solicitada',
            'user_id' => $user->id,
        ]);
    }

    public function test_receipt_pdf_post_with_idempotency_header_still_streams_pdf_without_print_audit(): void
    {
        $context = $this->createIssuedReceiptContext();
        $user = $context['user'];
        $receipt = $context['receipt'];

        Pdf::shouldReceive('loadHTML')
            ->times(2)
            ->andReturn(tap(\Mockery::mock(DomPdfWrapper::class), function ($pdf): void {
                $pdf->shouldReceive('setPaper')
                    ->times(2)
                    ->with([0, 0, 612, 396])
                    ->andReturnSelf();
                $pdf->shouldReceive('output')
                    ->times(2)
                    ->andReturn('%PDF-issued');
            }));

        $this->actingAs($user)
            ->get("/api/institutional-receipts/{$receipt->id}/pdf")
            ->assertOk();

        $payload = ['reason' => 'Reposicion solicitada'];
        $this->actingAs($user)
            ->withHeaders(['Idempotency-Key' => 'receipt-pdf-download'])
            ->postJson("/api/institutional-receipts/{$receipt->id}/pdf", $payload)
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertSee('%PDF-issued', false);

        $this->actingAs($user)
            ->withHeaders(['Idempotency-Key' => 'receipt-pdf-download'])
            ->postJson("/api/institutional-receipts/{$receipt->id}/pdf", $payload)
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertHeader('Idempotent-Replay', 'true')
            ->assertSee('%PDF-issued', false);

        $this->assertSame(0, $receipt->fresh()->reprint_count);
        $this->assertDatabaseMissing('institutional_receipt_print_events', [
            'institutional_receipt_id' => $receipt->id,
        ]);
    }

    public function test_locked_print_event_path_requires_reason_when_receipt_already_has_print_event(): void
    {
        $context = $this->createIssuedReceiptContext();
        $user = $context['user'];
        $receipt = $context['receipt'];
        $service = app(InstitutionalReceiptPdfService::class);

        $service->recordReceiptPrintEvent($receipt, $user);

        $this->expectException(ValidationException::class);

        $service->recordReceiptPrintEvent($receipt->fresh(), $user);
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

    public function test_print_event_and_void_do_not_rewrite_the_receipt_issued_at(): void
    {
        $context = $this->createIssuedReceiptContext(copyMode: 'original_only');
        $user = $context['user'];
        $receipt = $context['receipt'];
        $service = app(InstitutionalReceiptPdfService::class);

        // Hecho historico de emision en el pasado (la columna TIMESTAMP expuesta
        // en MariaDB con explicit_defaults_for_timestamp=0).
        $issuedAt = now()->subDays(30)->startOfSecond()->format('Y-m-d H:i:s');
        DB::table('institutional_receipts')->where('id', $receipt->id)->update(['issued_at' => $issuedAt]);

        // Primera entrega + reimpresion (mueve el contador persistente).
        $service->recordReceiptPrintEvent($receipt->fresh(), $user);
        $service->recordReceiptPrintEvent($receipt->fresh(), $user, 'Reposicion por extravio del comprobante');

        $fresh = $receipt->fresh();
        $this->assertSame(1, $fresh->reprint_count);
        $this->assertSame(InstitutionalReceipt::STATUS_ISSUED, $fresh->status);
        $this->assertSame(
            $issuedAt,
            (string) DB::table('institutional_receipts')->where('id', $receipt->id)->value('issued_at'),
            'Reprint must not rewrite institutional_receipts.issued_at',
        );

        // Anulacion: no reemite ni consume correlativo; conserva issued_at.
        $seriesNumberBefore = (int) $context['series']->fresh()->current_number;
        app(VoidInstitutionalReceiptAction::class)->forInvoice(
            $fresh->invoice,
            $user,
            'Recibo anulado por error de impresion en caja',
        );

        $voided = $receipt->fresh();
        $this->assertSame(InstitutionalReceipt::STATUS_VOID, $voided->status);
        $this->assertSame(
            $issuedAt,
            (string) DB::table('institutional_receipts')->where('id', $receipt->id)->value('issued_at'),
            'Void must not rewrite institutional_receipts.issued_at',
        );
        $this->assertSame($seriesNumberBefore, (int) $context['series']->fresh()->current_number);
    }

    private function receiptWithTwoPostedPayments(): InstitutionalReceipt
    {
        $receipt = $this->createIssuedReceiptContext()['receipt'];

        $receipt->forceFill([
            'payment_snapshot' => [
                ...$receipt->payment_snapshot,
                'selected_payment' => null,
                'posted_payments' => [
                    [
                        'method' => Payment::METHOD_CASH,
                        'amount' => '600.00',
                        'amount_cents' => 60000,
                        'reference' => null,
                        'paid_at' => '2026-07-15 08:30:00',
                        'cashier_name' => 'Cajera Uno',
                    ],
                    [
                        'method' => Payment::METHOD_TRANSFER,
                        'amount' => '634.56',
                        'amount_cents' => 63456,
                        'reference' => 'TRX-THERMAL',
                        'paid_at' => '2026-07-15 08:35:00',
                        'cashier_name' => 'Cajera Dos',
                    ],
                ],
            ],
        ])->save();

        return $receipt->fresh();
    }

    private function receiptUsingProfile(InstitutionalReceipt $receipt, string $code): InstitutionalReceipt
    {
        $profile = ReceiptPrintProfile::query()->where('code', $code)->firstOrFail();

        $receipt->forceFill([
            'print_profile_code' => $code,
            'profile_snapshot' => [
                ...$receipt->profile_snapshot,
                'code' => $profile->code,
                'name' => $profile->name,
                'paper_kind' => $profile->paper_kind,
                'width_mm' => (string) $profile->width_mm,
                'height_mm' => (string) $profile->height_mm,
                'margin_top_mm' => (string) $profile->margin_top_mm,
                'margin_right_mm' => (string) $profile->margin_right_mm,
                'margin_bottom_mm' => (string) $profile->margin_bottom_mm,
                'margin_left_mm' => (string) $profile->margin_left_mm,
                'font_family' => $profile->font_family,
                'font_scale' => (string) $profile->font_scale,
                'show_copy_legend' => $profile->show_copy_legend,
                'show_physical_seal_space' => $profile->show_physical_seal_space,
            ],
        ])->save();

        return $receipt->fresh();
    }

    /**
     * @return array{user: User, receipt: InstitutionalReceipt, profile: ReceiptPrintProfile, series: InstitutionalReceiptSeries}
     */
    private function createIssuedReceiptContext(string $copyMode = 'original_only', bool $useLogo = false): array
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        // Fixture de configuracion fiscal: el helper se invoca varias veces por
        // test y `fiscal_settings` es singleton en MariaDB (indice unico de
        // T2-014). updateOrCreate([], ...) reutiliza/actualiza la fila unica en
        // vez de insertar duplicados; el resultado es el mismo en SQLite.
        FiscalSetting::query()->updateOrCreate([], [
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
            'receipt_location' => 'Tocoa, Colón, Honduras',
            'receipt_footer_text' => 'Copia generada desde datos del recibo',
            'phone' => '2444-0000',
        ]);

        $profile = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)
            ->firstOrFail();
        $profile->forceFill([
            'copies_mode' => $copyMode,
            'use_logo' => $useLogo,
            // C2-B7: estas pruebas ejercitan el diseño APAIZADO HISTÓRICO (plantilla
            // `institutional_classic`) sobre media carta, así que lo solicitan
            // explícitamente igual que ya hacen con el papel y las copias. El perfil
            // sembrado adoptó la composición compacta nativa de media carta para los
            // recibos NUEVOS; forzarlo aquí mantiene intacto el contrato clásico que
            // estas pruebas documentan, sin tocar ningún assert.
            'template_code' => 'institutional_classic',
        ])->save();

        // C1-RCP-02: media carta ya no es el predeterminado de una instalación
        // nueva (ahora lo es carta vertical). Estas pruebas ejercitan el diseño
        // apaisado histórico, así que lo solicitan EXPLÍCITAMENTE usando el mismo
        // mecanismo del producto: un único `is_global_default`. No es un atajo de
        // test, es la configuración que una instalación existente ya tiene.
        ReceiptPrintProfile::query()
            ->whereKeyNot($profile->id)
            ->where('is_global_default', true)
            ->get()
            ->each(fn (ReceiptPrintProfile $previousDefault) => $previousDefault
                ->forceFill(['is_global_default' => false])
                ->save());
        $profile->forceFill(['is_global_default' => true])->save();

        $user = User::factory()->create(['name' => 'Cajera Uno']);
        $user->assignRole('cajero');

        $sequence = FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => '000-001-01',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 1,
            'cai' => 'CAI-TEST-RECEIPT-PDF-'.bin2hex(random_bytes(3)),
            'valid_until' => '2027-12-31',
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
            'fiscal_cai' => $sequence->cai,
            'fiscal_range_from' => '000-001-01-00000001',
            'fiscal_range_to' => '000-001-01-99999999',
            'fiscal_valid_until' => $sequence->valid_until,
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
