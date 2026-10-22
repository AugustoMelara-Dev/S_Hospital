<?php

namespace Tests\Feature;

use App\Actions\InstitutionalReceipts\AmountToSpanishWords;
use App\Actions\InstitutionalReceipts\InstitutionalReceiptHtmlBuilder;
use App\Actions\InstitutionalReceipts\InstitutionalReceiptPdfService;
use App\Models\CashRegisterSession;
use App\Models\FiscalSetting;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptPrintEvent;
use App\Models\InstitutionalReceiptSeries;
use App\Models\ReceiptPrintProfile;
use App\Models\User;
use App\Support\Money;
use App\Support\PaperSize;
use Barryvdh\DomPDF\Facade\Pdf;
use Database\Seeders\ReceiptPrintProfileSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * C4-Papel §2 — matriz focalizada de regresión con CONTENIDO REPRESENTATIVO.
 *
 * Extiende (sin duplicar) las regresiones existentes —
 * `InstitutionalReceiptPaperCompositionTest` (cabida con bloque fiscal),
 * `InstitutionalReceiptCompactTemplateTest` (carta 1-11) y
 * `InstitutionalReceiptDocumentPlanTest` (plan medido)— con el contenido que el
 * comprobante real trae y la fixture histórica no cubría:
 *
 * - metadatos institucionales configurados presentes (gobierno, secretaría,
 *   hospital, dirección, RTN, teléfono, ubicación, pie);
 * - nombre largo razonable de paciente;
 * - descripciones de catálogo que ENVUELVEN en la columna de descripción;
 * - CAI / rango / límite de longitud representativa;
 * - importe en letras largo (total L. 12,345.67);
 * - EPO mezclada con líneas ordinarias (gratuidad por línea, ajuste visible);
 * - pago parcial cuando `fiscal_settings.partial_payments_enabled` está activo;
 * - reimpresión (etiqueta #n) sin falsificar la primera entrega.
 *
 * Para cada caso se registra en `manifiesto_matriz.json` (cuando
 * `RECEIPT_C4_EVIDENCE_DIR` apunta a `hospital-ai/evidencia/C4-Papel`): tamaño,
 * páginas (motor y bytes), MediaBox, márgenes del perfil y de la `@page`,
 * campos presentes, número de conceptos, ventana de detalle declarada y el plan
 * medido (composición, alternativa). Los tamaños de FUENTE reales del PDF se
 * miden después con PyMuPDF sobre los bytes (`medir_geometria_c4.py`).
 *
 * Datos sintéticos desechables (RefreshDatabase sobre el runner asignado en
 * `phpunit.xml`: sqlite :memory:). Ningún caso toca la base operativa.
 */
class InstitutionalReceiptC4PaperMatrixTest extends TestCase
{
    use RefreshDatabase;

    /** @var array<string, array<string, mixed>> acumulado del manifiesto por ejecución */
    private static array $manifest = [];

    /** @var list<array<string, mixed>> trazas de las escrituras de PDF de esta ejecución */
    private static array $writeLog = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);
    }

    // ------------------------------------------------------------------
    // 1. Matriz representativa (media carta 1/2/5 y carta 11)
    // ------------------------------------------------------------------

    public function test_representative_matrix_keeps_every_field_and_concept_on_the_real_engine(): void
    {
        $service = app(InstitutionalReceiptPdfService::class);

        foreach ($this->matrixCases() as $name => $case) {
            $profile = $this->profile($case['profile']);
            $receipt = $this->withFiscalBlock(
                $this->receiptFixture(
                    $case['items'],
                    $profile,
                    payerName: $case['payer_name'],
                    amountCents: $case['amount_cents'] ?? null,
                    paidCents: $case['paid_cents'] ?? null,
                    reprintCount: $case['reprint_count'] ?? 0,
                ),
            );

            $html = $service->htmlForReceipt($receipt);
            $plan = $service->planForReceipt($receipt);
            $pdf = $service->pdfForReceipt($receipt);
            $pages = $this->bytePageCount($pdf);

            // Geometría exacta del perfil: papel nativo, sin escala ni recorte.
            $this->assertSame($case['box'], $this->firstMediaBox($pdf), "{$name}: MediaBox exacto");
            $this->assertSame(
                $plan->pageCount(),
                $pages,
                "{$name}: las páginas publicadas por el plan son las del PDF emitido",
            );

            // Campos institucionales configurados, presentes en el documento.
            foreach ($this->institutionalNeedles() as $needle) {
                $this->assertStringContainsString($needle, $html, "{$name}: campo institucional «{$needle}»");
            }

            // Bloque fiscal completo: CAI, rango de autorización y límite.
            foreach ([
                'CAI',
                'A1B2C3-D4E5F6-A7B8C9-D0E1F2-AB',
                'Rango',
                '000-001-01-00000001',
                '000-001-01-00005000',
                'Límite',
                '31/12/2027',
            ] as $needle) {
                $this->assertStringContainsString($needle, $html, "{$name}: fiscal «{$needle}»");
            }

            // Nombre largo de paciente y descripciones envesantes: presentes una
            // sola vez cada uno (ni ocultos ni duplicados).
            $this->assertStringContainsString($case['payer_name'], $html, "{$name}: nombre del paciente");

            foreach ($case['items'] as $item) {
                $this->assertSame(
                    1,
                    preg_match_all('/'.preg_quote($item['service_name'], '/').'(?!\d)/u', $html),
                    "{$name}: concepto «{$item['service_name']}» exactamente una vez",
                );
            }

            // Ventana de detalle 10-11 pt sobre el tamaño que el documento declara.
            $detailPt = $this->declaredBodyFontSizePt($html);
            $this->assertGreaterThanOrEqual(10.0, $detailPt, "{$name}: detalle >= 10 pt");
            $this->assertLessThanOrEqual(11.0, $detailPt, "{$name}: detalle <= 11 pt");

            // Área de escritura de firma y sello intacta: la altura declarada es
            // la de la densidad que el papel exige (media carta y zonas de media
            // hoja usan 18/15 px; carta y A4 en densidad `full` usan 34/31 px).
            // En ninguno de los dos casos el relleno recorta el área de escritura.
            $isHalf = $profile->paper_kind === 'half_letter_landscape';
            $this->assertMatchesRegularExpression(
                '/\.signature-space\s*\{[^}]*height:\s*'.($isHalf ? '18px' : '34px').'/',
                $html,
                "{$name}: área de firma de la densidad conservada",
            );
            $this->assertMatchesRegularExpression(
                '/\.seal-space\s*\{[^}]*height:\s*'.($isHalf ? '15px' : '31px').'/',
                $html,
                "{$name}: área de sello de la densidad conservada",
            );

            // Reimpresión: solo el caso que realmente la trae lleva etiqueta.
            if (($case['reprint_count'] ?? 0) > 0) {
                $this->assertStringContainsString('REIMPRESIÓN #2', $html, "{$name}: etiqueta de reimpresión");
            } else {
                $this->assertStringNotContainsString('REIMPRESIÓN', $html, "{$name}: sin etiqueta falsa");
            }

            // Continuación identificada: si el contenido extenso ocupa más de una
            // página, el plan lo declara con motivo legible; si cabe, no inventa
            // alternativa. En ambos casos no se pierde ningún concepto (arriba) y
            // el cierre (totales, letras, firmas) sigue íntegro.
            if ($pages > 1) {
                $this->assertTrue($plan->alternativeOutput(), "{$name}: desbordamiento declarado");
                $this->assertStringContainsString(
                    'páginas adicionales',
                    (string) $plan->alternativeReason(),
                    "{$name}: motivo legible de continuación",
                );
                $this->assertStringContainsString('display: table-header-group', $html, "{$name}: cabecera repetida");
            } else {
                $this->assertFalse($plan->alternativeOutput(), "{$name}: una página no es salida alternativa");
            }

            foreach (['Monto en letras', 'Firma del enterante', 'Sello y firma autorizada', 'Situación del pago', 'Total'] as $closing) {
                $this->assertStringContainsString($closing, $html, "{$name}: cierre íntegro «{$closing}»");
            }

            // EPO mezclada: la línea gratuita conserva etiqueta, precio de
            // referencia, ajuste visible y importe cero — sin tocar las demás.
            if ($case['epo']) {
                $this->assertSame(1, substr_count($html, 'Sin cobro'), "{$name}: una sola línea sin cobro");
                $this->assertStringContainsString('- L. 25.00', $html, "{$name}: ajuste autorizado visible");
                $this->assertStringContainsString('L. 0.00', $html, "{$name}: importe cero de la EPO");
            }

            // Pago parcial: situacion, saldo y palabras del RECIBIDO con el total
            // declarado por separado.
            if ($case['parcial']) {
                $this->assertStringContainsString('Saldo pendiente', $html, "{$name}: situación parcial");
                $this->assertStringContainsString(
                    'Total del documento: L. '.Money::formatCents($case['amount_cents']),
                    $html,
                    "{$name}: total declarado por separado",
                );
                $this->assertStringContainsString(
                    app(AmountToSpanishWords::class)->forCents($case['paid_cents']),
                    $html,
                    "{$name}: las letras describen lo recibido",
                );
            }

            $this->writePdf('pdf/'.$name, $pdf);
            $this->recordManifest($name, [
                'nombre' => $name,
                'perfil' => $case['profile'],
                'papel_box' => $this->firstMediaBox($pdf),
                'margen_perfil_mm' => [
                    'top' => (float) $profile->margin_top_mm,
                    'right' => (float) $profile->margin_right_mm,
                    'bottom' => (float) $profile->margin_bottom_mm,
                    'left' => (float) $profile->margin_left_mm,
                ],
                'margen_pagina_mm' => $this->pageMarginsMm($html),
                'conceptos' => count($case['items']),
                'epo' => (bool) $case['epo'],
                'pago_parcial' => (bool) $case['parcial'],
                'reimpresion' => ($case['reprint_count'] ?? 0) > 0,
                'etiqueta_reimpresion' => ($case['reprint_count'] ?? 0) > 0 ? 'REIMPRESIÓN #2' : null,
                'detalle_declarado_pt' => $this->declaredBodyFontSizePt($html),
                'paginas_motor' => $plan->pageCount(),
                'paginas_bytes' => $pages,
                'bytes' => strlen($pdf),
                'composicion_solicitada' => $plan->requestedComposition(),
                'composicion_usada' => $plan->usedComposition(),
                'salida_alternativa' => $plan->alternativeOutput(),
                'motivo_alternativa' => $plan->alternativeReason(),
                'campos' => array_values(array_filter(
                    array_merge($this->institutionalNeedles(), [
                        'CAI', 'A1B2C3-D4E5F6-A7B8C9-D0E1F2-AB', 'Rango', 'Límite',
                        '31/12/2027', $case['payer_name'],
                    ]),
                    static fn (string $needle): bool => str_contains($html, $needle),
                )),
                'limite_contenido' => $pages > 1
                    ? 'continuación en página adicional declarada por el plan (sin pérdida de conceptos)'
                    : 'una sola página',
            ]);
        }

        // La evidencia DE existir cuando el coordinador la pida: un fallo
        // silencioso de escritura no puede pasar inadvertido.
        $this->writeJson('diagnostico_escritura.json', self::$writeLog);

        if (($root = $this->evidenceRoot()) !== null) {
            $this->assertFileExists(
                $root.DIRECTORY_SEPARATOR.'pdf'.DIRECTORY_SEPARATOR.'c4-media-carta-1-concepto-fiscal.pdf',
                'el PDF de la matriz se escribe en C4-Papel/pdf/',
            );
        }
    }

    // ------------------------------------------------------------------
    // 2. Sonda de altura mínima: qué miden 790.6 y 392.1, reproducida
    // ------------------------------------------------------------------

    /**
     * §4 del encargo — trazabilidad verificable de las cifras de C3.
     *
     * `790.6` y `392.1` las produjo `minHeightForOnePage()` de la sonda
     * `ZzC3FiscalProbeTest` (archivada en
     * `hospital-ai/evidencia/C3-P1/SONDA_BLOQUE_FISCAL.php.txt:85-104`) y se
     * publicaron como `min_sheet_height_pt` en `probe/probe_fiscal.json:36,72`.
     * NO son coordenadas de tinta: es la MENOR ALTURA DE HOJA (sistema PDF
     * estándar, origen en la esquina inferior izquierda del MediaBox
     * `[0, 0, 612, H]`) a la que Dompdf emite UNA sola página, obtenida por
     * búsqueda binaria entre 60 pt y el doble de 396 pt con tolerancia 1 pt.
     *
     * Esta prueba replanta la MISMA función sobre el HTML de hoy con los MISMOS
     * datos de la sonda (11 conceptos ordinarios + bloque fiscal; 5 + bloque
     * fiscal) y publica el resultado en `reproduccion_altura_minima.json`.
     */
    public function test_min_height_probe_reproduces_what_790_6_and_392_1_measure(): void
    {
        $service = app(InstitutionalReceiptPdfService::class);
        $references = [
            'carta_vertical-11-conceptos-con-fiscal' => [
                'perfil' => ReceiptPrintProfile::CODE_LETTER_PORTRAIT,
                'conceptos' => 11,
                'hoja_pt' => 792.0,
                'c3_min_sheet_height_pt' => 790.6,
                // Densidad `full`: su CSS no vive en el bloque `@if ($isHalf)`
                // que se editó después de la sonda de C3, así que la cifra
                // histórica debe reproducirse exacta.
                'reproduccion_exacta' => true,
            ],
            'media_carta_horizontal-5-conceptos-con-fiscal' => [
                'perfil' => ReceiptPrintProfile::CODE_HALF_LETTER,
                'conceptos' => 5,
                'hoja_pt' => 396.0,
                'c3_min_sheet_height_pt' => 392.1,
                // Densidad `half`: `compact-styles.blade.php` se modificó a las
                // 11:17:44,30 min DESPUÉS de `probe_fiscal.json` (10:47:16), y
                // el INFORME de C3 (11:35) citó392.1 sin re-medir. Se exige que
                // hoy NO se necesite MÁS hoja que la cifra histórica (no empeorar),
                // no la igualdad exacta sobre un CSS que ya cambió.
                'reproduccion_exacta' => false,
                // Valor sin bloque fiscal archivado en C3 (report-post-fix.json,
                // candidato C0): sirve de referencia para ubicar el desplazamiento.
                'c3_min_sin_fiscal_pt' => 386.2,
            ],
        ];

        $report = [
            'funcion' => 'minHeightForOnePage(string $html): float',
            'definicion' => 'Menor altura de HOJA (pt) a la que Dompdf produce exactamente 1 página; búsqueda binaria [60 pt, high] con tolerancia 1.0 pt, high inicial 396 pt y hasta 8 doublings.',
            'origen_coordenadas' => 'Altura de hoja en unidades PDF estándar: MediaBox [0, 0, 612, H], origen en la esquina inferior izquierda. NO es una coordenada de tinta ni una distancia al borde.',
            'caja' => 'MediaBox de la hoja (setPaper([0, 0, 612, altura])); el CropBox la copia y no hay rotación ni UserUnit.',
            'productor_original' => 'hospital-ai/evidencia/C3-P1/SONDA_BLOQUE_FISCAL.php.txt:85-114 → probe/probe_fiscal.json (min_sheet_height_pt)',
            'fixture' => 'réplica exacta de los strings renderizados de InstitutionalReceiptPaperCompositionTest::receiptFixture, el fixture con el que la sonda C3 midió (asC3ProbeFixture)',
            'casos' => [],
        ];

        foreach ($references as $key => $meta) {
            $profile = $this->profile($meta['perfil']);
            $receipt = $this->asC3ProbeFixture(
                $this->withFiscalBlock(
                    $this->receiptFixture($this->ordinaryItems($meta['conceptos']), $profile),
                ),
            );
            $html = $service->htmlForReceipt($receipt);

            $minHeight = $this->minHeightForOnePage($html);
            $pagesAtSheet = $this->pagesAtHeight($html, $meta['hoja_pt']);

            if ($meta['reproduccion_exacta']) {
                // Mismo fixture, misma función, mismo motor: la cifra histórica
                // se reproduce exacta. Si esto falla, la sonda de C3 no medía esto.
                $this->assertEqualsWithDelta(
                    $meta['c3_min_sheet_height_pt'],
                    $minHeight,
                    0.05,
                    "{$key}: el mismo fixture y la misma función reproducen la cifra de C3",
                );
            } else {
                // El CSS `half` cambió después de la captura de C3: se exige el
                // sentido de la desigualdad que importa (hoy la hoja que necesita
                // el documento NO supera la cifra histórica), y la igualdad se
                // registra como dato, no como aserción sobre un binario que ya no
                // existe.
                $this->assertLessThanOrEqual(
                    $meta['c3_min_sheet_height_pt'] + 0.05,
                    $minHeight,
                    "{$key}: hoy no se necesita más hoja que la cifra de C3 (no empeora)",
                );
            }

            // Referencia sin bloque fiscal (solo media carta): permite ubicar el
            // desplazamiento de2 pt en la base `half` o en la fila fiscal.
            $minSinFiscal = null;
            if (array_key_exists('c3_min_sin_fiscal_pt', $meta)) {
                $minSinFiscal = $this->minHeightForOnePage(
                    $service->htmlForReceipt(
                        $this->asC3ProbeFixture(
                            $this->receiptFixture($this->ordinaryItems($meta['conceptos']), $profile),
                        ),
                    ),
                );
            }

            // La cifra mide PRESUPUESTO de hoja: con la hoja real cabe, y la
            // resta contra la hoja es holgura de ese presupuesto, no tinta.
            $this->assertSame(1, $pagesAtSheet, "{$key}: la hoja real produce una página");
            $this->assertLessThanOrEqual(
                $meta['hoja_pt'],
                $minHeight,
                "{$key}: la altura mínima no supera la hoja",
            );
            $this->assertGreaterThan(
                $meta['hoja_pt'] - 60.0,
                $minHeight,
                "{$key}: la cifra es del orden de la hoja (presupuesto, no tinta)",
            );

            $report['casos'][$key] = [
                'hoja_real_pt' => $meta['hoja_pt'],
                'min_sheet_height_reproducido_pt' => $minHeight,
                'c3_min_sheet_height_pt' => $meta['c3_min_sheet_height_pt'],
                'coincide_con_c3' => abs($minHeight - $meta['c3_min_sheet_height_pt']) < 0.05,
                'reproduccion_exacta_exigida' => (bool) $meta['reproduccion_exacta'],
                'min_sheet_height_reproducido_sin_fiscal_pt' => $minSinFiscal,
                'c3_min_sin_fiscal_pt' => $meta['c3_min_sin_fiscal_pt'] ?? null,
                'holgura_de_presupuesto_pt' => round($meta['hoja_pt'] - $minHeight, 1),
                'paginas_a_hoja_real' => $pagesAtSheet,
                'significado' => 'holgura del PRESUPUESTO DE ALTURA DE HOJA (contenido + margen superior + margen inferior), NO distancia de la tinta al borde del papel',
            ];
        }

        $this->writeJson('reproduccion_altura_minima.json', $report);

        foreach ($report['casos'] as $key => $case) {
            $this->assertArrayHasKey('holgura_de_presupuesto_pt', $case);
        }
    }

    // ------------------------------------------------------------------
    // 3. Preview vs emitido: PDFs y planes equivalentes, sin side-effects
    // ------------------------------------------------------------------

    /**
     * Iguala los strings RENDERIZADOS con los del fixture de C3
     * (`InstitutionalReceiptPaperCompositionTest::receiptFixture`), el que usó
     * `ZzC3FiscalProbeTest`. La búsqueda binaria de alturas es sensible a
     * cualquier envoltura distinta de línea: en una hoja tan ajustada como la
     * media carta, un nombre de cajero o de paciente distintos pueden mover la
     * frontera de un punto. Con los strings idénticos, la función debe
     * reproducir 790.6 y 392.1 exactamente.
     */
    private function asC3ProbeFixture(InstitutionalReceipt $receipt): InstitutionalReceipt
    {
        $full = 'REC-C2B7'.str_pad((string) $receipt->receipt_number, 8, '0', STR_PAD_LEFT);

        $series = $receipt->series_snapshot;
        $series['series'] = 'REC-C2B7';
        $series['receipt_number_full'] = $full;
        $series['range_authorization'] = 'AUT-REC-C2B7';

        $invoice = $receipt->invoice_snapshot;
        $invoice['invoice_number'] = 'INV-C2B7-00000001';
        $invoice['patient_name'] = 'María López';
        $invoice['issued_at'] = '2026-09-20T08:30:00-06:00';

        $payment = $receipt->payment_snapshot;
        $payment['selected_payment']['cashier_name'] = 'Cajera C2B7';
        $payment['selected_payment']['paid_at'] = '2026-09-20T08:30:00-06:00';
        $payment['issued_by'] = ['name' => 'Cajera C2B7'];
        $payment['cash_context']['cashier_name'] = 'Cajera C2B7';
        $payment['cash_context']['cash_register_label'] = 'Caja principal';
        $payment['cash_context']['opened_at'] = '2026-09-20T08:00:00-06:00';

        $receipt->forceFill([
            'receipt_number_full' => $full,
            'series_snapshot' => $series,
            'invoice_snapshot' => $invoice,
            'payment_snapshot' => $payment,
            'payer_name' => 'María López de la Cruz con nombre largo para envolver',
            'concept' => 'Servicios hospitalarios de prueba',
            'issued_at' => Carbon::parse('2026-09-20 08:30:00'),
        ])->save();

        return $receipt->fresh();
    }

    // ------------------------------------------------------------------
    // 3. Preview vs emitido: PDFs y planes equivalentes, sin side-effects
    // ------------------------------------------------------------------

    public function test_preview_and_issued_documents_are_equivalent_and_leave_no_records(): void
    {
        $profile = $this->profile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);
        $profile->forceFill(['copies_mode' => 'original_first'])->save();
        $profile = $profile->fresh();

        // Metadatos institucionales configurados: la MISMA institución en la
        // configuración (que alimenta el borrador) y en el snapshot (emitido).
        FiscalSetting::query()->updateOrCreate([], [
            'hospital_name' => 'Hospital General San Isidro',
            'rtn' => '08011999123456',
            'government_line' => 'Gobierno de Honduras',
            'secretariat_line' => 'Secretaría de Salud',
            'address' => 'Tocoa, Colón',
            'phone' => '2444-0000',
            'receipt_location' => 'Tocoa, Colón, Honduras',
            'receipt_footer_text' => 'Documento de recaudación institucional.',
            'default_tax_rate' => '0.00',
            'receipt_template_mode' => 'institutional',
            'receipt_paper_size' => 'letter',
        ]);

        $series = InstitutionalReceiptSeries::query()->create([
            'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
            'series' => 'REC-C4PAP',
            'prefix' => 'RC',
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'max_number' => 999999,
            'current_number' => 4,
            'range_authorization' => 'AUT-C4-PAPEL',
            'legal_text' => 'Suscribe. CERTIFICA haber enterado en esta oficina la suma de',
            'active' => true,
        ]);

        $items = [$this->lineItem('Servicio hospitalario 1', unitPriceCents: 10000)];
        $receipt = $this->receiptFixture($items, $profile, copyMode: 'original_first');
        $service = app(InstitutionalReceiptPdfService::class);

        $receiptsBefore = InstitutionalReceipt::count();
        $eventsBefore = InstitutionalReceiptPrintEvent::count();
        $seriesBefore = (int) $series->fresh()->current_number;

        $issuedPlan = $service->planForReceipt($receipt);
        $draftPlan = $service->planForDraft([
            'payer_name' => $receipt->payer_name,
            'concept' => $receipt->concept,
            'amount' => $receipt->amount,
        ], $profile, $series);

        // El borrador NO crea factura, pago, recibo, correlativo ni evento.
        $this->assertSame($receiptsBefore, InstitutionalReceipt::count(), 'el borrador no crea recibos');
        $this->assertSame($eventsBefore, InstitutionalReceiptPrintEvent::count(), 'el borrador no registra impresión');
        $this->assertSame($seriesBefore, (int) $series->fresh()->current_number, 'el borrador no consume correlativo');

        // Correspondencia semántica y de geometría.
        $issued = $issuedPlan->toArray();
        $draft = $draftPlan->toArray();

        foreach (['requested_composition', 'used_composition', 'page_count', 'sheet_count'] as $key) {
            $this->assertSame($issued[$key], $draft[$key], "mismo plan: {$key}");
        }
        foreach (['kind', 'orientation', 'width_pt', 'height_pt'] as $key) {
            $this->assertSame($issued['paper'][$key], $draft['paper'][$key], "misma geometría: {$key}");
        }
        $this->assertSame($issued['copies'], $draft['copies'], 'mismos ejemplares y destinos');
        $this->assertSame($issued['distribution'], $draft['distribution'], 'misma distribución');
        $this->assertTrue($draft['draft'], 'el plan del borrador lo declara');
        $this->assertFalse($issued['draft'], 'el plan emitido no es borrador');

        $this->assertSame(InstitutionalReceiptHtmlBuilder::COMPOSITION_PAIRED, $issuedPlan->usedComposition());
        $this->assertSame(InstitutionalReceiptHtmlBuilder::COMPOSITION_PAIRED, $draftPlan->usedComposition());
        $this->assertSame(1, $issuedPlan->pageCount());
        $this->assertSame(1, $draftPlan->pageCount());

        // Marca de prueba inequívoca solo en el borrador.
        $this->assertStringContainsString('PRUEBA - SIN VALIDEZ', $draftPlan->html());
        $this->assertStringNotContainsString('PRUEBA - SIN VALIDEZ', $issuedPlan->html());

        // Número que cada camino debe mostrar en sus dos zonas: el emitido usa el
        // recibo real; el borrador usa el próximo formato de la serie SIN
        // consumirlo (se comprueba arriba que `current_number` no se mueve).
        $draftNumber = $series->series.'-'.str_pad((string) ($seriesBefore + 1), 8, '0', STR_PAD_LEFT);

        // Dos zonas: cada área, la separación y la línea de corte, en AMBOS.
        foreach (['borrador' => $draftPlan->html(), 'emitido' => $issuedPlan->html()] as $label => $html) {
            $this->assertSame(2, substr_count($html, 'data-receipt-zone='), "{$label}: dos zonas");
            // UNA línea de corte visible (`compact-pair.blade.php:84`). La cadena
            // «Línea de corte» aparece además una vez en un comentario CSS del
            // <style> (`compact-styles.blade.php:89`), que no es contenido.
            $this->assertSame(1, substr_count($html, 'data-receipt-cut-line'), "{$label}: una línea de corte");
            $this->assertStringContainsString(
                'data-receipt-cut-line>Línea de corte<',
                $html,
                "{$label}: la línea de corte lleva su etiqueta",
            );
            $this->assertStringContainsString('Ejemplar del paciente', $html, "{$label}: zona paciente");
            $this->assertStringContainsString('Ejemplar para archivo del hospital', $html, "{$label}: zona archivo");

            $zonePatient = strpos($html, 'data-receipt-zone="1"');
            $cut = strpos($html, 'data-receipt-cut-line');
            $zoneArchive = strpos($html, 'data-receipt-zone="2"');
            $this->assertNotFalse($zonePatient, "{$label}: etiqueta paciente");
            $this->assertNotFalse($cut, "{$label}: corte");
            $this->assertNotFalse($zoneArchive, "{$label}: etiqueta archivo");
            $this->assertLessThan($cut, $zonePatient, "{$label}: paciente ANTES del corte");
            $this->assertGreaterThan($cut, $zoneArchive, "{$label}: archivo DESPUÉS del corte");

            // El mismo número en ambas zonas (mismo documento, dos destinos).
            $expectedNumber = $label === 'borrador' ? $draftNumber : $receipt->receipt_number_full;
            $this->assertGreaterThanOrEqual(
                2,
                substr_count($html, $expectedNumber),
                "{$label}: el número «{$expectedNumber}» aparece en las dos zonas",
            );
        }

        // PDFs de ambos caminos con la misma geometría.
        $issuedPdf = $service->pdfForReceipt($receipt);
        $draftPdf = Pdf::loadHTML($draftPlan->html())
            ->setPaper(PaperSize::fromProfile($profile))
            ->output();

        $this->assertSame([0.0, 0.0, 612.0, 792.0], $this->firstMediaBox($issuedPdf), 'emitido: 612x792');
        $this->assertSame([0.0, 0.0, 612.0, 792.0], $this->firstMediaBox($draftPdf), 'borrador: 612x792');
        $this->assertSame($this->bytePageCount($issuedPdf), $issuedPlan->pageCount(), 'emitido: bytes = plan');
        $this->assertSame($this->bytePageCount($draftPdf), $draftPlan->pageCount(), 'borrador: bytes = plan');

        $this->writePdf('preview-vs-emitido/borrador-preview.pdf', $draftPdf);
        $this->writePdf('preview-vs-emitido/emitido-equivalente.pdf', $issuedPdf);
        $this->writeJson('preview-vs-emitido/planes.json', [
            'borrador' => $draft,
            'emitido' => $issued,
            'borrador_archivo' => 'borrador-preview.pdf',
            'emitido_archivo' => 'emitido-equivalente.pdf',
            'pueden_diferir' => ['número', 'fecha', 'marca de prueba', 'metadatos del PDF'],
            'correspondencia_exigida' => 'semántica y de geometría (papel, ejemplares, destinos, páginas medidas, composición solicitada/usada, distribución)',
        ]);
    }

    // ------------------------------------------------------------------
    // Fixtures representativos
    // ------------------------------------------------------------------

    private function profile(string $code): ReceiptPrintProfile
    {
        return ReceiptPrintProfile::query()->where('code', $code)->firstOrFail();
    }

    /**
     * Casos de la matriz: regresiones existentes ampliadas con contenido real.
     *
     * @return array<string, array<string, mixed>>
     */
    private function matrixCases(): array
    {
        $payer = 'María José López de la Cruz y Rodríguez de Mejía';

        // Descripciones de catálogo razonablemente largas: envuelven en la
        // columna de descripción (42 % del ancho útil).
        $long = [
            'Laboratorio clínico - hemograma completo con perfil lipídico y glucosa en ayunas',
            'Consulta externa de especialidad - control de nefropatía diabética estadio 3 con evaluación clínica',
            'Procedimiento de enfermería - curación de herida quirúrgica con vendaje y material de un solo uso',
            'Estudio de imagen - ultrasonido abdominal completo con informe del especialista asignado',
            'Terapia de reemplazo renal - sesión de hemodiálisis de cuatro horas con monitoría continua',
            'Suministro de medicamento inyectable - vía intravenosa en área de hospitalización',
            'Valoración médica de urgencias - atención inicial con evaluación de signos vitales y protocolo',
            'Material de curación estéril - apósitos y soluciones para vendaje compresivo de miembro inferior',
            'Consulta de nutrición clínica - plan alimentario para paciente diabético con seguimiento mensual',
            'Traslado interno de paciente - silla de ruedas desde admisión hasta área de consulta externa',
        ];

        $epo = $this->lineItem('Eritropoyetina', unitPriceCents: 0, free: true) + [
            'unit_price_registered' => '25.00',
            'unit_price_registered_cents' => 2500,
            'rule_adjustment' => '25.00',
            'rule_adjustment_cents' => 2500,
            'rule_adjustment_persisted' => true,
        ];

        // Total exacto L. 12,345.67 para el importe en letras largo.
        $letterPrices = [250000, 187525, 99010, 145000, 220567, 80000, 110000, 50000, 42500, 48965];
        $letterItems = [];
        foreach ($letterPrices as $index => $price) {
            $letterItems[] = $this->lineItem($long[$index], unitPriceCents: $price);
        }
        $letterItems[] = $epo;

        $media5Prices = [250000, 187525, 99010, 145000];
        $media5Items = [];
        foreach ($media5Prices as $index => $price) {
            $media5Items[] = $this->lineItem($long[$index], unitPriceCents: $price);
        }
        $media5Items[] = $epo;

        $partialItems = [
            $this->lineItem($long[0], unitPriceCents: 800000),
            $this->lineItem($long[1], unitPriceCents: 300000),
            $this->lineItem($long[2], unitPriceCents: 134567),
        ];

        $common = ['payer_name' => $payer];

        return [
            'c4-media-carta-1-concepto-fiscal' => $common + [
                'profile' => ReceiptPrintProfile::CODE_HALF_LETTER,
                'box' => [0.0, 0.0, 612.0, 396.0],
                'items' => [$this->lineItem($long[0], unitPriceCents: 250000)],
                'epo' => false,
                'parcial' => false,
            ],
            'c4-media-carta-2-conceptos-fiscal' => $common + [
                'profile' => ReceiptPrintProfile::CODE_HALF_LETTER,
                'box' => [0.0, 0.0, 612.0, 396.0],
                'items' => [
                    $this->lineItem($long[0], unitPriceCents: 250000),
                    $this->lineItem($long[1], unitPriceCents: 187525),
                ],
                'epo' => false,
                'parcial' => false,
            ],
            'c4-media-carta-5-conceptos-epo-fiscal' => $common + [
                'profile' => ReceiptPrintProfile::CODE_HALF_LETTER,
                'box' => [0.0, 0.0, 612.0, 396.0],
                'items' => $media5Items,
                'amount_cents' => 681535,
                'epo' => true,
                'parcial' => false,
            ],
            'c4-media-carta-3-conceptos-parcial' => $common + [
                'profile' => ReceiptPrintProfile::CODE_HALF_LETTER,
                'box' => [0.0, 0.0, 612.0, 396.0],
                'items' => $partialItems,
                'amount_cents' => 1234567,
                'paid_cents' => 500000,
                'epo' => false,
                'parcial' => true,
            ],
            'c4-media-carta-2-conceptos-reimpresion' => $common + [
                'profile' => ReceiptPrintProfile::CODE_HALF_LETTER,
                'box' => [0.0, 0.0, 612.0, 396.0],
                'items' => [
                    $this->lineItem($long[2], unitPriceCents: 99010),
                    $this->lineItem($long[3], unitPriceCents: 145000),
                ],
                'reprint_count' => 1,
                'epo' => false,
                'parcial' => false,
            ],
            'c4-carta-11-conceptos-epo-fiscal' => $common + [
                'profile' => ReceiptPrintProfile::CODE_LETTER_PORTRAIT,
                'box' => [0.0, 0.0, 612.0, 792.0],
                'items' => $letterItems,
                'amount_cents' => 1234567,
                'epo' => true,
                'parcial' => false,
            ],
        ];
    }

    /** @return list<string> */
    private function institutionalNeedles(): array
    {
        return [
            'Gobierno de Honduras',
            'Secretaría de Salud',
            'Hospital General San Isidro',
            'Tocoa, Colón',
            'RTN 08011999123456',
            'Tel. 2444-0000',
            'Documento de recaudación institucional.',
            'Recibo institucional',
            'Recibo No.',
            'Detalle de servicios',
            'Situación del pago',
            'Monto en letras',
            'Firma del enterante',
            'Sello y firma autorizada',
            'ORIGINAL',
        ];
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
     * Fixture C4: snapshot representativo con bloque fiscal y opcionalmente un
     * pago parcial (total > pagado > 0) o un contador de reimpresión.
     *
     * @param  list<array<string, mixed>>  $items
     */
    private function receiptFixture(
        array $items,
        ReceiptPrintProfile $profile,
        string $copyMode = 'original_only',
        ?string $payerName = null,
        ?int $amountCents = null,
        ?int $paidCents = null,
        int $reprintCount = 0,
    ): InstitutionalReceipt {
        $user = User::factory()->create(['name' => 'Cajera C4 Papel']);
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
            'series' => 'REC-C4PAPEL',
            'prefix' => 'RC',
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'max_number' => 999999,
            'current_number' => 0,
            'range_authorization' => 'AUT-REC-C4',
            'legal_text' => 'Suscribe. CERTIFICA haber enterado en esta oficina la suma de',
            'active' => false,
        ]);

        $itemsTotal = array_sum(array_map(
            static fn (array $item): int => (int) $item['line_total_cents'],
            $items,
        ));
        $totalCents = $amountCents ?? $itemsTotal;
        $paidCents ??= $totalCents;
        $balanceCents = $totalCents - $paidCents;
        $total = number_format($totalCents / 100, 2, '.', '');
        $paid = number_format($paidCents / 100, 2, '.', '');
        $balance = number_format($balanceCents / 100, 2, '.', '');
        $receiptNumber = random_int(1, 99999999);
        $receiptNumberFull = 'REC-C4PAPEL'.str_pad((string) $receiptNumber, 8, '0', STR_PAD_LEFT);

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
            'issued_at' => Carbon::parse('2026-09-21 09:30:00'),
            'issued_by' => $user->id,
            'payer_name' => $payerName ?? 'María José López de la Cruz y Rodríguez de Mejía',
            'concept' => 'Servicios hospitalarios de prueba sintética',
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
                'range_authorization' => 'AUT-REC-C4',
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
                'invoice_number' => 'INV-C4PAPEL-00000001',
                'fiscal_cai' => null,
                'fiscal_range_from' => null,
                'fiscal_range_to' => null,
                'fiscal_valid_until' => null,
                'patient_name' => 'María José López de la Cruz',
                'issued_at' => '2026-09-21T09:30:00-06:00',
                'tax_label' => 'ISV',
                'tax_rate_snapshot' => '15.00',
                'subtotal_cents' => $totalCents,
                'exempt_amount_cents' => $totalCents,
                'tax_amount_cents' => 0,
                'discount_amount_cents' => 0,
                'total_cents' => $totalCents,
                'paid_amount_cents' => $paidCents,
                'balance_due_cents' => $balanceCents,
            ],
            'payment_snapshot' => [
                'selected_payment' => [
                    'method' => 'cash',
                    'amount' => $paid,
                    'amount_cents' => $paidCents,
                    'reference' => null,
                    'paid_at' => '2026-09-21T09:30:00-06:00',
                    'cashier_name' => 'Cajera C4 Papel',
                ],
                'posted_payments' => [],
                'cash_context' => [
                    'cash_register_label' => 'Caja principal',
                    'cashier_name' => 'Cajera C4 Papel',
                    'opened_at' => '2026-09-21T09:00:00-06:00',
                ],
                'issued_by' => ['name' => 'Cajera C4 Papel'],
            ],
            'items_snapshot' => $items,
            'reprint_count' => $reprintCount,
        ]);
    }

    /** Añade el bloque fiscal que el comprobante real siempre trae. */
    private function withFiscalBlock(InstitutionalReceipt $receipt): InstitutionalReceipt
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

    // ------------------------------------------------------------------
    // Medición (mismas funciones que la sonda de C3, reproducidas)
    // ------------------------------------------------------------------

    /**
     * Réplica EXACTA de `ZzC3FiscalProbeTest::minHeightForOnePage`
     * (`hospital-ai/evidencia/C3-P1/SONDA_BLOQUE_FISCAL.php.txt:85-104`).
     */
    private function minHeightForOnePage(string $html): float
    {
        $low = 60.0;
        $high = 396.0;

        for ($i = 0; $i < 8 && $this->pagesAtHeight($html, $high) > 1; $i++) {
            $high *= 2;
        }

        while ($high - $low > 1.0) {
            $mid = ($low + $high) / 2;
            if ($this->pagesAtHeight($html, $mid) === 1) {
                $high = $mid;
            } else {
                $low = $mid;
            }
        }

        return round($high, 1);
    }

    /** Réplica de `ZzC3FiscalProbeTest::pagesAtHeight` (instancia nueva por medición). */
    private function pagesAtHeight(string $html, float $heightPt): int
    {
        $wrapper = Pdf::loadHTML($html);
        $wrapper->setPaper([0.0, 0.0, 612.0, $heightPt]);
        $dompdf = $wrapper->getDomPDF();
        $dompdf->render();

        return $dompdf->getCanvas()->get_page_count();
    }

    private function bytePageCount(string $pdf): int
    {
        return preg_match_all('/\/Type\s*\/Page\b/', $pdf);
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

    private function declaredBodyFontSizePt(string $html): float
    {
        preg_match('/body\s*\{[^}]*font-size:\s*([\d.]+)px/s', $html, $matches);

        $this->assertNotEmpty($matches[1] ?? null, 'El documento declara tamaño base de detalle.');

        return (float) $matches[1] * 0.75;
    }

    /**
     * Márgenes REALES que la `@page` declara en el HTML generado (pt la prueba
     * de geometría los convierte): la hoja de dos zonas recorta el vertical a
     * 6 mm por diseño (`compact-styles.blade.php`).
     *
     * @return array{top: float, right: float, bottom: float, left: float}|null
     */
    private function pageMarginsMm(string $html): ?array
    {
        $matched = preg_match(
            '/@page\s*\{\s*margin:\s*([0-9.]+)mm\s+([0-9.]+)mm\s+([0-9.]+)mm\s+([0-9.]+)mm\s*;/',
            $html,
            $matches,
        );

        if ($matched !== 1) {
            return null;
        }

        return [
            'top' => (float) $matches[1],
            'right' => (float) $matches[2],
            'bottom' => (float) $matches[3],
            'left' => (float) $matches[4],
        ];
    }

    // ------------------------------------------------------------------
    // Salida de evidencia (solo con RECEIPT_C4_EVIDENCE_DIR; la suite normal
    // no depende de estas variables)
    // ------------------------------------------------------------------

    private function writePdf(string $relativeName, string $pdf): void
    {
        $directory = $this->evidencePath(dirname($relativeName));

        if ($directory === null) {
            self::$writeLog[] = ['target' => dirname($relativeName), 'motivo' => 'evidenceRoot nulo'];
            return;
        }

        $relative = str_replace('/', DIRECTORY_SEPARATOR, $relativeName);
        // La matriz pasa el nombre sin extensión; el artefacto SIEMPRE es .pdf.
        if (! str_ends_with(strtolower($relative), '.pdf')) {
            $relative .= '.pdf';
        }
        $target = $this->evidenceRoot().DIRECTORY_SEPARATOR.$relative;

        if (! is_dir(dirname($target))) {
            mkdir(dirname($target), 0777, true);
        }

        $written = @file_put_contents($target, $pdf);
        clearstatcache(true, $target);
        self::$writeLog[] = [
            'target' => $target,
            'bytes_esperados' => strlen($pdf),
            'bytes_escritos' => is_int($written) ? $written : false,
            'existe_tras_escribir' => file_exists($target),
        ];
    }

    private function writeJson(string $relativeName, array $data): void
    {
        if ($this->evidenceRoot() === null) {
            return;
        }

        $relative = str_replace('/', DIRECTORY_SEPARATOR, $relativeName);
        $target = $this->evidenceRoot().DIRECTORY_SEPARATOR.$relative;

        if (! is_dir(dirname($target))) {
            mkdir(dirname($target), 0777, true);
        }

        file_put_contents(
            $target,
            json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
        );
    }

    private function recordManifest(string $name, array $entry): void
    {
        self::$manifest[$name] = $entry;

        if ($this->evidenceRoot() === null) {
            return;
        }

        $target = $this->evidenceRoot().DIRECTORY_SEPARATOR.'manifiesto_matriz.json';
        file_put_contents(
            $target,
            json_encode(self::$manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
        );
    }

    private function evidenceRoot(): ?string
    {
        $root = trim((string) getenv('RECEIPT_C4_EVIDENCE_DIR'));

        return $root === '' ? null : rtrim($root, DIRECTORY_SEPARATOR);
    }

    private function evidencePath(string $relativeDir): ?string
    {
        $root = $this->evidenceRoot();

        if ($root === null) {
            return null;
        }

        return $root.DIRECTORY_SEPARATOR.str_replace('/', DIRECTORY_SEPARATOR, $relativeDir);
    }
}
