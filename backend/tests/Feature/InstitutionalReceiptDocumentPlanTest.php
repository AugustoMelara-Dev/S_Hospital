<?php

namespace Tests\Feature;

use App\Actions\InstitutionalReceipts\AmountToSpanishWords;
use App\Actions\InstitutionalReceipts\InstitutionalReceiptDocumentPlan;
use App\Actions\InstitutionalReceipts\InstitutionalReceiptHtmlBuilder;
use App\Actions\InstitutionalReceipts\InstitutionalReceiptPdfService;
use App\Models\CashRegisterSession;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptSeries;
use App\Models\ReceiptPrintProfile;
use App\Models\User;
use Database\Seeders\ReceiptPrintProfileSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * C3-P2 — canonical result of the institutional receipt generator.
 *
 * The document stopped being "one page per copy" when the two-zone sheet landed:
 * two destinations of the same document can share ONE page, and a long operation
 * can spread a destination over several pages. Every surface (settings, preview,
 * download) must therefore read ONE typed result whose page count is MEASURED on
 * the generated document, and whose texts never derive pages from copies.
 *
 * These tests exercise the real Dompdf engine: `page_count` comes from
 * `getCanvas()->get_page_count()` of a fresh instance per document.
 */
class InstitutionalReceiptDocumentPlanTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);
    }

    // ------------------------------------------------------------------
    // (a) Dos ejemplares cortos: UNA página, y el texto lo dice
    // ------------------------------------------------------------------

    public function test_two_short_destinations_share_one_page_and_the_text_says_so(): void
    {
        $profile = $this->profile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);
        $receipt = $this->receiptFixture($this->ordinaryItems(1), $profile, copyMode: 'original_first');

        $plan = app(InstitutionalReceiptPdfService::class)->planForReceipt($receipt);

        $this->assertSame(InstitutionalReceiptHtmlBuilder::COMPOSITION_PAIRED, $plan->usedComposition());
        $this->assertSame(InstitutionalReceiptHtmlBuilder::COMPOSITION_PAIRED, $plan->requestedComposition());
        $this->assertSame(1, $plan->pageCount(), 'dos ejemplares cortos caben en una sola página');
        $this->assertSame(2, $plan->copyCount(), 'el conjunto sigue declarando dos ejemplares');
        $this->assertSame(1, $plan->sheetCount());
        $this->assertFalse($plan->alternativeOutput());
        $this->assertNull($plan->alternativeReason());

        // El texto describe el reparto real: dos ejemplares en UNA página, y los
        // destinos, sin deducir páginas del número de copias.
        $headline = $plan->headline();
        $this->assertStringContainsString('Carta vertical', $headline);
        $this->assertStringContainsString('2 ejemplares en 1 página', $headline);
        $this->assertStringContainsString('Ejemplar del paciente', $headline);
        $this->assertStringContainsString('Ejemplar para archivo del hospital', $headline);
        $this->assertStringNotContainsString('una por copia', $headline);

        // Un solo bloque de página con los dos destinos apilados.
        $this->assertSame(1, substr_count($plan->html(), 'class="receipt-page'));
        $this->assertSame(
            [['sheet' => 1, 'destinations' => ['Ejemplar del paciente', 'Ejemplar para archivo del hospital'], 'pages' => 1]],
            $plan->distribution(),
        );
        $this->assertSame(1, $this->distributionPageSum($plan));

        // La instrucción de impresión manda imprimir el conjunto, no duplicarlo.
        $this->assertStringContainsString('una copia del conjunto', $plan->printInstruction());
        $this->assertStringNotContainsString('una por copia', $plan->printInstruction());
    }

    // ------------------------------------------------------------------
    // (a2) Borrador y emitido comparten la decisión de composición
    // ------------------------------------------------------------------

    /**
     * C3-P2 / encargo de cierre: la vista previa y la emisión deben decidir la
     * composición con las MISMAS reglas.
     *
     * Antes, `forDraft`/`planForDraft` forzaban `single` mientras la emisión podía
     * usar `paired`: con dos ejemplares cortos sobre carta, la vista previa
     * anunciaba dos páginas y el documento emitido cabía en una hoja de dos zonas.
     * Esta prueba fija la equivalencia para contenido y configuración
     * equivalentes: misma composición solicitada y usada, mismo papel y geometría,
     * mismo número de páginas medido.
     */
    public function test_draft_and_issued_share_the_composition_decision(): void
    {
        $profile = $this->profile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);
        $profile->forceFill(['copies_mode' => 'original_first'])->save();

        $service = app(InstitutionalReceiptPdfService::class);

        $receipt = $this->receiptFixture($this->ordinaryItems(1), $profile->fresh(), copyMode: 'original_first');
        $issued = $service->planForReceipt($receipt);

        $draft = $service->planForDraft([
            'payer_name' => 'Paciente de prueba',
            'concept' => 'Servicios hospitalarios de prueba',
            'amount' => '100.00',
        ], $profile->fresh());

        $this->assertSame(
            $issued->requestedComposition(),
            $draft->requestedComposition(),
            'misma composición SOLICITADA en ambas rutas',
        );
        $this->assertSame(
            $issued->usedComposition(),
            $draft->usedComposition(),
            'misma composición USADA en ambas rutas',
        );
        $this->assertSame($issued->pageCount(), $draft->pageCount(), 'mismo número de páginas medido');
        $this->assertSame($issued->copyCount(), $draft->copyCount(), 'mismo número de ejemplares');

        $issuedData = $issued->toArray();
        $draftData = $draft->toArray();

        foreach (['paper_kind', 'width_pt', 'height_pt', 'orientation'] as $key) {
            $this->assertSame($issuedData[$key] ?? null, $draftData[$key] ?? null, "misma geometría: {$key}");
        }

        // La hoja de dos zonas se elige también en el borrador.
        $this->assertSame(InstitutionalReceiptHtmlBuilder::COMPOSITION_PAIRED, $draft->usedComposition());
        $this->assertSame(1, $draft->pageCount());

        // El borrador se identifica como prueba y no reserva identificadores.
        $this->assertTrue($draftData['draft'] ?? false, 'el plan declara que es borrador');
        $this->assertStringContainsString('PRUEBA', $draft->html(), 'marca inequívoca de documento de prueba');
    }

    // ------------------------------------------------------------------
    // (b) Media carta, un ejemplar: una página
    // ------------------------------------------------------------------

    public function test_half_letter_single_copy_is_one_measured_page(): void
    {
        $profile = $this->profile(ReceiptPrintProfile::CODE_HALF_LETTER);
        $service = app(InstitutionalReceiptPdfService::class);

        foreach ([1, 2, 5] as $itemCount) {
            $receipt = $this->receiptFixture($this->ordinaryItems($itemCount), $profile);

            $plan = $service->planForReceipt($receipt);

            $this->assertSame(
                InstitutionalReceiptHtmlBuilder::COMPOSITION_SINGLE,
                $plan->usedComposition(),
                "media carta {$itemCount}: un ejemplar por página, sin hoja de dos zonas",
            );
            $this->assertSame(1, $plan->pageCount(), "media carta {$itemCount}: una página real");
            $this->assertSame(1, $plan->copyCount());
            $this->assertSame(1, $this->distributionPageSum($plan));
            $this->assertSame('Media carta · 1 ejemplar · 1 página PDF.', $plan->headline());
            $this->assertFalse($plan->alternativeOutput());
            $this->assertNull($plan->sheetAssumption(), 'una sola página no habla de hojas físicas');

            // Geometría efectiva declarada en puntos, la del papel real.
            $paper = $plan->toArray()['paper'];
            $this->assertSame('half_letter_landscape', $paper['kind']);
            $this->assertSame('landscape', $paper['orientation']);
            $this->assertSame(612.0, (float) $paper['width_pt']);
            $this->assertSame(396.0, (float) $paper['height_pt']);
        }
    }

    // ------------------------------------------------------------------
    // (c) Operación larga: salida alternativa con motivo legible
    // ------------------------------------------------------------------

    public function test_a_long_operation_reports_an_alternative_output_with_a_legible_reason(): void
    {
        $profile = $this->profile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);
        $receipt = $this->receiptFixture($this->ordinaryItems(11), $profile, copyMode: 'original_first');

        $plan = app(InstitutionalReceiptPdfService::class)->planForReceipt($receipt);

        // La hoja de dos zonas se pidió y no admitió el detalle: cada ejemplar
        // recibió su página completa, sin ocultar líneas.
        $this->assertSame(InstitutionalReceiptHtmlBuilder::COMPOSITION_PAIRED, $plan->requestedComposition());
        $this->assertSame(InstitutionalReceiptHtmlBuilder::COMPOSITION_SINGLE, $plan->usedComposition());
        $this->assertTrue($plan->alternativeOutput());
        $this->assertNotNull($plan->alternativeReason());
        $this->assertStringContainsString('dos zonas', (string) $plan->alternativeReason());
        $this->assertSame(
            2,
            $plan->pageCount(),
            'dos ejemplares largos: una página completa por ejemplar',
        );
        $this->assertSame(2, $this->distributionPageSum($plan));
        $this->assertStringContainsString($plan->alternativeReason() ?? '', $plan->headline());
    }

    public function test_a_destination_that_needs_extra_pages_states_the_extra_pages(): void
    {
        $profile = $this->profile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);
        $receipt = $this->receiptFixture($this->ordinaryItems(30), $profile);

        $plan = app(InstitutionalReceiptPdfService::class)->planForReceipt($receipt);

        $this->assertGreaterThan(1, $plan->pageCount(), '30 conceptos no caben en una página');
        $this->assertSame(1, $plan->copyCount());
        $this->assertTrue($plan->alternativeOutput());
        $this->assertNotNull($plan->alternativeReason());
        $this->assertStringContainsString('páginas adicionales', (string) $plan->alternativeReason());
        $this->assertStringContainsString('1 ejemplar', (string) $plan->alternativeReason());
        $this->assertStringContainsString($plan->pageCount().' páginas PDF', (string) $plan->alternativeReason());

        // La distribución atribuye la página extra al ejemplar que la necesita.
        $this->assertSame(1, $plan->sheetCount());
        $distribution = $plan->distribution();
        $this->assertCount(1, $distribution);
        $this->assertSame($plan->pageCount(), $distribution[0]['pages']);
        $this->assertSame($plan->pageCount(), $this->distributionPageSum($plan));

        // Habla de hojas físicas: declara la suposición de una cara.
        $this->assertNotNull($plan->sheetAssumption());
        $this->assertStringContainsString('una cara', (string) $plan->sheetAssumption());
    }

    // ------------------------------------------------------------------
    // (d) El número de páginas NO se deriva del número de copias
    // ------------------------------------------------------------------

    public function test_page_count_is_not_derived_from_the_copy_count(): void
    {
        $service = app(InstitutionalReceiptPdfService::class);
        $letterPortrait = $this->profile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);
        $halfLetter = $this->profile(ReceiptPrintProfile::CODE_HALF_LETTER);

        // Dos ejemplares, UNA página: copias > páginas.
        $paired = $service->planForReceipt(
            $this->receiptFixture($this->ordinaryItems(1), $letterPortrait, copyMode: 'original_first'),
        );
        $this->assertSame(2, $paired->copyCount());
        $this->assertSame(1, $paired->pageCount());
        $this->assertNotSame($paired->copyCount(), $paired->pageCount());

        // Un ejemplar, VARIAS páginas: páginas > copias.
        $overflow = $service->planForReceipt(
            $this->receiptFixture($this->ordinaryItems(30), $letterPortrait),
        );
        $this->assertSame(1, $overflow->copyCount());
        $this->assertGreaterThan(1, $overflow->pageCount());
        $this->assertNotSame($overflow->copyCount(), $overflow->pageCount());

        // El manifiesto completo lo declara sin ambigüedad.
        $this->assertNotSame(
            $paired->pageCount(),
            $paired->copyCount(),
            'el manifiesto no puede seguir afirmando una página por copia',
        );
        $this->assertSame('single', $overflow->toArray()['used_composition']);
    }

    public function test_the_document_plan_always_publishes_a_measured_integer_page_count(): void
    {
        $service = app(InstitutionalReceiptPdfService::class);
        $plans = [
            $service->planForReceipt($this->receiptFixture($this->ordinaryItems(1), $this->profile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT))),
            $service->planForReceipt($this->receiptFixture($this->ordinaryItems(5), $this->profile(ReceiptPrintProfile::CODE_HALF_LETTER))),
            $service->planForReceipt($this->receiptFixture($this->ordinaryItems(30), $this->profile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT))),
        ];

        foreach ($plans as $plan) {
            $manifest = $plan->toArray();
            $this->assertIsInt($manifest['page_count']);
            $this->assertGreaterThanOrEqual(1, $manifest['page_count']);
            $this->assertSame($manifest['page_count'], $this->distributionPageSum($plan), 'la distribución suma las páginas reales');
            $this->assertSame($manifest['copies']['count'], $plan->copyCount());
            $this->assertArrayHasKey('requested_composition', $manifest);
            $this->assertArrayHasKey('used_composition', $manifest);
            $this->assertArrayHasKey('alternative_reason', $manifest);
        }
    }

    // ------------------------------------------------------------------
    // (e) La vista previa de ajustes publica el mismo resultado medido
    // ------------------------------------------------------------------

    public function test_settings_preview_publishes_the_measured_document_plan(): void
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        InstitutionalReceiptSeries::query()->create([
            'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
            'series' => 'REC-C3P2',
            'prefix' => 'RC',
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'max_number' => 999999,
            'current_number' => 4,
            'range_authorization' => 'AUT-C3-P2',
            'legal_text' => 'Suscribe. CERTIFICA haber enterado en esta oficina la suma de',
            'active' => true,
        ]);

        $response = $this->actingAs($admin)
            ->postJson('/api/settings/institutional-receipts/test-preview', [
                'profile_code' => ReceiptPrintProfile::CODE_HALF_LETTER,
                'payer_name' => 'Paciente de prueba',
                'concept' => 'Servicios hospitalarios de prueba',
                'amount' => '25.00',
            ])
            ->assertOk();

        // Compatibilidad: el conteo/las etiquetas de copia siguen ahí...
        $this->assertSame(3, $response->json('data.copy_count'));
        $this->assertSame(['ORIGINAL', 'PRIMERA COPIA', 'SEGUNDA COPIA'], $response->json('data.copy_labels'));

        // ...pero las páginas son las MEDIDAS, no las copias.
        $this->assertSame('half_letter_landscape', $response->json('data.document.paper.kind'));
        $this->assertSame('Media carta', $response->json('data.document.paper.label'));
        $this->assertSame(612.0, (float) $response->json('data.document.paper.width_pt'));
        $this->assertSame(396.0, (float) $response->json('data.document.paper.height_pt'));
        $this->assertSame(3, $response->json('data.document.copies.count'));
        $this->assertSame(3, $response->json('data.document.page_count'));
        $this->assertSame('single', $response->json('data.document.used_composition'));
        $this->assertIsInt($response->json('data.document.page_count'));

        // El HTML servido es el del documento medido: el número de bloques de
        // página del HTML coincide con las páginas publicadas. Una sola fuente.
        $html = (string) $response->json('data.html');
        $this->assertSame(3, substr_count($html, 'class="receipt-page'));
        $this->assertSame(3, $response->json('data.document.page_count'));

        // La instrucción de compatibilidad no inventa páginas ni "una por copia".
        $instruction = (string) $response->json('data.copy_plan.instruction');
        $this->assertStringNotContainsString('una por copia', $instruction);
        $this->assertDoesNotMatchRegularExpression('/\d+\s*p[áa]ginas?/u', $instruction);
        $this->assertStringContainsString('ejemplares', $instruction);
    }

    // ------------------------------------------------------------------
    // Medición real
    // ------------------------------------------------------------------

    private function distributionPageSum(InstitutionalReceiptDocumentPlan $plan): int
    {
        $sum = 0;

        foreach ($plan->distribution() as $sheet) {
            $sum += (int) $sheet['pages'];
        }

        return $sum;
    }

    // ------------------------------------------------------------------
    // Fixtures
    // ------------------------------------------------------------------

    private function profile(string $code): ReceiptPrintProfile
    {
        return ReceiptPrintProfile::query()->where('code', $code)->firstOrFail();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function ordinaryItems(int $count): array
    {
        $items = [];

        for ($index = 1; $index <= $count; $index++) {
            $items[] = $this->lineItem("Servicio hospitalario {$index}", 10000 + $index);
        }

        return $items;
    }

    /**
     * @return array<string, mixed>
     */
    private function lineItem(string $name, int $unitPriceCents = 2500): array
    {
        $money = number_format($unitPriceCents / 100, 2, '.', '');

        return [
            'service_name' => $name,
            'category_name' => 'Consulta',
            'area_name' => 'Caja',
            'quantity' => '1.00',
            'unit_price' => $money,
            'unit_price_cents' => $unitPriceCents,
            'tax_rate' => '0.00',
            'tax_amount' => '0.00',
            'tax_amount_cents' => 0,
            'line_subtotal' => $money,
            'line_subtotal_cents' => $unitPriceCents,
            'line_total' => $money,
            'line_total_cents' => $unitPriceCents,
            'notes' => null,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $items
     */
    private function receiptFixture(
        array $items,
        ReceiptPrintProfile $profile,
        string $copyMode = 'original_only',
    ): InstitutionalReceipt {
        $user = User::factory()->create(['name' => 'Cajera C3P2']);
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
            'series' => 'REC-C3P2',
            'prefix' => 'RC',
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'max_number' => 999999,
            'current_number' => 0,
            'range_authorization' => 'AUT-REC-C3P2',
            'legal_text' => 'Suscribe. CERTIFICA haber enterado en esta oficina la suma de',
            'active' => false,
        ]);

        $totalCents = array_sum(array_map(
            static fn (array $item): int => (int) $item['line_total_cents'],
            $items,
        ));
        $total = number_format($totalCents / 100, 2, '.', '');
        $receiptNumber = random_int(1, 99999999);
        $receiptNumberFull = 'REC-C3P2'.str_pad((string) $receiptNumber, 8, '0', STR_PAD_LEFT);

        return InstitutionalReceipt::query()->create([
            'invoice_id' => null,
            'payment_id' => null,
            'cash_session_id' => $cashSession->id,
            'series_id' => $series->id,
            'receipt_number' => $receiptNumber,
            'receipt_number_full' => $receiptNumberFull,
            'status' => InstitutionalReceipt::STATUS_ISSUED,
            'amount' => $total,
            'amount_cents' => $totalCents,
            'issued_at' => Carbon::parse('2026-09-21 08:30:00'),
            'issued_by' => $user->id,
            'payer_name' => 'María López de la Cruz con nombre largo para envolver',
            'concept' => 'Servicios hospitalarios de prueba',
            'amount_words' => app(AmountToSpanishWords::class)->forCents($totalCents),
            'template_code' => $profile->template_code,
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
                'receipt_footer_text' => 'Documento de recaudación institucional.',
                'logo_data_uri' => null,
            ],
            'series_snapshot' => [
                'series' => $series->series,
                'receipt_number_full' => $receiptNumberFull,
                'receipt_number_color' => '#b91c1c',
                'legal_text' => 'Suscribe. CERTIFICA haber enterado en esta oficina la suma de',
                'range_authorization' => 'AUT-REC-C3P2',
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
                'template_code' => $profile->template_code,
                'copies_mode' => $profile->copies_mode,
                'show_copy_legend' => (bool) $profile->show_copy_legend,
                'show_physical_seal_space' => (bool) $profile->show_physical_seal_space,
                'use_logo' => false,
            ],
            'invoice_snapshot' => [
                'invoice_number' => 'INV-C3P2-00000001',
                'fiscal_cai' => null,
                'fiscal_range_from' => null,
                'fiscal_range_to' => null,
                'fiscal_valid_until' => null,
                'patient_name' => 'María López',
                'issued_at' => '2026-09-21T08:30:00-06:00',
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
                    'paid_at' => '2026-09-21T08:30:00-06:00',
                    'cashier_name' => 'Cajera C3P2',
                ],
                'posted_payments' => [],
                'cash_context' => [
                    'cash_register_label' => 'Caja principal',
                    'cashier_name' => 'Cajera C3P2',
                    'opened_at' => '2026-09-21T08:00:00-06:00',
                ],
                'issued_by' => ['name' => 'Cajera C3P2'],
            ],
            'items_snapshot' => $items,
            'reprint_count' => 0,
        ]);
    }
}
