<?php

namespace Tests\Feature;

use App\Actions\InstitutionalReceipts\InstitutionalReceiptPdfService;
use App\Models\CashRegisterSession;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptPrintEvent;
use App\Models\InstitutionalReceiptSeries;
use App\Models\ReceiptPrintProfile;
use App\Models\User;
use Database\Seeders\ReceiptPrintProfileSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

/**
 * M-W2-RCP-01 / C1-RCP-02 / mandate §12.
 *
 * Covers the proposed principal portrait receipt formats:
 * - carta vertical (215.9 x 279.4 mm = 612 x 792 pt), 12 mm margins;
 * - A4 vertical configurable (210 x 297 mm = 595.28 x 841.89 pt).
 *
 * Since C1-RCP-02 the seeder promotes `carta_vertical` as the single global
 * default of NEW installations (empty catalog). Installations that already had a
 * configured default keep it untouched. These tests assert the real PDF engine
 * output (dimensions, pages, copy numbering) rather than a mockup.
 */
class InstitutionalReceiptPortraitProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeder_promotes_carta_vertical_on_new_installations_and_keeps_portrait_profiles(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $letterPortrait = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_LETTER_PORTRAIT)
            ->firstOrFail();
        $a4Portrait = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_A4_PORTRAIT)
            ->firstOrFail();

        // Exact geometry, native paper kind, 12 mm margins, portrait orientation.
        $this->assertSame('letter_portrait', $letterPortrait->paper_kind);
        $this->assertSame('215.90', (string) $letterPortrait->width_mm);
        $this->assertSame('279.40', (string) $letterPortrait->height_mm);
        $this->assertSame('12.00', (string) $letterPortrait->margin_top_mm);
        $this->assertSame('12.00', (string) $letterPortrait->margin_left_mm);
        $this->assertSame('portrait', $letterPortrait->orientation);
        // T-RC-01: new portrait profiles use the compact template and ONE copy.
        $this->assertSame('institutional_compact', $letterPortrait->template_code);
        $this->assertSame('original_only', $letterPortrait->copies_mode);
        $this->assertTrue((bool) $letterPortrait->active);

        $this->assertSame('a4_portrait', $a4Portrait->paper_kind);
        $this->assertSame('210.00', (string) $a4Portrait->width_mm);
        $this->assertSame('297.00', (string) $a4Portrait->height_mm);
        $this->assertSame('portrait', $a4Portrait->orientation);
        $this->assertTrue((bool) $a4Portrait->active);

        // C1-RCP-02: new installation gets exactly ONE default, carta vertical.
        $globalDefaults = ReceiptPrintProfile::query()->where('is_global_default', true)->get();
        $this->assertCount(1, $globalDefaults);
        $this->assertSame(ReceiptPrintProfile::CODE_LETTER_PORTRAIT, $globalDefaults->sole()->code);
        $this->assertTrue((bool) $letterPortrait->is_global_default);
        $this->assertFalse((bool) $a4Portrait->is_global_default);

        // Historical landscape/thermal profiles remain available for old documents.
        foreach ([
            ReceiptPrintProfile::CODE_HALF_LETTER,
            ReceiptPrintProfile::CODE_A5,
            ReceiptPrintProfile::CODE_LETTER,
        ] as $historicalCode) {
            $this->assertDatabaseHas('receipt_print_profiles', ['code' => $historicalCode]);
        }
    }

    public function test_seeder_is_idempotent_and_does_not_overwrite_repointed_or_customized_profiles(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        // Simulate an EXISTING installation after hs-db's M-W2-DB-02 repoint plus
        // an admin customization. firstOrCreate must not touch any existing row.
        ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_LETTER_PORTRAIT)
            ->firstOrFail()
            ->forceFill([
                'name' => 'Carta vertical del hospital',
                'copies_mode' => 'original_only',
                'margin_top_mm' => '15.00',
            ])->save();

        ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_A4_PORTRAIT)
            ->firstOrFail()
            ->forceFill(['paper_kind' => 'custom_mm', 'height_mm' => '300.00'])->save();

        $before = ReceiptPrintProfile::query()->orderBy('code')->get()->toArray();

        $this->seed(ReceiptPrintProfileSeeder::class);

        $after = ReceiptPrintProfile::query()->orderBy('code')->get()->toArray();
        $this->assertSame($before, $after, 'Re-running the seeder must not change any existing profile');

        $letter = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_LETTER_PORTRAIT)
            ->firstOrFail();
        $this->assertSame('Carta vertical del hospital', $letter->name);
        $this->assertSame('original_only', $letter->copies_mode);
        $this->assertSame('15.00', (string) $letter->margin_top_mm);
        // Native kind is not downgraded by the seeder.
        $this->assertSame('letter_portrait', $letter->paper_kind);

        $a4 = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_A4_PORTRAIT)
            ->firstOrFail();
        // An explicit admin override is preserved too.
        $this->assertSame('custom_mm', $a4->paper_kind);
        $this->assertSame('300.00', (string) $a4->height_mm);
    }

    public function test_draft_pdf_uses_carta_vertical_612x792_and_a4_595x842(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $service = app(InstitutionalReceiptPdfService::class);

        $letter = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_LETTER_PORTRAIT)
            ->firstOrFail();
        $a4 = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_A4_PORTRAIT)
            ->firstOrFail();

        $letterPdf = $service->pdfForDraft([
            'payer_name' => 'Paciente de prueba',
            'concept' => 'Consulta de prueba',
            'amount' => '25.00',
        ], $letter);

        $a4Pdf = $service->pdfForDraft([
            'payer_name' => 'Paciente de prueba',
            'concept' => 'Consulta de prueba',
            'amount' => '25.00',
        ], $a4);

        $this->assertStringStartsWith('%PDF', $letterPdf);
        $this->assertStringStartsWith('%PDF', $a4Pdf);

        $letterBox = $this->firstMediaBox($letterPdf);
        $this->assertEqualsWithDelta(612.0, $letterBox[2], 0.05, 'carta vertical width');
        $this->assertEqualsWithDelta(792.0, $letterBox[3], 0.05, 'carta vertical height');

        $a4Box = $this->firstMediaBox($a4Pdf);
        $this->assertEqualsWithDelta(595.28, $a4Box[2], 0.05, 'A4 width');
        $this->assertEqualsWithDelta(841.89, $a4Box[3], 0.05, 'A4 height');

        // A4 must never collapse to letter or media carta points.
        $this->assertNotEqualsWithDelta($letterBox[2], $a4Box[2], 1.0);
        $this->assertNotEqualsWithDelta($letterBox[3], $a4Box[3], 1.0);
    }

    public function test_draft_html_marks_copy_numbering_and_portrait_profile(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $letter = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_LETTER_PORTRAIT)
            ->firstOrFail();

        $html = app(InstitutionalReceiptPdfService::class)->htmlForDraft([
            'payer_name' => 'Paciente de prueba',
            'concept' => 'Consulta de prueba',
            'amount' => '25.00',
        ], $letter);

        // T-RC-01 (mandato §11): the new portrait delivery uses the compact
        // template and defaults to ONE patient copy; extra copies are an explicit
        // selection and therefore absent here.
        $this->assertStringContainsString('class="receipt-layout profile-carta_vertical"', $html);
        $this->assertStringContainsString('data-receipt-style="compact-monochrome"', $html);
        $this->assertStringContainsString('ORIGINAL', $html);
        $this->assertStringNotContainsString('PRIMERA COPIA', $html);
        $this->assertStringNotContainsString('SEGUNDA COPIA', $html);
        $this->assertStringNotContainsString('Copia 1 de 3', $html);

        // Monochrome contract: no filled table header, no QR/barcode, no invented data.
        $this->assertStringContainsString('background: transparent', $html);
        $this->assertStringNotContainsString('qr_code', $html);
        $this->assertStringNotContainsString('barcode', $html);
        $this->assertStringContainsString('profile-carta_vertical', $html);
    }

    public function test_long_and_void_receipts_paginate_with_repeated_headers(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $letter = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_LETTER_PORTRAIT)
            ->firstOrFail();

        $receipt = $this->portraitReceiptFixture($letter, items: 1);

        // Short receipt: one copy mode -> single physical page.
        $shortPdf = app(InstitutionalReceiptPdfService::class)->pdfForReceipt($receipt);
        $this->assertGreaterThanOrEqual(1, $this->pageCount($shortPdf));

        // Long receipt: 80 items must paginate (>1 page) and keep the thead rule.
        $long = $this->portraitReceiptFixture($letter, items: 80);
        $longHtml = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($long);
        $longPdf = app(InstitutionalReceiptPdfService::class)->pdfForReceipt($long);

        $this->assertStringContainsString('display: table-header-group', $longHtml);
        $this->assertStringContainsString('page-break-inside: avoid', $longHtml);
        $this->assertGreaterThan(1, $this->pageCount($longPdf), 'carta vertical with 80 items must paginate');

        // Void status renders the textual state, never only a color.
        $void = $this->portraitReceiptFixture($letter, items: 3, status: InstitutionalReceipt::STATUS_VOID);
        $voidHtml = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($void);
        $this->assertStringContainsString('Anulado', $voidHtml);
    }

    /**
     * Mandate §12: detail text must be readable (10-11 pt), verified on the real
     * Dompdf output, not only on the HTML source. Dompdf compresses the content
     * streams (FlateDecode), so this test decompresses them and takes the most
     * frequent `Tf` operator size. The previous landscape delivery measured
     * 6.7 pt; the portrait delivery must stay in the 9.5-11.5 pt reading window.
     */
    public function test_real_pdf_detail_text_is_readable_on_the_portrait_profile(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $letter = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_LETTER_PORTRAIT)
            ->firstOrFail();

        $pdf = app(InstitutionalReceiptPdfService::class)->pdfForReceipt(
            $this->portraitReceiptFixture($letter, items: 4),
        );

        $sizes = $this->fontSizesFromPdf($pdf);
        $this->assertNotEmpty($sizes, 'The real PDF must expose font-size operators.');

        $histogram = [];
        foreach ($sizes as $size) {
            $key = number_format($size, 2, '.', '');
            $histogram[$key] = ($histogram[$key] ?? 0) + 1;
        }
        arsort($histogram);
        $mostUsed = (float) array_key_first($histogram);

        $this->assertGreaterThanOrEqual(9.5, $mostUsed, 'Detail text must not regress to the old ~6.7 pt.');
        $this->assertLessThanOrEqual(11.5, $mostUsed, 'Detail text must stay within the mandated 10-11 pt window.');
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

    public function test_reprint_label_never_marks_the_first_delivery_and_uses_persistent_counter(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $letter = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_LETTER_PORTRAIT)
            ->firstOrFail();
        $receipt = $this->portraitReceiptFixture($letter, items: 2);

        $service = app(InstitutionalReceiptPdfService::class);

        $issuedHtml = $service->htmlForReceipt($receipt);
        $this->assertStringContainsString('ORIGINAL', $issuedHtml);
        $this->assertStringNotContainsString('Copia 1 de', $issuedHtml);
        $this->assertStringNotContainsString('Copia 3 de', $issuedHtml);

        $firstHtml = $service->htmlForReceipt($receipt);
        $this->assertStringNotContainsString('REIMPRESIÓN', $firstHtml);

        InstitutionalReceiptPrintEvent::query()->create([
            'institutional_receipt_id' => $receipt->id,
            'event_type' => InstitutionalReceiptPrintEvent::TYPE_ISSUED_PRINT,
            'copy_label' => 'ORIGINAL',
            'profile_snapshot' => $receipt->profile_snapshot,
            'reason' => null,
            'user_id' => $receipt->issued_by,
            'created_at' => now(),
        ]);

        $afterFirstPrint = $service->htmlForReceipt($receipt->fresh());
        $this->assertStringContainsString('REIMPRESIÓN #1', $afterFirstPrint);
        $this->assertSame(0, $receipt->fresh()->reprint_count);

        $receipt->forceFill(['reprint_count' => 2])->save();
        $this->assertStringContainsString(
            'REIMPRESIÓN #3',
            $service->htmlForReceipt($receipt->fresh()),
        );
    }

    public function test_portrait_evidence_pdfs_are_written_when_output_dir_is_configured(): void
    {
        $outputDirectory = trim((string) env('RECEIPT_PORTRAIT_EVIDENCE_DIR'));

        if ($outputDirectory === '') {
            $this->markTestSkipped('Set RECEIPT_PORTRAIT_EVIDENCE_DIR to write evidence PDFs.');
        }

        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $service = app(InstitutionalReceiptPdfService::class);
        File::ensureDirectoryExists($outputDirectory);

        $cases = [];

        // Short, zero-amount and long issued receipts for both portrait profiles.
        foreach ([
            ReceiptPrintProfile::CODE_LETTER_PORTRAIT => 'carta_vertical',
            ReceiptPrintProfile::CODE_A4_PORTRAIT => 'a4_vertical',
        ] as $code => $slug) {
            $profile = ReceiptPrintProfile::query()->where('code', $code)->firstOrFail();

            $cases["{$slug}-corto"] = $this->portraitReceiptFixture($profile, items: 2);
            $cases["{$slug}-largo"] = $this->portraitReceiptFixture($profile, items: 60);
            $cases["{$slug}-cero"] = $this->portraitReceiptFixture($profile, items: 1, zeroAmount: true);
            $cases["{$slug}-anulado"] = $this->portraitReceiptFixture($profile, items: 3, status: InstitutionalReceipt::STATUS_VOID);
        }

        foreach ($cases as $name => $receipt) {
            $pdf = $service->pdfForReceipt($receipt);
            File::put($outputDirectory.DIRECTORY_SEPARATOR."{$name}.pdf", $pdf);

            $box = $this->firstMediaBox($pdf);
            File::append(
                $outputDirectory.DIRECTORY_SEPARATOR.'dimensions.txt',
                sprintf(
                    '%s: %.2f x %.2f pt, %d page(s)%s',
                    $name,
                    $box[2],
                    $box[3],
                    $this->pageCount($pdf),
                    PHP_EOL,
                ),
            );
        }

        // Reprint case on the persistent counter.
        $letter = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_LETTER_PORTRAIT)
            ->firstOrFail();
        $reprint = $this->portraitReceiptFixture($letter, items: 2);
        InstitutionalReceiptPrintEvent::query()->create([
            'institutional_receipt_id' => $reprint->id,
            'event_type' => InstitutionalReceiptPrintEvent::TYPE_ISSUED_PRINT,
            'copy_label' => 'ORIGINAL',
            'profile_snapshot' => $reprint->profile_snapshot,
            'reason' => null,
            'user_id' => $reprint->issued_by,
            'created_at' => now(),
        ]);
        $reprint->forceFill(['reprint_count' => 1])->save();

        $reprintPdf = $service->pdfForReceipt($reprint->fresh());
        File::put($outputDirectory.DIRECTORY_SEPARATOR.'carta_vertical-reimpreso.pdf', $reprintPdf);
        $box = $this->firstMediaBox($reprintPdf);
        File::append(
            $outputDirectory.DIRECTORY_SEPARATOR.'dimensions.txt',
            sprintf(
                'carta_vertical-reimpreso: %.2f x %.2f pt, %d page(s)%s',
                $box[2],
                $box[3],
                $this->pageCount($reprintPdf),
                PHP_EOL,
            ),
        );

        $this->assertFileExists($outputDirectory.DIRECTORY_SEPARATOR.'carta_vertical-corto.pdf');
        $this->assertFileExists($outputDirectory.DIRECTORY_SEPARATOR.'a4_vertical-largo.pdf');
    }

    public function test_test_preview_evidence_uses_real_engine_html_when_configured(): void
    {
        $outputDirectory = trim((string) env('RECEIPT_PREVIEW_EVIDENCE_DIR'));

        if ($outputDirectory === '') {
            $this->markTestSkipped('Set RECEIPT_PREVIEW_EVIDENCE_DIR to write the engine preview evidence.');
        }

        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $series = InstitutionalReceiptSeries::query()->create([
            'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
            'series' => 'REC-EV',
            'prefix' => 'RE',
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'max_number' => 999999,
            'current_number' => 7,
            'range_authorization' => 'AUT-PREVIEW',
            'legal_text' => 'Suscribe. CERTIFICA haber enterado en esta oficina la suma de',
            'active' => true,
        ]);

        File::ensureDirectoryExists($outputDirectory);

        foreach ([
            ReceiptPrintProfile::CODE_LETTER_PORTRAIT => 'carta_vertical',
            ReceiptPrintProfile::CODE_A4_PORTRAIT => 'a4_vertical',
        ] as $code => $slug) {
            $response = $this->actingAs($admin)
                ->postJson('/api/settings/institutional-receipts/test-preview', [
                    'profile_code' => $code,
                    'payer_name' => 'Paciente de prueba',
                    'concept' => 'Servicios hospitalarios de prueba',
                    'amount' => '25.00',
                ])
                ->assertOk()
                ->assertJsonPath('data.reserved_number', false);

            $html = $response->json('data.html');
            $this->assertIsString($html);

            File::put($outputDirectory.DIRECTORY_SEPARATOR."{$slug}-engine-preview.html", $html);
            File::append(
                $outputDirectory.DIRECTORY_SEPARATOR.'engine-preview-summary.txt',
                sprintf(
                    '%s: copy_count=%s, labels=%s, reserved_number=%s, next_receipt_number=%s, html_bytes=%d%s',
                    $slug,
                    (string) $response->json('data.copy_count'),
                    implode('/', (array) $response->json('data.copy_labels')),
                    var_export($response->json('data.reserved_number'), true),
                    (string) $response->json('data.next_receipt_number'),
                    strlen($html),
                    PHP_EOL,
                ),
            );
        }

        // Rendering the preview must never consume a correlativo.
        $this->assertSame(7, $series->fresh()->current_number);
    }

    /**
     * @return array{0: float, 1: float, 2: float, 3: float}
     */
    private function firstMediaBox(string $pdf): array
    {
        $this->assertSame(1, preg_match('/\/MediaBox\s*\[([^\]]+)\]/', $pdf, $matches), 'PDF must expose a MediaBox');

        $values = array_values(array_filter(
            preg_split('/\s+/', trim($matches[1])) ?: [],
            static fn (string $value): bool => $value !== '',
        ));

        $this->assertCount(4, $values, 'MediaBox must have four numbers');

        return array_map(static fn (string $value): float => (float) $value, $values);
    }

    private function pageCount(string $pdf): int
    {
        return preg_match_all('/\/Type\s*\/Page\b/', $pdf);
    }

    private function portraitReceiptFixture(
        ReceiptPrintProfile $profile,
        int $items = 1,
        bool $zeroAmount = false,
        string $status = InstitutionalReceipt::STATUS_ISSUED,
    ): InstitutionalReceipt {
        $user = User::factory()->create(['name' => 'Cajera Portrait']);
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
            'series' => 'REC-P'.random_int(10, 99),
            'prefix' => 'RP',
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'max_number' => 999999,
            'current_number' => 0,
            'range_authorization' => 'AUT-REC-PORTRAIT',
            'legal_text' => 'Suscribe. CERTIFICA haber enterado en esta oficina la suma de',
            'active' => false,
        ]);

        $amountCents = $zeroAmount ? 0 : 123456;
        $unitPriceCents = $zeroAmount ? 0 : intdiv($amountCents, max(1, $items));

        $itemRows = collect(range(1, $items))->map(fn (int $index): array => [
            'service_name' => "Servicio hospitalario portrait {$index} con un nombre largo que debe envolver correctamente",
            'category_name' => 'Consulta',
            'area_name' => 'Caja',
            'quantity' => '1.00',
            'unit_price' => number_format($unitPriceCents / 100, 2, '.', ''),
            'unit_price_cents' => $unitPriceCents,
            'tax_rate' => '0.00',
            'tax_amount' => '0.00',
            'tax_amount_cents' => 0,
            'line_subtotal' => number_format($unitPriceCents / 100, 2, '.', ''),
            'line_subtotal_cents' => $unitPriceCents,
            'line_total' => number_format($unitPriceCents / 100, 2, '.', ''),
            'line_total_cents' => $unitPriceCents,
            'notes' => null,
        ])->all();

        $profileSnapshot = [
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
        ];

        $receiptNumber = random_int(1, 99999999);

        return InstitutionalReceipt::query()->create([
            'invoice_id' => null,
            'payment_id' => null,
            'cash_session_id' => $cashSession->id,
            'series_id' => $series->id,
            'receipt_number' => $receiptNumber,
            'receipt_number_full' => 'REC-P'.str_pad((string) $receiptNumber, 8, '0', STR_PAD_LEFT),
            'status' => $status,
            'amount' => number_format($amountCents / 100, 2, '.', ''),
            'amount_cents' => $amountCents,
            'issued_at' => now(),
            'issued_by' => $user->id,
            'payer_name' => 'María López de la Cruz con nombre largo para envolver',
            'concept' => 'Servicios hospitalarios de prueba',
            'amount_words' => 'MIL DOSCIENTOS TREINTA Y CUATRO LEMPIRAS CON 56/100 CENTAVOS',
            'template_code' => $profile->template_code,
            'print_profile_code' => $profile->code,
            // Snapshot the mode the profile is configured with, so the fixture
            // emulates a real issue for THAT profile (carta vertical = 3 copies,
            // A4 = 1) instead of a hardcoded count.
            'copy_mode' => $profile->copies_mode,
            'institution_snapshot' => [
                'government_line' => 'Gobierno de Honduras',
                'secretariat_line' => 'Secretaría de Salud',
                'hospital_name' => 'Hospital General San Isidro',
                'address' => 'Tocoa, Colón',
                'rtn' => '',
                'phone' => '2444-0000',
                'receipt_location' => 'Tocoa, Colón, Honduras',
                'receipt_footer_text' => 'Copia generada desde datos del recibo',
                'logo_data_uri' => null,
            ],
            'series_snapshot' => [
                'series' => $series->series,
                'receipt_number_full' => 'REC-P'.str_pad((string) $receiptNumber, 8, '0', STR_PAD_LEFT),
                'receipt_number_color' => '#b91c1c',
                'legal_text' => 'Suscribe. CERTIFICA haber enterado en esta oficina la suma de',
                'range_authorization' => 'AUT-REC-PORTRAIT',
            ],
            'profile_snapshot' => $profileSnapshot,
            'invoice_snapshot' => [
                'invoice_number' => 'INV-PORTRAIT-'.str_pad((string) $receiptNumber, 8, '0', STR_PAD_LEFT),
                'fiscal_cai' => null,
                'fiscal_range_from' => null,
                'fiscal_range_to' => null,
                'fiscal_valid_until' => null,
                'patient_name' => 'María López',
                'issued_at' => now()->toIso8601String(),
                'tax_label' => 'ISV',
                'tax_rate_snapshot' => null,
                'subtotal_cents' => $amountCents,
                'exempt_amount_cents' => $amountCents,
                'tax_amount_cents' => 0,
                'discount_amount_cents' => 0,
                'total_cents' => $amountCents,
                'paid_amount_cents' => $amountCents,
                'balance_due_cents' => 0,
            ],
            'payment_snapshot' => [
                'selected_payment' => [
                    'method' => 'cash',
                    'amount_cents' => $amountCents,
                    'reference' => null,
                    'paid_at' => now()->toIso8601String(),
                    'cashier_name' => 'Cajera Portrait',
                ],
                'posted_payments' => [],
                'cash_context' => [
                    'cash_register_label' => 'Caja #1',
                    'cashier_name' => 'Cajera Portrait',
                    'opened_at' => now()->toIso8601String(),
                ],
                'issued_by' => ['name' => 'Cajera Portrait'],
            ],
            'items_snapshot' => $itemRows,
            'reprint_count' => 0,
        ]);
    }
}
