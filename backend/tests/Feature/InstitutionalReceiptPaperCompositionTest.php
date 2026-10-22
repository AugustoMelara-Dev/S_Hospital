<?php

namespace Tests\Feature;

use App\Actions\InstitutionalReceipts\AmountToSpanishWords;
use App\Actions\InstitutionalReceipts\BuildInstitutionalReceiptSnapshotAction;
use App\Actions\InstitutionalReceipts\InstitutionalReceiptPdfService;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptSeries;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\ReceiptPrintProfile;
use App\Models\User;
use App\Support\PaperSize;
use Barryvdh\DomPDF\Facade\Pdf;
use Database\Seeders\ReceiptPrintProfileSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * C2-B7 — paper profiles and sheet composition of the institutional receipt.
 *
 * Measured on the REAL Dompdf engine (page count from `getCanvas()->get_page_count()`
 * and the emitted bytes), never from the HTML source alone:
 *
 * - Carta vertical / A4 vertical: one page per destination (T-RC-01 contract, kept).
 * - Media carta 215.9 x 139.7 mm = 612 x 396 pt: a NATIVE half-sheet composition of
 *   its own (`data-receipt-density="half"`), not a reduced carta.
 * - Two destinations that fit -> ONE carta page with two stacked half-sheet zones
 *   (patient above, hospital archive below, cut line between). The same document
 *   twice, distinguished only by destination.
 * - Two destinations that do NOT fit -> one legible page per destination; no line is
 *   ever hidden to force a single sheet.
 *
 * Content contract: a historical line whose rule adjustment was never recorded
 * (`rule_adjustment_persisted = false`) is declared, never printed as `L. 0.00`; a
 * legitimate zero uses gratuity wording and never claims cash was received; the
 * "en letras" sentence always speaks the amount it refers to.
 */
class InstitutionalReceiptPaperCompositionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);
    }

    // ------------------------------------------------------------------
    // 1. Media carta nativa
    // ------------------------------------------------------------------

    public function test_media_carta_is_native_612x396_with_its_own_compact_composition(): void
    {
        $profile = $this->profile(ReceiptPrintProfile::CODE_HALF_LETTER);

        // The seeded media carta profile carries the compact family after C2-B7.
        $this->assertSame('institutional_compact', $profile->template_code);
        $this->assertSame('half_letter_landscape', $profile->paper_kind);

        $service = app(InstitutionalReceiptPdfService::class);

        foreach ([1, 2, 5] as $itemCount) {
            $items = $this->ordinaryItems($itemCount);
            $receipt = $this->receiptFixture($items, $profile);
            $html = $service->htmlForReceipt($receipt);
            $pdf = $service->pdfForReceipt($receipt);

            $box = $this->firstMediaBox($pdf);
            $this->assertSame([0.0, 0.0, 612.0, 396.0], $box, "media carta {$itemCount}: exact half-letter sheet");

            // Its own condensed composition, not the carta one.
            $this->assertStringContainsString('data-receipt-density="half"', $html);
            $this->assertStringContainsString('data-receipt-composition="single"', $html);

            /*
             * El contenido es lo primero: una sola hoja declarada, ninguna línea
             * escondida y detalle legible.
             *
             * Cabida (C3-P1): el requisito es 1, 2 y 5 conceptos ordinarios en
             * UNA página por ejemplar sobre 612 x 396 pt. Se comprueba sobre el
             * PDF EMITIDO, que es el byte que se entrega e imprime.
             */
            $this->assertSame(1, substr_count($html, 'class="receipt-page'), "media carta {$itemCount}: un ejemplar");
            $this->assertSame(
                1,
                $this->bytePageCount($pdf),
                "media carta {$itemCount}: una página por ejemplar (PDF emitido)",
            );

            // Every line is present exactly once: nothing is hidden to fit.
            foreach ($items as $index => $item) {
                $this->assertSame(
                    1,
                    preg_match_all('/>\s*'.preg_quote($item['service_name'], '/').'\s*</u', $html),
                    "media carta {$itemCount}: line ".($index + 1).' must appear exactly once',
                );
            }

            /*
             * Letra de detalle en la ventana 10-11 pt del encargo (§9).
             *
             * Se mide el tamaño base que el documento realmente declara y se
             * convierte a puntos (1 px = 0.75 pt). No se cuentan operadores `Tf`
             * del binario: esta compilación de Dompdf no los expone de forma
             * fiable a una extracción por expresión regular, y un proxy que a
             * veces no encuentra nada no prueba legibilidad. Límite declarado: la
             * ventana se verifica sobre el tamaño declarado, no sobre el glifo
             * impreso.
             */
            $detailPt = $this->declaredBodyFontSizePt($html);
            $this->assertGreaterThanOrEqual(9.5, $detailPt, "media carta {$itemCount}: letra de detalle legible");
            $this->assertLessThanOrEqual(11.5, $detailPt, "media carta {$itemCount}: ventana de detalle 10-11 pt");
        }
    }

    public function test_media_carta_is_not_a_scaled_carta_composition(): void
    {
        $halfLetter = $this->profile(ReceiptPrintProfile::CODE_HALF_LETTER);
        $items = $this->ordinaryItems(5);

        // The native half-sheet composition condenses its own bands; the letter
        // composition is a different document geometry (612 x 792 pt).
        $halfHtml = app(InstitutionalReceiptPdfService::class)->htmlForReceipt(
            $this->receiptFixture($items, $halfLetter),
        );
        $letterHtml = app(InstitutionalReceiptPdfService::class)->htmlForReceipt(
            $this->receiptFixture($items, $this->profile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT)),
        );

        $this->assertStringContainsString('height: 18px', $halfHtml, 'media carta uses its condensed logo block');
        $this->assertStringNotContainsString('height: 18px', $letterHtml, 'carta keeps the roomy logo block');
        $this->assertStringContainsString('height: 30px', $letterHtml);
    }

    /**
     * C3-P1 — cabida de media carta: 1, 2 y 5 conceptos ordinarios en UNA página.
     *
     * Esta es la aserción del requisito, no una medición declarada. Antes del
     * arreglo de composición fallaba: la hoja necesitaba 401.7 pt para 2
     * conceptos y 456.0 pt para 5 sobre una hoja de 396 pt. Después de agrupar la
     * composición `half`, el motor real emite una sola página en los tres casos.
     *
     * Se comprueba además que el detalle siga siendo legible (10-11 pt) y que el
     * área de ESCRITURA de firma y sello conserve altura útil: ganar cabida
     * recortando el espacio de firma no es una solución aceptable.
     */
    public function test_media_carta_fits_one_sheet_for_one_two_and_five_concepts(): void
    {
        $profile = $this->profile(ReceiptPrintProfile::CODE_HALF_LETTER);
        $service = app(InstitutionalReceiptPdfService::class);
        $measured = [];

        foreach ([1, 2, 5] as $itemCount) {
            $receipt = $this->receiptFixture($this->ordinaryItems($itemCount), $profile);
            $html = $service->htmlForReceipt($receipt);
            $pdf = $service->pdfForReceipt($receipt);

            $measured[$itemCount] = $this->bytePageCount($pdf);
            $this->writeEvidence("media-carta-{$itemCount}-conceptos", $pdf);

            $this->assertSame([0.0, 0.0, 612.0, 396.0], $this->firstMediaBox($pdf));

            // Todas las líneas siguen presentes: no se oculta nada para caber.
            foreach ($this->ordinaryItems($itemCount) as $item) {
                $this->assertSame(
                    1,
                    substr_count($html, $item['service_name']),
                    "media carta {$itemCount}: cada concepto aparece exactamente una vez",
                );
            }

            $detailPt = $this->declaredBodyFontSizePt($html);
            // Ventana del encargo §4: 10–11 pt. Se comprueba sobre el tamaño base
            // que el documento realmente declara (14 px × 0.75 con el DPI efectivo
            // de Dompdf = 10.5 pt).
            $this->assertGreaterThanOrEqual(10.0, $detailPt, 'detalle legible (>= 10 pt)');
            $this->assertLessThanOrEqual(11.0, $detailPt, 'ventana de detalle (<= 11 pt)');

            // Área de escritura de firma y sello: se conserva útil.
            $this->assertMatchesRegularExpression(
                '/\.signature-space\s*\{[^}]*height:\s*18px/',
                $html,
                'el espacio de firma conserva altura de escritura',
            );
            $this->assertMatchesRegularExpression(
                '/\.seal-space\s*\{[^}]*height:\s*15px/',
                $html,
                'el espacio de sello conserva altura de escritura',
            );
        }

        $this->assertSame(
            [1 => 1, 2 => 1, 5 => 1],
            $measured,
            'media carta: una página por ejemplar para 1, 2 y 5 conceptos',
        );
    }

    /**
     * MEDICIÓN DECLARADA — hoja carta con dos ejemplares compactos.
     *
     * El mecanismo está implementado y probado arriba (dos zonas apiladas, línea
     * de corte, mismo número y dos destinos) y solo se activa cuando el motor real
     * demuestra que el par cae en UNA página. Esta prueba mide si esa condición se
     * alcanza hoy; mientras no se alcance, se declara INCOMPLETA con la medición en
     * lugar de aprobarse.
     */
    public function test_two_zone_sheet_asserts_one_letter_page_for_a_short_operation(): void
    {
        $profile = $this->profile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);
        $service = app(InstitutionalReceiptPdfService::class);
        $measured = [];

        foreach ([1, 2] as $itemCount) {
            $receipt = $this->receiptFixture($this->ordinaryItems($itemCount), $profile, copyMode: 'original_first');
            $html = $service->htmlForReceipt($receipt);
            $measured[$itemCount] = [
                'paired' => str_contains($html, 'data-receipt-composition="paired"'),
                'pages' => $this->bytePageCount($service->pdfForReceipt($receipt)),
            ];
        }

        // El par se activa solo si el motor real prueba que cae en UNA hoja; esa
        // es la aserción del requisito, no una medición declarada.
        $this->assertTrue($measured[1]['paired'], 'la hoja de dos zonas se activa para una operación corta');
        $this->assertSame(1, $measured[1]['pages'], 'dos ejemplares cortos caben en una hoja carta');
    }

    // ------------------------------------------------------------------
    // 2. Dos ejemplares compactos en UNA página carta
    // ------------------------------------------------------------------

    public function test_two_destinations_that_fit_share_one_letter_sheet_with_a_cut_line(): void
    {
        $profile = $this->profile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);
        $service = app(InstitutionalReceiptPdfService::class);

        foreach ([1, 2] as $itemCount) {
            $items = $this->ordinaryItems($itemCount);
            $receipt = $this->receiptFixture($items, $profile, copyMode: 'original_first');
            $html = $service->htmlForReceipt($receipt);
            $pdf = $service->pdfForReceipt($receipt);

            $this->assertSame(
                [0.0, 0.0, 612.0, 792.0],
                $this->firstMediaBox($pdf),
                "dos ejemplares {$itemCount}: still a carta sheet",
            );
            /*
             * El reparto lo decide el motor real: el par se activa solo cuando cae
             * en UNA hoja. Si no cabe, el documento conserva una página legible por
             * destino. En ambos casos es el MISMO documento y ninguna línea se
             * oculta, así que la prueba acepta los dos repartos y comprueba la
             * coherencia entre composición y páginas realmente emitidas.
             */
            $paired = str_contains($html, 'data-receipt-composition="paired"');
            $pages = $this->bytePageCount($pdf);
            $this->writeEvidence("dos-ejemplares-{$itemCount}-conceptos".($paired ? '-par' : '-respaldo'), $pdf);

            $this->assertSame(
                $paired ? 1 : 2,
                $pages,
                "dos ejemplares {$itemCount}: hojas emitidas coherentes con el reparto",
            );

            if ($paired) {
                $this->assertStringContainsString('data-receipt-sheet="two-zones"', $html);
                $this->assertStringContainsString('data-receipt-destinations="2"', $html);
                $this->assertStringContainsString('Línea de corte', $html);
                $this->assertSame(2, substr_count($html, 'data-receipt-zone='), 'Dos zonas apiladas');
                $this->assertStringContainsString('Ejemplar del paciente', $html);
                $this->assertStringContainsString('Ejemplar para archivo del hospital', $html);
                $this->assertSame(1, substr_count($html, 'class="receipt-page'), 'Una hoja compuesta');
            } else {
                $this->assertStringContainsString('data-receipt-composition="single"', $html);
                $this->assertStringContainsString('PRIMERA COPIA', $html);
                $this->assertSame(2, substr_count($html, 'class="receipt-page'), 'Una página por destino');
            }

            // Mismo documento: el número aparece en ambos ejemplares. Se cuenta la
            // presencia (puede repetirse dentro de una zona), no una cifra exacta.
            $this->assertGreaterThanOrEqual(
                2,
                substr_count($html, $receipt->receipt_number_full),
                'El número del documento aparece en los dos ejemplares',
            );

            foreach ($items as $index => $item) {
                $this->assertSame(
                    2,
                    substr_count($html, $item['service_name']),
                    "dos ejemplares {$itemCount}: line ".($index + 1).' must appear once per exemplar',
                );
            }

            // El modo de dos ejemplares declara dos ejemplares.
            $twoCopyProfile = $profile->fresh();
            $twoCopyProfile->forceFill(['copies_mode' => 'original_first'])->save();
            $this->assertSame(2, count($service->copyLabelsForProfile($twoCopyProfile)));
        }
    }

    public function test_a_long_operation_falls_back_to_one_legible_page_per_destination(): void
    {
        $profile = $this->profile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);
        $items = $this->ordinaryItems(11);
        $receipt = $this->receiptFixture($items, $profile, copyMode: 'original_first');

        $service = app(InstitutionalReceiptPdfService::class);
        $html = $service->htmlForReceipt($receipt);
        $pdf = $service->pdfForReceipt($receipt);
        $this->writeEvidence('dos-ejemplares-11-conceptos-respaldo', $pdf);

        // No forced compact mode: the two stacked zones do not fit, so the
        // document falls back to one complete page per destination.
        $this->assertStringNotContainsString('data-receipt-composition="paired"', $html);
        $this->assertStringContainsString('data-receipt-composition="single"', $html);
        $this->assertStringContainsString('PRIMERA COPIA', $html);

        foreach ($items as $index => $item) {
            $this->assertSame(
                2,
                preg_match_all('/>\s*'.preg_quote($item['service_name'], '/').'\s*</u', $html),
                'Line '.($index + 1).' stays visible on both exemplars',
            );
        }

        $this->assertSame(2, $this->enginePageCount($html, $profile));
        $this->assertSame(2, $this->bytePageCount($pdf));
    }

    public function test_a4_portrait_can_also_stack_two_destinations_on_one_sheet(): void
    {
        $profile = $this->profile(ReceiptPrintProfile::CODE_A4_PORTRAIT);
        $receipt = $this->receiptFixture($this->ordinaryItems(2), $profile, copyMode: 'original_first');
        $html = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($receipt);

        $this->assertStringContainsString('data-receipt-composition="paired"', $html);
        $this->assertSame(1, $this->enginePageCount($html, $profile));
    }

    // ------------------------------------------------------------------
    // 3. Contrato de contenido
    // ------------------------------------------------------------------

    public function test_an_unknown_rule_adjustment_is_declared_instead_of_a_fake_zero(): void
    {
        $profile = $this->profile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);

        // Historical line: the record declares the adjustment was never written.
        $historical = $this->lineItem('Eritropoyetina histórica', unitPriceCents: 0, free: true) + [
            'unit_price_registered_cents' => 0,
            'unit_price_registered' => '0.00',
            'rule_adjustment_cents' => 0,
            'rule_adjustment' => '0.00',
            'rule_adjustment_persisted' => false,
        ];
        $html = app(InstitutionalReceiptPdfService::class)->htmlForReceipt(
            $this->receiptFixture([$historical], $profile),
        );

        $this->assertStringContainsString('No registrado', $html, 'A missing datum is declared');
        $this->assertDoesNotMatchRegularExpression(
            '/<td class="money">\s*- L\. 0\.00\s*<\/td>/u',
            $html,
            'A historical line must never print an invented zero adjustment',
        );

        // Current line: the adjustment is a measured value and prints as such, with
        // the registered reference price so precio - ajuste = importe holds.
        $current = $this->lineItem('Eritropoyetina vigente', unitPriceCents: 0, free: true) + [
            'unit_price_registered_cents' => 2500,
            'unit_price_registered' => '25.00',
            'rule_adjustment_cents' => 2500,
            'rule_adjustment' => '25.00',
            'rule_adjustment_persisted' => true,
        ];
        $measuredHtml = app(InstitutionalReceiptPdfService::class)->htmlForReceipt(
            $this->receiptFixture([$current], $profile),
        );

        $this->assertStringContainsString('- L. 25.00', $measuredHtml);
        $this->assertStringContainsString('L. 25.00', $measuredHtml, 'Registered reference price');
        $this->assertStringContainsString('Sin cobro', $measuredHtml);
        $this->assertStringNotContainsString('No registrado', $measuredHtml);
    }

    public function test_a_legitimate_zero_price_line_is_not_labeled_as_prescription_gratuity(): void
    {
        $profile = $this->profile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);
        $zeroPrice = $this->lineItem('Servicio autorizado a precio cero', unitPriceCents: 0);

        $html = app(InstitutionalReceiptPdfService::class)->htmlForReceipt(
            $this->receiptFixture([$zeroPrice], $profile),
        );

        $this->assertStringContainsString('Servicio autorizado a precio cero', $html);
        $this->assertStringNotContainsString('Sin cobro por receta', $html);
    }

    public function test_item_descriptor_deduplicates_equal_category_and_area_but_keeps_distinct_values(): void
    {
        $sameDescriptor = array_merge($this->lineItem('Glucosa'), [
            'category_name' => 'Laboratorio',
            'area_name' => 'Laboratorio',
        ]);
        $distinctDescriptors = array_merge($this->lineItem('Medicamento'), [
            'category_name' => 'Medicamentos',
            'area_name' => 'Farmacia',
        ]);

        foreach ([ReceiptPrintProfile::CODE_LETTER_PORTRAIT, ReceiptPrintProfile::CODE_THERMAL_80] as $profileCode) {
            $html = app(InstitutionalReceiptPdfService::class)->htmlForReceipt(
                $this->receiptFixture([$sameDescriptor, $distinctDescriptors], $this->profile($profileCode)),
            );

            $this->assertStringContainsString('Laboratorio', $html);
            $this->assertStringNotContainsString('Laboratorio / Laboratorio', $html);
            $this->assertStringContainsString('Medicamentos / Farmacia', $html);
        }
    }

    public function test_paired_receipt_preserves_top_margin_and_formats_large_amounts_without_splitting_headers(): void
    {
        $profile = $this->profile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);
        $html = app(InstitutionalReceiptPdfService::class)->htmlForReceipt(
            $this->receiptFixture([$this->lineItem('Glucosa', unitPriceCents: 1726725)], $profile, copyMode: 'original_first'),
        );

        $this->assertStringContainsString('data-receipt-composition="paired"', $html);
        $this->assertStringContainsString('margin: '.((float) $profile->margin_top_mm).'mm', $html);
        $this->assertStringContainsString('L. 17,267.25', $html);
        $this->assertStringNotContainsString('L. 17267.25', $html);
        $this->assertStringContainsString('.items-table th.money + th.money', $html);
    }

    public function test_the_snapshot_records_the_rule_adjustment_provenance_per_line(): void
    {
        $context = $this->invoiceContext();

        $measured = InvoiceItem::query()->create([
            'invoice_id' => $context['invoice']->id,
            'service_name' => 'Eritropoyetina vigente',
            'category_name' => 'Medicamentos',
            'quantity' => '1.00',
            'quantity_cents' => 100,
            'unit_price' => '0.00',
            'unit_price_cents' => 0,
            'unit_price_registered_cents' => 2500,
            'rule_adjustment_cents' => 2500,
            'tax_rate' => '0.00',
            'tax_amount' => '0.00',
            'tax_amount_cents' => 0,
            'line_subtotal' => '0.00',
            'line_subtotal_cents' => 0,
            'line_total' => '0.00',
            'line_total_cents' => 0,
            'special_rule_applied' => true,
        ]);

        $backfilled = InvoiceItem::query()->create([
            'invoice_id' => $context['invoice']->id,
            'service_name' => 'Eritropoyetina histórica',
            'category_name' => 'Medicamentos',
            'quantity' => '1.00',
            'quantity_cents' => 100,
            'unit_price' => '0.00',
            'unit_price_cents' => 0,
            'unit_price_registered_cents' => 0,
            'rule_adjustment_cents' => 0,
            'tax_rate' => '0.00',
            'tax_amount' => '0.00',
            'tax_amount_cents' => 0,
            'line_subtotal' => '0.00',
            'line_subtotal_cents' => 0,
            'line_total' => '0.00',
            'line_total_cents' => 0,
            'special_rule_applied' => true,
        ]);

        $snapshot = app(BuildInstitutionalReceiptSnapshotAction::class)->execute(
            $context['invoice']->fresh()->load('items'),
            $context['series'],
            $context['profile'],
            $context['user'],
            $context['cashSession'],
            null,
            'REC-C2B7-00000001',
        );

        $byName = collect($snapshot['items_snapshot'])->keyBy('service_name');

        $this->assertTrue($byName[$measured->service_name]['rule_adjustment_persisted']);
        $this->assertSame(2500, $byName[$measured->service_name]['rule_adjustment_cents']);
        $this->assertFalse(
            $byName[$backfilled->service_name]['rule_adjustment_persisted'],
            'A backfilled historical zero must be declared unknown, never measured',
        );
    }

    public function test_receipt_keeps_the_institution_identity_frozen_on_the_invoice(): void
    {
        $context = $this->invoiceContext();
        $context['invoice']->forceFill([
            'hospital_name' => 'Hospital al emitir',
            'hospital_rtn' => 'RTN-EMISION',
            'hospital_address' => 'Direccion al emitir',
            'receipt_location' => 'Lugar al emitir',
        ])->save();

        FiscalSetting::query()->firstOrFail()->forceFill([
            'hospital_name' => 'Hospital configurado despues',
            'rtn' => 'RTN-NUEVO',
            'address' => 'Direccion nueva',
            'receipt_location' => 'Lugar nuevo',
        ])->save();

        $snapshot = app(BuildInstitutionalReceiptSnapshotAction::class)->execute(
            $context['invoice']->fresh(),
            $context['series'],
            $context['profile'],
            $context['user'],
            $context['cashSession'],
            null,
            'REC-C2B7-00000002',
        );

        $this->assertSame('Hospital al emitir', $snapshot['institution_snapshot']['hospital_name']);
        $this->assertSame('RTN-EMISION', $snapshot['institution_snapshot']['rtn']);
        $this->assertSame('Direccion al emitir', $snapshot['institution_snapshot']['address']);
        $this->assertSame('Lugar al emitir', $snapshot['institution_snapshot']['receipt_location']);
    }

    public function test_a_free_document_uses_gratuity_wording_and_never_claims_cash(): void
    {
        $profile = $this->profile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);
        $items = $this->ordinaryItems(2);
        $items[] = $this->lineItem('Eritropoyetina', unitPriceCents: 0, free: true) + [
            'unit_price_registered_cents' => 2500,
            'unit_price_registered' => '25.00',
            'rule_adjustment_cents' => 2500,
            'rule_adjustment' => '25.00',
            'rule_adjustment_persisted' => true,
        ];

        $receipt = $this->receiptFixture($items, $profile);
        // A legitimate zero: the document total and the received amount are both zero.
        $invoice = $receipt->invoice_snapshot;
        $invoice['total_cents'] = 0;
        $invoice['total'] = '0.00';
        $invoice['paid_amount_cents'] = 0;
        $invoice['paid_amount'] = '0.00';
        $invoice['balance_due_cents'] = 0;
        $invoice['balance_due'] = '0.00';
        $receipt->forceFill([
            'amount_cents' => 0,
            'amount' => '0.00',
            'amount_words' => app(AmountToSpanishWords::class)->forCents(0),
            'invoice_snapshot' => $invoice,
        ])->save();

        $html = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($receipt->fresh());

        $this->assertStringContainsString('Emitido sin cobro', $html);
        $this->assertStringContainsString('CERO LEMPIRAS CON 00/100 CENTAVOS', $html);
        $this->assertStringContainsString('Documento sin cobro: no se recibió efectivo.', $html);
        $this->assertStringNotContainsString('haber enterado', $html, 'A zero document never claims cash was received');
    }

    public function test_the_amount_in_words_speaks_the_amount_it_refers_to_on_a_partial_payment(): void
    {
        $profile = $this->profile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);
        $words = app(AmountToSpanishWords::class);

        $receipt = $this->receiptFixture($this->ordinaryItems(2), $profile);
        $invoice = $receipt->invoice_snapshot;
        $invoice['total_cents'] = 10000;
        $invoice['total'] = '100.00';
        $invoice['paid_amount_cents'] = 4000;
        $invoice['paid_amount'] = '40.00';
        $invoice['balance_due_cents'] = 6000;
        $invoice['balance_due'] = '60.00';
        $receipt->forceFill([
            'amount_cents' => 10000,
            'amount' => '100.00',
            'amount_words' => $words->forCents(10000),
            'invoice_snapshot' => $invoice,
        ])->save();

        $html = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($receipt->fresh());

        // The "haber enterado" sentence describes what was received, so it speaks
        // the received amount...
        $this->assertStringContainsString($words->forCents(4000), $html, 'The words speak the received amount');
        // ...and the document total is stated explicitly, so the words can never be
        // attributed to the wrong figure.
        $this->assertStringContainsString('Total del documento: L. 100.00', $html);
        $this->assertStringContainsString($words->forCents(10000), $html, 'The total stays explicit');
        $this->assertStringContainsString('Saldo pendiente', $html);
    }

    // ------------------------------------------------------------------
    // Fixtures
    // ------------------------------------------------------------------

    protected function profile(string $code): ReceiptPrintProfile
    {
        return ReceiptPrintProfile::query()->where('code', $code)->firstOrFail();
    }

    /**
     * @return list<array<string, mixed>>
     */
    protected function ordinaryItems(int $count): array
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
    protected function lineItem(string $name, int $unitPriceCents = 2500, bool $free = false): array
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
    protected function receiptFixture(
        array $items,
        ReceiptPrintProfile $profile,
        string $copyMode = 'original_only',
    ): InstitutionalReceipt {
        $user = User::factory()->create(['name' => 'Cajera C2B7']);
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
            'series' => 'REC-C2B7',
            'prefix' => 'RC',
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'max_number' => 999999,
            'current_number' => 0,
            'range_authorization' => 'AUT-REC-C2B7',
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
            'receipt_number_full' => 'REC-C2B7'.str_pad((string) $receiptNumber, 8, '0', STR_PAD_LEFT),
            'status' => InstitutionalReceipt::STATUS_ISSUED,
            'amount' => $total,
            'amount_cents' => $totalCents,
            'issued_at' => Carbon::parse('2026-09-20 08:30:00'),
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
                'receipt_number_full' => 'REC-C2B7'.str_pad((string) $receiptNumber, 8, '0', STR_PAD_LEFT),
                'receipt_number_color' => '#b91c1c',
                'legal_text' => 'Suscribe. CERTIFICA haber enterado en esta oficina la suma de',
                'range_authorization' => 'AUT-REC-C2B7',
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
                'invoice_number' => 'INV-C2B7-00000001',
                'fiscal_cai' => null,
                'fiscal_range_from' => null,
                'fiscal_range_to' => null,
                'fiscal_valid_until' => null,
                'patient_name' => 'María López',
                'issued_at' => '2026-09-20T08:30:00-06:00',
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
                    'paid_at' => '2026-09-20T08:30:00-06:00',
                    'cashier_name' => 'Cajera C2B7',
                ],
                'posted_payments' => [],
                'cash_context' => [
                    'cash_register_label' => 'Caja principal',
                    'cashier_name' => 'Cajera C2B7',
                    'opened_at' => '2026-09-20T08:00:00-06:00',
                ],
                'issued_by' => ['name' => 'Cajera C2B7'],
            ],
            'items_snapshot' => $items,
            'reprint_count' => 0,
        ]);
    }

    /**
     * @return array{user: User, invoice: Invoice, series: InstitutionalReceiptSeries, profile: ReceiptPrintProfile, cashSession: CashRegisterSession}
     */
    protected function invoiceContext(): array
    {
        FiscalSetting::query()->updateOrCreate([], [
            'hospital_name' => 'Hospital General San Isidro',
            'rtn' => '08011999123456',
            'default_tax_rate' => '0.00',
            'receipt_width' => '80mm',
            'receipt_template_mode' => 'institutional',
            'receipt_paper_size' => 'letter',
            'receipt_location' => 'Tocoa, Colón, Honduras',
        ]);

        $user = User::factory()->create(['name' => 'Cajera Snapshot']);
        $user->assignRole('cajero');

        $cashSession = CashRegisterSession::query()->create([
            'user_id' => $user->id,
            'open_user_id' => $user->id,
            'opening_amount' => '0.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        // `invoices.fiscal_sequence_id` es NOT NULL: el fixture debe declarar la
        // secuencia que emitió la factura (mismo patrón que el resto de la suite).
        $fiscalSequence = FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => '000-001-01',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 0,
            'cai' => 'C2B7-SNAPSHOT-CAI',
            'valid_until' => now()->addYear()->toDateString(),
            'active' => true,
        ]);

        $invoice = Invoice::query()->create([
            'invoice_number' => 'INV-C2B7-SNAP-'.random_int(1000, 9999),
            'fiscal_sequence_id' => $fiscalSequence->id,
            'hospital_name' => 'Hospital General San Isidro',
            'patient_name' => 'Paciente Snapshot',
            'receipt_template_mode' => 'institutional',
            'receipt_paper_size' => 'letter',
            'tax_label' => 'ISV',
            'tax_rate_snapshot' => '0.00',
            'subtotal' => '0.00',
            'subtotal_cents' => 0,
            'tax_amount' => '0.00',
            'tax_amount_cents' => 0,
            'discount_amount' => '0.00',
            'discount_amount_cents' => 0,
            'total' => '0.00',
            'total_cents' => 0,
            'paid_amount' => '0.00',
            'paid_amount_cents' => 0,
            'balance_due' => '0.00',
            'balance_due_cents' => 0,
            'status' => Invoice::STATUS_PAID,
            'cash_session_id' => $cashSession->id,
            'issued_by' => $user->id,
            'issued_at' => now(),
        ]);

        $series = InstitutionalReceiptSeries::query()->create([
            'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
            'series' => 'REC-SNAP',
            'prefix' => 'RS',
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'max_number' => 999999,
            'current_number' => 0,
            'active' => false,
        ]);

        return [
            'user' => $user,
            'invoice' => $invoice,
            'series' => $series,
            'profile' => $this->profile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT),
            'cashSession' => $cashSession,
        ];
    }

    // ------------------------------------------------------------------
    // Real-engine measurement
    // ------------------------------------------------------------------

    protected function enginePageCount(string $html, ReceiptPrintProfile $profile): int
    {
        $wrapper = Pdf::loadHTML($html);
        $wrapper->setPaper(PaperSize::fromProfile($profile));
        $dompdf = $wrapper->getDomPDF();
        $dompdf->render();

        return $dompdf->getCanvas()->get_page_count();
    }

    protected function bytePageCount(string $pdf): int
    {
        return preg_match_all('/\/Type\s*\/Page\b/', $pdf);
    }

    /**
     * @return array{0: float, 1: float, 2: float, 3: float}
     */
    protected function firstMediaBox(string $pdf): array
    {
        $this->assertSame(1, preg_match('/\/MediaBox\s*\[([^\]]+)\]/', $pdf, $matches));

        $values = array_values(array_filter(
            preg_split('/\s+/', trim($matches[1])) ?: [],
            static fn (string $value): bool => $value !== '',
        ));

        return array_map(static fn (string $value): float => (float) $value, $values);
    }

    /**
     * C3-P1b — cabida con el BLOQUE FISCAL presente (el caso real).
     *
     * La suite original dejaba `fiscal_cai`/rango/límite en `null`, así que la
     * plantilla no pintaba el bloque fiscal y las pruebas de cabida medían un
     * documento **más corto que el real**. Con el bloque presente, un comprobante
     * de 11 conceptos en carta y uno de 5 en media carta **no** cabían en una
     * página. Se corrigió agrupando los metadatos institucionales y fiscales en
     * líneas compartidas y ajustando el relleno vertical.
     *
     * Esta prueba fija el caso real: sin ella, la regresión volvería.
     */
    public function test_capacity_holds_with_the_fiscal_block_present(): void
    {
        $service = app(InstitutionalReceiptPdfService::class);

        $cases = [
            [ReceiptPrintProfile::CODE_LETTER_PORTRAIT, 11, [0.0, 0.0, 612.0, 792.0]],
            [ReceiptPrintProfile::CODE_HALF_LETTER, 5, [0.0, 0.0, 612.0, 396.0]],
        ];

        foreach ($cases as [$code, $count, $box]) {
            $profile = $this->profile($code);
            $receipt = $this->withFiscalBlock(
                $this->receiptFixture($this->ordinaryItems($count), $profile),
            );

            $html = $service->htmlForReceipt($receipt);
            $pdf = $service->pdfForReceipt($receipt);

            $this->assertSame($box, $this->firstMediaBox($pdf), "{$code}: geometría del perfil");
            $this->assertSame(
                1,
                $this->bytePageCount($pdf),
                "{$code} con {$count} conceptos y bloque fiscal: una página",
            );
            $this->assertStringContainsString('CAI', $html, 'el bloque fiscal se imprime');

            $this->writeEvidence(
                "{$code}-{$count}-conceptos-con-fiscal",
                $pdf,
            );

            foreach ($this->ordinaryItems($count) as $item) {
                // El nombre puede ser prefijo de otro («…1» vs «…10»/«…11»): se
                // exige que no le siga un dígito.
                $this->assertSame(
                    1,
                    preg_match_all('/'.preg_quote($item['service_name'], '/').'(?!\d)/u', $html),
                    "{$code}: cada concepto una vez, sin ocultar líneas",
                );
            }
        }
    }

    /** Añade el bloque fiscal que el comprobante real siempre trae. */
    protected function withFiscalBlock(InstitutionalReceipt $receipt): InstitutionalReceipt
    {
        $snapshot = $receipt->invoice_snapshot;
        $snapshot['fiscal_cai'] = 'A1B2C3-D4E5F6-A7B8C9-D0E1F2-AB';
        $snapshot['fiscal_range_from'] = '000-001-01-00000001';
        $snapshot['fiscal_range_to'] = '000-001-01-00005000';
        $snapshot['fiscal_valid_until'] = '2027-12-31';
        $receipt->invoice_snapshot = $snapshot;
        $receipt->save();

        return $receipt->fresh();
    }

    /**
     * Escribe el PDF de evidencia cuando el coordinador lo pide por entorno
     * (`RECEIPT_C3P1_EVIDENCE_DIR`), igual que el resto de evidencias del
     * proyecto. La suite normal no depende de esta variable.
     */
    protected function writeEvidence(string $name, string $pdf): void
    {
        $directory = trim((string) getenv('RECEIPT_C3P1_EVIDENCE_DIR'));

        if ($directory === '') {
            return;
        }

        if (! is_dir($directory)) {
            mkdir($directory, 0777, true);
        }

        file_put_contents($directory.DIRECTORY_SEPARATOR.$name.'.pdf', $pdf);
    }

    /**
     * Tamaño base de detalle que el documento declara, expresado en puntos.
     * Determinista y medido sobre el HTML realmente generado.
     */
    protected function declaredBodyFontSizePt(string $html): float
    {
        preg_match('/body\s*\{[^}]*font-size:\s*([\d.]+)px/s', $html, $matches);

        $this->assertNotEmpty($matches[1] ?? null, 'El documento debe declarar el tamaño base de detalle.');

        return (float) $matches[1] * 0.75;
    }
}
