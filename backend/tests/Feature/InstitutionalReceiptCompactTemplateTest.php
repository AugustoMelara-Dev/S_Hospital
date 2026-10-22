<?php

namespace Tests\Feature;

use App\Actions\InstitutionalReceipts\AdoptCompactReceiptTemplateAction;
use App\Actions\InstitutionalReceipts\InstitutionalReceiptPdfService;
use App\Models\CashRegisterSession;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptSeries;
use App\Models\ReceiptPrintProfile;
use App\Models\User;
use App\Support\PaperSize;
use Barryvdh\DomPDF\Facade\Pdf;
use Database\Seeders\ReceiptPrintProfileSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

/**
 * T-RC-01 — NEW institutional receipt template (mentate §11).
 *
 * The principal delivery is carta vertical (215.9 x 279.4 mm = 612 x 792 pt)
 * with A4 as an administrative alternative. One patient copy is the default.
 * These tests assert the REAL Dompdf engine: page counts come from
 * `getCanvas()->get_page_count()`, and the readable window is measured from the
 * font-size operators of the produced PDF, never from the HTML source.
 */
class InstitutionalReceiptCompactTemplateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);
    }

    public function test_compact_template_renders_institutional_fields_and_no_forbidden_codes(): void
    {
        $receipt = $this->receiptFixture(items: $this->ordinaryItems(3));
        $html = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($receipt);

        foreach ([
            'Gobierno de Honduras',
            'Secretaría de Salud',
            'Hospital General San Isidro',
            'Tocoa, Colón, Honduras',
            'Recibo institucional',
            'Recibo No.',
            'Paciente',
            'María López de la Cruz con nombre largo para envolver',
            'Fecha y hora',
            '15/07/2026 08:30',
            'Factura',
            'INV-COMPACT-00000001',
            'Cajero',
            'Cajera Compacta',
            'Caja',
            'Caja #1',
            'Detalle de servicios',
            'Cantidad',
            'Precio unitario',
            'Ajuste autorizado',
            'Importe',
            'Situación del pago',
            'Pagado',
            'Método aplicable',
            'Efectivo',
            'Subtotal',
            'Exento',
            'ISV 15.00%',
            'Total',
            'Monto en letras',
            'Firma del enterante',
            'Sello y firma autorizada',
            'ORIGINAL',
        ] as $needle) {
            $this->assertStringContainsString($needle, $html);
        }

        $this->assertStringContainsString($receipt->receipt_number_full, $html);
        $this->assertStringContainsString('data-receipt-style="compact-monochrome"', $html);
        $this->assertStringContainsString('class="receipt-layout profile-carta_vertical"', $html);
        // Dompdf cannot break inside a row, but the document itself must flow.
        $this->assertStringContainsString('.items-table thead', $html);
        $this->assertStringContainsString('display: table-header-group', $html);
        $this->assertStringContainsString('page-break-inside: avoid', $html);
        $this->assertDoesNotMatchRegularExpression(
            '/\.receipt-page\s*\{[^}]*page-break-inside:\s*avoid/s',
            $html,
            'The whole receipt must never be one indivisible block.',
        );

        foreach (['qr_code', 'barcode', 'scan_code', 'print_profile_code', 'audit', 'user_id'] as $forbidden) {
            $this->assertStringNotContainsString($forbidden, $html);
        }
    }

    public function test_compact_template_never_invents_fiscal_identity(): void
    {
        $receipt = $this->receiptFixture(items: $this->ordinaryItems(2));
        $institution = $receipt->institution_snapshot;
        $institution['rtn'] = '';
        $institution['phone'] = '';
        $invoice = $receipt->invoice_snapshot;
        $invoice['fiscal_cai'] = null;
        $invoice['fiscal_range_from'] = null;
        $invoice['fiscal_range_to'] = null;
        $invoice['fiscal_valid_until'] = null;
        $receipt->forceFill([
            'institution_snapshot' => $institution,
            'invoice_snapshot' => $invoice,
        ])->save();

        $html = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($receipt->fresh());

        foreach (['RTN', 'Tel.', 'CAI', 'Rango autorizado', 'Límite de emisión'] as $invented) {
            $this->assertStringNotContainsString($invented, $html);
        }
    }

    public function test_one_page_per_copy_for_the_mandated_line_counts_on_letter_portrait(): void
    {
        $profile = $this->portraitProfile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);

        // Mandate §11: 1, 2, 5, 10 and 11 ordinary concepts must each fit ONE
        // page per copy with readable detail, measured on the real engine.
        foreach ([1, 2, 5, 10, 11] as $itemCount) {
            $receipt = $this->receiptFixture(items: $this->ordinaryItems($itemCount), profile: $profile);
            $html = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($receipt);
            $pdf = app(InstitutionalReceiptPdfService::class)->pdfForReceipt($receipt);

            // Every line is present exactly once: nothing is hidden to fit a page.
            for ($index = 1; $index <= $itemCount; $index++) {
                $this->assertSame(
                    1,
                    preg_match_all('/>\s*'.preg_quote("Servicio hospitalario {$index}", '/').'\s*</u', $html),
                    "carta vertical with {$itemCount} items: line {$index} must appear exactly once",
                );
            }

            $enginePages = $this->renderedPageCount($html, $profile);
            $this->assertSame(1, $enginePages, "carta vertical with {$itemCount} ordinary lines must fit ONE page per copy");
            // Cross-check the real emitted document.
            $this->assertSame(1, $this->bytePageCount($pdf), "carta vertical with {$itemCount} ordinary lines (emitted PDF)");
        }
    }

    public function test_free_line_stays_visible_and_recognizable_without_altering_the_other_lines(): void
    {
        $items = $this->ordinaryItems(10);
        // The rule-adjusted line keeps its place in the detail with a zero import.
        $items[] = $this->lineItem('Eritropoyetina', free: true);

        $profile = $this->portraitProfile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);
        $receipt = $this->receiptFixture(items: $items, profile: $profile);
        $html = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($receipt);
        $pdf = app(InstitutionalReceiptPdfService::class)->pdfForReceipt($receipt);

        // The free line is explicit and unmistakable...
        $this->assertStringContainsString('Eritropoyetina', $html);
        $this->assertSame(1, substr_count($html, 'Sin cobro'), 'Exactly the free line is marked as free');
        $this->assertSame(1, preg_match_all('/>\s*Sin cobro\s*</u', $html), 'The free tag belongs to one line');

        // ...and the other eleven lines keep their own price and import untouched.
        foreach ($this->ordinaryItems(10) as $item) {
            $this->assertStringContainsString('L. '.$item['line_total'], $html);
        }

        $this->assertSame(1, $this->renderedPageCount($html, $profile), '11 lines including one free must fit one page');
        $this->assertSame(1, $this->bytePageCount($pdf));
    }

    public function test_authorized_adjustment_column_prints_only_proven_values_and_keeps_one_page(): void
    {
        $profile = $this->portraitProfile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);

        // A receipt where NO line proves an adjustment: the column stays empty,
        // no fabricated L. 0.00 discount is printed.
        $plain = $this->receiptFixture(items: $this->ordinaryItems(3), profile: $profile);
        $plainHtml = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($plain);
        $this->assertStringContainsString('Ajuste autorizado', $plainHtml);
        $this->assertStringNotContainsString('- L. ', $plainHtml, 'A normal line must not invent an adjustment.');

        // The rule-adjusted line as the emission snapshot carries it once billing
        // persists the registered price and the adjustment (EPO gratuity): the
        // adjustment is the registered amount minus the applied one.
        $items = $this->ordinaryItems(10);
        $items[] = $this->lineItem('Eritropoyetina', unitPriceCents: 0, free: true) + [
            'unit_price_registered' => '25.00',
            'unit_price_registered_cents' => 2500,
            'rule_adjustment' => '25.00',
            'rule_adjustment_cents' => 2500,
        ];

        $receipt = $this->receiptFixture(items: $items, profile: $profile);
        $html = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($receipt);
        $pdf = app(InstitutionalReceiptPdfService::class)->pdfForReceipt($receipt);

        // Exactly one line proves an adjustment, and the free line keeps its tag
        // and its own L. 0.00 importe.
        $this->assertSame(1, preg_match_all('/- L\. 25\.00/u', $html));
        $this->assertSame(1, substr_count($html, 'Sin cobro'));
        $this->assertStringContainsString('L. 0.00', $html);

        // The populated column must not cost the page budget: 11 lines, one page.
        $this->assertSame(1, $this->renderedPageCount($html, $profile));
        $this->assertSame(1, $this->bytePageCount($pdf));
    }

    public function test_a4_portrait_compact_fits_eleven_ordinary_lines_on_one_page(): void
    {
        $profile = $this->portraitProfile(ReceiptPrintProfile::CODE_A4_PORTRAIT);
        $receipt = $this->receiptFixture(items: $this->ordinaryItems(11), profile: $profile);
        $html = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($receipt);

        $this->assertStringContainsString('class="receipt-layout profile-a4_vertical"', $html);
        $this->assertSame(1, $this->renderedPageCount($html, $profile), 'A4 with 11 ordinary lines must fit one page');
        $this->assertSame(
            $this->renderedPageCount($html, $profile),
            $this->bytePageCount(app(InstitutionalReceiptPdfService::class)->pdfForReceipt($receipt)),
        );
    }

    public function test_explicit_extra_copies_still_render_one_page_per_copy(): void
    {
        $profile = $this->portraitProfile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);
        $receipt = $this->receiptFixture(
            items: $this->ordinaryItems(11),
            profile: $profile,
            copyMode: 'original_first',
        );
        $html = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($receipt);

        // ORIGINAL + PRIMERA COPIA: an explicit selection, one page per copy.
        $this->assertStringContainsString('ORIGINAL', $html);
        $this->assertStringContainsString('PRIMERA COPIA', $html);
        $this->assertSame(2, $this->renderedPageCount($html, $profile));
        $this->assertSame(2, $this->bytePageCount(app(InstitutionalReceiptPdfService::class)->pdfForReceipt($receipt)));
    }

    public function test_compact_detail_text_is_readable_on_the_real_engine(): void
    {
        $profile = $this->portraitProfile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);
        $receipt = $this->receiptFixture(items: $this->ordinaryItems(11), profile: $profile);
        $pdf = app(InstitutionalReceiptPdfService::class)->pdfForReceipt($receipt);

        $histogram = [];
        foreach ($this->fontSizesFromPdf($pdf) as $size) {
            $key = number_format($size, 2, '.', '');
            $histogram[$key] = ($histogram[$key] ?? 0) + 1;
        }

        $this->assertNotEmpty($histogram, 'The real PDF must expose font-size operators.');
        arsort($histogram);
        $mostUsed = (float) array_key_first($histogram);

        // Dompdf converts CSS px to pt at 0.75, so the 14px detail is ~10.5 pt.
        $this->assertGreaterThanOrEqual(9.5, $mostUsed, 'Detail text must not regress below the readable window.');
        $this->assertLessThanOrEqual(11.5, $mostUsed, 'Detail text must stay within the mandated 10-11 pt window.');
    }

    public function test_admin_can_save_the_compact_profile_and_invalid_templates_are_rejected(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        // Reject an unknown template code instead of leaving a broken select.
        $this->actingAs($admin)
            ->patchJson("/api/settings/institutional-receipts/print-profiles/{$this->halfLetterProfile()->id}", [
                'template_code' => 'institutional_bogus',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('template_code');

        // Save -> reload -> a new document uses the saved result.
        $this->actingAs($admin)
            ->patchJson("/api/settings/institutional-receipts/print-profiles/{$this->halfLetterProfile()->id}", [
                'template_code' => 'institutional_compact',
                'copies_mode' => 'original_only',
            ])
            ->assertOk()
            ->assertJsonPath('data.template_code', 'institutional_compact')
            ->assertJsonPath('data.copies_mode', 'original_only');

        $this->actingAs($admin)
            ->getJson('/api/settings/institutional-receipts')
            ->assertOk();

        $this->assertDatabaseHas('receipt_print_profiles', [
            'id' => $this->halfLetterProfile()->id,
            'template_code' => 'institutional_compact',
            'copies_mode' => 'original_only',
        ]);

        $reloaded = $this->halfLetterProfile();
        $draft = app(InstitutionalReceiptPdfService::class)->htmlForDraft([
            'payer_name' => 'Paciente de prueba',
            'concept' => 'Servicios de prueba',
            'amount' => '25.00',
        ], $reloaded);

        $this->assertStringContainsString('data-receipt-style="compact-monochrome"', $draft);
        $this->assertStringNotContainsString('SEGUNDA COPIA', $draft);
    }

    public function test_existing_portrait_profile_is_adopted_without_changing_copies_or_issued_receipts(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $portrait = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_LETTER_PORTRAIT)
            ->firstOrFail();

        // Simulate an installation seeded by the previous delivery: classic template
        // and the old three-copy proposal on the portrait row.
        $portrait->forceFill([
            'template_code' => 'institutional_classic',
            'copies_mode' => 'original_first_second',
        ])->save();

        $issued = $this->receiptFixture(
            items: $this->ordinaryItems(2),
            profile: $portrait->fresh(),
            templateCode: 'institutional_classic',
        );
        $issuedRow = $issued->fresh()->toArray();

        $adopted = app(AdoptCompactReceiptTemplateAction::class)->execute();

        $fresh = $portrait->fresh();
        $this->assertSame(1, $adopted);
        $this->assertSame('institutional_compact', $fresh->template_code);
        $this->assertSame('original_first_second', $fresh->copies_mode, 'Adoption never changes the configured copy count.');
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'receipt_print_profile.template_adopted',
            'entity_type' => ReceiptPrintProfile::class,
            'entity_id' => $portrait->id,
        ]);

        // Idempotent and already-issued receipts untouched.
        $this->assertSame(0, app(AdoptCompactReceiptTemplateAction::class)->execute());
        $this->assertSame($issuedRow, $issued->fresh()->toArray());

        // The historical receipt keeps rendering its own classic composition.
        $historicalHtml = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($issued->fresh());
        $this->assertStringContainsString('data-receipt-style="minimal-monochrome"', $historicalHtml);
        $this->assertStringNotContainsString('data-receipt-style="compact-monochrome"', $historicalHtml);
    }

    public function test_compact_evidence_pdfs_are_written_when_output_dir_is_configured(): void
    {
        $outputDirectory = trim((string) env('RECEIPT_COMPACT_EVIDENCE_DIR'));

        if ($outputDirectory === '') {
            $this->markTestSkipped('Set RECEIPT_COMPACT_EVIDENCE_DIR to write T-RC-01 evidence PDFs.');
        }

        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $service = app(InstitutionalReceiptPdfService::class);
        File::ensureDirectoryExists($outputDirectory);

        $cases = [
            'carta_vertical-01-linea' => [ReceiptPrintProfile::CODE_LETTER_PORTRAIT, $this->ordinaryItems(1)],
            'carta_vertical-02-lineas' => [ReceiptPrintProfile::CODE_LETTER_PORTRAIT, $this->ordinaryItems(2)],
            'carta_vertical-05-lineas' => [ReceiptPrintProfile::CODE_LETTER_PORTRAIT, $this->ordinaryItems(5)],
            'carta_vertical-10-lineas' => [ReceiptPrintProfile::CODE_LETTER_PORTRAIT, $this->ordinaryItems(10)],
            'carta_vertical-11-lineas' => [ReceiptPrintProfile::CODE_LETTER_PORTRAIT, $this->ordinaryItems(11)],
            'a4_vertical-11-lineas' => [ReceiptPrintProfile::CODE_A4_PORTRAIT, $this->ordinaryItems(11)],
        ];

        $summary = [];
        foreach ($cases as $name => [$code, $items]) {
            $profile = $this->portraitProfile($code);
            $receipt = $this->receiptFixture(items: $items, profile: $profile);
            $html = $service->htmlForReceipt($receipt);
            $pdf = $service->pdfForReceipt($receipt);
            File::put($outputDirectory.DIRECTORY_SEPARATOR."{$name}.pdf", $pdf);

            $box = $this->firstMediaBox($pdf);
            $summary[] = sprintf(
                '%s: %.2f x %.2f pt, %d page(s), %d bytes',
                $name,
                $box[2],
                $box[3],
                $this->renderedPageCount($html, $profile),
                strlen($pdf),
            );
        }

        $freeItems = $this->ordinaryItems(10);
        // The rule-adjusted line as billing persists it: registered price plus the
        // authorized adjustment, applied price zero. The evidence PDF must show all
        // three at once (tag "Sin cobro", ajuste autorizado, importe L. 0.00).
        $freeItems[] = $this->lineItem('Eritropoyetina', free: true) + [
            'unit_price_registered' => '25.00',
            'unit_price_registered_cents' => 2500,
            'rule_adjustment' => '25.00',
            'rule_adjustment_cents' => 2500,
        ];
        $letter = $this->portraitProfile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);
        $freeReceipt = $this->receiptFixture(items: $freeItems, profile: $letter);
        $freeHtml = $service->htmlForReceipt($freeReceipt);
        $freePdf = $service->pdfForReceipt($freeReceipt);
        File::put($outputDirectory.DIRECTORY_SEPARATOR.'carta_vertical-gratuita.pdf', $freePdf);
        $box = $this->firstMediaBox($freePdf);
        $summary[] = sprintf(
            'carta_vertical-gratuita: %.2f x %.2f pt, %d page(s), %d bytes (linea gratuita + ajuste autorizado - L. 25.00)',
            $box[2],
            $box[3],
            $this->renderedPageCount($freeHtml, $letter),
            strlen($freePdf),
        );

        // Explicit extra copies: ORIGINAL + PRIMERA COPIA with 11 concepts must
        // stay one page PER COPY (two physical pages), never a squeezed set.
        $twoCopyReceipt = $this->receiptFixture(
            items: $this->ordinaryItems(11),
            profile: $letter,
            copyMode: 'original_first',
        );
        $twoCopyHtml = $service->htmlForReceipt($twoCopyReceipt);
        $twoCopyPdf = $service->pdfForReceipt($twoCopyReceipt);
        File::put($outputDirectory.DIRECTORY_SEPARATOR.'carta_vertical-11-lineas-dos-copias.pdf', $twoCopyPdf);
        $box = $this->firstMediaBox($twoCopyPdf);
        $summary[] = sprintf(
            'carta_vertical-11-lineas-dos-copias: %.2f x %.2f pt, %d page(s) (engine), %d page(s) (emitted PDF), %d bytes',
            $box[2],
            $box[3],
            $this->renderedPageCount($twoCopyHtml, $letter),
            $this->bytePageCount($twoCopyPdf),
            strlen($twoCopyPdf),
        );

        File::put($outputDirectory.DIRECTORY_SEPARATOR.'resumen.txt', implode(PHP_EOL, $summary).PHP_EOL);

        $this->assertFileExists($outputDirectory.DIRECTORY_SEPARATOR.'carta_vertical-11-lineas.pdf');
        $this->assertFileExists($outputDirectory.DIRECTORY_SEPARATOR.'carta_vertical-gratuita.pdf');
        $this->assertFileExists($outputDirectory.DIRECTORY_SEPARATOR.'carta_vertical-11-lineas-dos-copias.pdf');
    }

    // ------------------------------------------------------------------
    // Fixtures
    // ------------------------------------------------------------------

    private function portraitProfile(string $code): ReceiptPrintProfile
    {
        return ReceiptPrintProfile::query()->where('code', $code)->firstOrFail();
    }

    private function halfLetterProfile(): ReceiptPrintProfile
    {
        return ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)
            ->firstOrFail();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function ordinaryItems(int $count): array
    {
        $items = [];

        for ($index = 1; $index <= $count; $index++) {
            $items[] = $this->lineItem("Servicio hospitalario {$index}", unitPriceCents: 10000 + $index);
        }

        return $items;
    }

    /**
     * @return array<string, mixed>
     */
    private function lineItem(string $name, int $unitPriceCents = 2500, bool $free = false): array
    {
        $unit = $free ? 0 : $unitPriceCents;
        $money = number_format($unit / 100, 2, '.', '');

        return [
            'service_name' => $name,
            'category_name' => 'Consulta',
            'area_name' => 'Caja',
            'quantity' => '1.00',
            'unit_price' => $money,
            'unit_price_cents' => $unit,
            'tax_rate' => '0.00',
            'tax_amount' => '0.00',
            'tax_amount_cents' => 0,
            'line_subtotal' => $money,
            'line_subtotal_cents' => $unit,
            'line_total' => $money,
            'line_total_cents' => $unit,
            'notes' => null,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $items
     */
    private function receiptFixture(
        array $items,
        ?ReceiptPrintProfile $profile = null,
        string $copyMode = 'original_only',
        string $templateCode = 'institutional_compact',
    ): InstitutionalReceipt {
        $profile ??= $this->portraitProfile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);

        $user = User::factory()->create(['name' => 'Cajera Compacta']);
        $user->assignRole('cajero');

        $cashSession = CashRegisterSession::query()->create([
            'user_id' => $user->id,
            'open_user_id' => $user->id,
            'opening_amount' => '100.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        $series = InstitutionalReceiptSeries::query()->create([
            'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
            'series' => 'REC-C',
            'prefix' => 'RC',
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'max_number' => 999999,
            'current_number' => 0,
            'range_authorization' => 'AUT-REC-COMPACT',
            'legal_text' => 'Suscribe. CERTIFICA haber enterado en esta oficina la suma de',
            'active' => false,
        ]);

        $totalCents = array_sum(array_map(
            static fn (array $item): int => (int) $item['line_total_cents'],
            $items,
        ));
        $total = number_format($totalCents / 100, 2, '.', '');

        $receiptNumber = random_int(1, 99999999);

        return InstitutionalReceipt::query()->create([
            'invoice_id' => null,
            'payment_id' => null,
            'cash_session_id' => $cashSession->id,
            'series_id' => $series->id,
            'receipt_number' => $receiptNumber,
            'receipt_number_full' => 'REC-C'.str_pad((string) $receiptNumber, 8, '0', STR_PAD_LEFT),
            'status' => InstitutionalReceipt::STATUS_ISSUED,
            'amount' => $total,
            'amount_cents' => $totalCents,
            'issued_at' => Carbon::parse('2026-07-15 08:30:00'),
            'issued_by' => $user->id,
            'payer_name' => 'María López de la Cruz con nombre largo para envolver',
            'concept' => 'Servicios hospitalarios de prueba',
            'amount_words' => 'CIENTO VEINTICINCO LEMPIRAS CON 00/100 CENTAVOS',
            'template_code' => $templateCode,
            'print_profile_code' => $profile->code,
            'copy_mode' => $copyMode,
            'institution_snapshot' => [
                'government_line' => 'Gobierno de Honduras',
                'secretariat_line' => 'Secretaría de Salud',
                'hospital_name' => 'Hospital General San Isidro',
                'address' => 'Tocoa, Colón',
                'rtn' => '08011999123456',
                'phone' => '2444-0000',
                'receipt_location' => 'Tocoa, Colón, Honduras',
                'receipt_footer_text' => 'Copia generada desde datos del recibo',
                'logo_data_uri' => null,
            ],
            'series_snapshot' => [
                'series' => $series->series,
                'receipt_number_full' => 'REC-C'.str_pad((string) $receiptNumber, 8, '0', STR_PAD_LEFT),
                'receipt_number_color' => '#b91c1c',
                'legal_text' => 'Suscribe. CERTIFICA haber enterado en esta oficina la suma de',
                'range_authorization' => 'AUT-REC-COMPACT',
            ],
            'profile_snapshot' => [
                'code' => $profile->code,
                'name' => $profile->name,
                'font_family' => $profile->font_family,
                'font_scale' => (string) $profile->font_scale,
                'margin_top_mm' => (string) $profile->margin_top_mm,
                'margin_right_mm' => (string) $profile->margin_right_mm,
                'margin_bottom_mm' => (string) $profile->margin_bottom_mm,
                'margin_left_mm' => (string) $profile->margin_left_mm,
                'paper_kind' => $profile->paper_kind,
                'width_mm' => (string) $profile->width_mm,
                'height_mm' => (string) $profile->height_mm,
                'orientation' => $profile->orientation,
                'show_copy_legend' => (bool) $profile->show_copy_legend,
                'show_physical_seal_space' => (bool) $profile->show_physical_seal_space,
            ],
            'invoice_snapshot' => [
                'invoice_number' => 'INV-COMPACT-00000001',
                'fiscal_cai' => null,
                'fiscal_range_from' => null,
                'fiscal_range_to' => null,
                'fiscal_valid_until' => null,
                'patient_name' => 'María López',
                'issued_at' => '2026-07-15T08:30:00-06:00',
                'tax_label' => 'ISV',
                'tax_rate_snapshot' => '15.00',
                'subtotal_cents' => $totalCents,
                'exempt_amount_cents' => $totalCents,
                'tax_amount_cents' => 0,
                'discount_amount_cents' => 0,
                'total_cents' => $totalCents,
                'paid_amount_cents' => $totalCents,
                'balance_due_cents' => 0,
            ],
            'payment_snapshot' => [
                'selected_payment' => [
                    'method' => 'cash',
                    'amount' => $total,
                    'amount_cents' => $totalCents,
                    'reference' => null,
                    'paid_at' => '2026-07-15T08:30:00-06:00',
                    'cashier_name' => 'Cajera Compacta',
                ],
                'posted_payments' => [],
                'cash_context' => [
                    'cash_register_label' => 'Caja #1',
                    'cashier_name' => 'Cajera Compacta',
                    'opened_at' => '2026-07-15T08:00:00-06:00',
                ],
                'issued_by' => ['name' => 'Cajera Compacta'],
            ],
            'items_snapshot' => $items,
            'reprint_count' => 0,
        ]);
    }

    // ------------------------------------------------------------------
    // Real-engine measurement
    // ------------------------------------------------------------------

    private function renderedPageCount(string $html, ReceiptPrintProfile $profile): int
    {
        $wrapper = Pdf::loadHTML($html);
        $wrapper->setPaper(PaperSize::fromProfile($profile));
        $dompdf = $wrapper->getDomPDF();
        $dompdf->render();

        return $dompdf->getCanvas()->get_page_count();
    }

    private function bytePageCount(string $pdf): int
    {
        return preg_match_all('/\/Type\s*\/Page\b/', $pdf);
    }

    /**
     * @return list<float>
     */
    private function fontSizesFromPdf(string $pdf): array
    {
        if (! preg_match_all('/stream\r?\n(.*?)endstream/s', $pdf, $streamMatches)) {
            return [];
        }

        $sizes = [];

        foreach ($streamMatches[1] as $rawStream) {
            $decoded = @gzuncompress($rawStream);
            $content = $decoded === false ? $rawStream : $decoded;

            if (preg_match_all('/([0-9]+(?:\.[0-9]+)?)\s+Tf/', $content, $fontMatches)) {
                foreach ($fontMatches[1] as $size) {
                    $sizes[] = (float) $size;
                }
            }
        }

        return $sizes;
    }

    /**
     * @return array{0: float, 1: float, 2: float, 3: float}
     */
    private function firstMediaBox(string $pdf): array
    {
        $this->assertSame(1, preg_match('/\/MediaBox\s*\[([^\]]+)\]/', $pdf, $matches));

        $values = array_values(array_filter(
            preg_split('/\s+/', trim($matches[1])) ?: [],
            static fn (string $value): bool => $value !== '',
        ));

        return array_map(static fn (string $value): float => (float) $value, $values);
    }
}
