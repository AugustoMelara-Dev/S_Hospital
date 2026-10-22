<?php

namespace App\Actions\Reports;

use App\Support\HospitalName;
use App\Support\Money;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;

/**
 * Builds the executive report PDF. Designed to look like a formal
 * accounting document for Hospital San Isidro. All amounts are
 * shown in L. 1,234.50 (lempiras with period) format, the only
 * place where that variant is allowed.
 *
 * @phpstan-type ExecutiveReport array<string, mixed>
 * @phpstan-type ReportSection array<string, mixed>
 * @phpstan-type ReportRows list<array<string, mixed>>
 */
class ExecutivePdfExportService
{
    /**
     * @param  ExecutiveReport  $report
     * @param  array<string, mixed>  $fiscal
     */
    public function buildHtml(array $report, array $fiscal, ?string $generatedBy = null, ?Carbon $generatedAt = null): string
    {
        $now = $generatedAt ?? Carbon::now('America/Tegucigalpa');
        $hospitalName = HospitalName::display($this->nullableString($fiscal['hospital_name'] ?? null));
        $rtn = $this->stringValue($fiscal['rtn'] ?? null, 'N/A');
        $address = $this->stringValue($fiscal['address'] ?? null);
        $governmentLine = $this->stringValue($fiscal['receipt_government_line'] ?? null, 'Gobierno de Honduras');
        $secretariatLine = $this->stringValue($fiscal['receipt_secretariat_line'] ?? null, 'Secretaria de Salud');

        $period = $this->section($report['period'] ?? null);
        $summary = $this->section($report['summary'] ?? null);
        $paymentMethods = $this->rows($report['payment_methods'] ?? null);
        $dailyTrend = $this->rows($report['daily_trend'] ?? null);
        $services = $this->section($report['services'] ?? null);
        $cashiers = $this->rows($report['cashiers'] ?? null);
        $cashSessions = $this->rows($report['cash_sessions'] ?? null);
        $pendingAging = $this->section($report['pending_aging'] ?? null);
        $canViewAudit = ($report['can_view_audit'] ?? true) === true;
        $voids = $this->rows($report['voids_and_reversals'] ?? null);
        $audit = $this->section($report['audit_summary'] ?? null);
        $comparison = $this->section($report['comparison'] ?? null);
        $accountingPolicy = $this->section($report['accounting_policy'] ?? null);
        $filters = $this->section($report['filters'] ?? null);
        $operations = $this->rows($report['operations'] ?? null);
        $detail = $this->rows($report['detail'] ?? null);
        $collections = $this->rows($report['collections'] ?? null);
        $gratuities = $this->rows($report['gratuities'] ?? null);

        $css = $this->buildCss();
        $html = $this->wrapHtml(
            $css,
            $this->renderHeader($hospitalName, $rtn, $address, $governmentLine, $secretariatLine, $period, $now, $generatedBy, $filters)
            .$this->renderExecutiveSummary($summary, $comparison)
            .$this->renderOperations($operations)
            .$this->renderDetail($detail)
            .$this->renderCollections($collections)
            .$this->renderGratuities($gratuities)
            .$this->renderFinancialReading($summary, $paymentMethods, $accountingPolicy)
            .$this->renderPaymentMethods($paymentMethods)
            .$this->renderDailyTrend($dailyTrend)
            .$this->renderServices($services)
            .$this->renderCashiers($cashiers)
            .$this->renderCashSessions($cashSessions)
            .$this->renderPendingAging($pendingAging)
            .($canViewAudit ? $this->renderVoidsAndReversals($voids) : '')
            .($canViewAudit ? $this->renderAudit($audit) : '')
            .$this->renderFooter($now),
            $hospitalName
        );

        return $html;
    }

    /**
     * @param  ExecutiveReport  $report
     * @param  array<string, mixed>  $fiscal
     */
    public function generate(array $report, array $fiscal, ?string $generatedBy = null, ?Carbon $generatedAt = null): string
    {
        $html = $this->buildHtml($report, $fiscal, $generatedBy, $generatedAt);

        $pdf = Pdf::loadHTML($html);
        // Carta vertical: el reporte institucional se archiva en carta. Se fija
        // en el motor ademas del @page CSS para que el tamano no dependa de que
        // el visor interprete la regla.
        $pdf->setPaper('letter', 'portrait');
        $dompdf = $pdf->getDomPDF();
        $dompdf->render();

        // Numeracion de paginas explicita: no depende de la UI ni de una sola hoja.
        $canvas = $dompdf->getCanvas();
        $font = $dompdf->getFontMetrics()->getFont('Helvetica', 'normal') ?? 'Helvetica';
        $canvas->page_text(
            $canvas->get_width() - 150,
            $canvas->get_height() - 26,
            'Pagina {PAGE_NUM} de {PAGE_COUNT}',
            $font,
            8.5,
            [0.39, 0.45, 0.55],
        );

        return $dompdf->output();
    }

    public function e(?string $value): string
    {
        if ($value === null) {
            return '';
        }

        return htmlspecialchars($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    private function money(mixed $value): string
    {
        return $this->formatMoneyCents(Money::parseCents($this->moneyValue($value), 'amount'));
    }

    /**
     * Un ajuste historico backfilleado no se muestra como "L. 0.00" por reflejo:
     * cero significaria "el ajuste medido fue cero", que no es lo mismo que
     * "nunca se registro". Los consumidores marcan ese caso con la bandera de
     * procedencia (`rule_adjustment_persisted` / `adjustment_persisted`).
     *
     * @param  array<string, mixed>  $row
     */
    private function adjustmentLabel(array $row, string $valueKey = 'rule_adjustment', string $persistedKey = 'rule_adjustment_persisted'): string
    {
        if (array_key_exists($persistedKey, $row) && $row[$persistedKey] === false) {
            return 'No registrado';
        }

        return $this->money($row[$valueKey] ?? '0.00');
    }

    private function moneySigned(mixed $value): string
    {
        $raw = trim($this->moneyValue($value));
        $negative = str_starts_with($raw, '-');
        $magnitude = ltrim($raw, '+-');

        if (preg_match('/^\d+(\.\d{1,2})?$/', $magnitude) !== 1) {
            $magnitude = '0';
            $negative = false;
        }

        $cents = Money::parseCents($magnitude, 'amount');

        return $this->formatMoneyCents($negative ? -$cents : $cents);
    }

    /**
     * Formato de lectura del PDF. Se mantiene local al documento para no cambiar
     * contratos JSON/Excel que usan decimales sin separadores.
     */
    private function formatMoneyCents(int $cents): string
    {
        $absolute = abs($cents);
        $whole = number_format(intdiv($absolute, 100), 0, '.', ',');
        $decimal = str_pad((string) ($absolute % 100), 2, '0', STR_PAD_LEFT);

        return ($cents < 0 ? '- L. ' : 'L. ').$whole.'.'.$decimal;
    }

    private function pct(mixed $value): string
    {
        $percentage = $this->nullableFloat($value);
        if ($percentage === null) {
            return 'n/d';
        }

        $sign = $percentage > 0 ? '+' : '';

        return $sign.number_format($percentage, 2).'%';
    }

    private function percentageFloat(mixed $value): float
    {
        return $this->nullableFloat($value) ?? 0.0;
    }

    private function count(mixed $value): string
    {
        return number_format($this->countValue($value));
    }

    private function sectionTitle(string $title, string $subtitle = ''): string
    {
        $sub = $subtitle !== ''
            ? '<p class="section-sub">'.$this->e($subtitle).'</p>'
            : '';

        return '<div class="section-heading"><h2 class="section-title">'.$this->e($title).'</h2>'.$sub.'</div>';
    }

    /**
     * Mantiene juntos un titulo y su tabla corta para que el encabezado no
     * quede huerfano al final de una pagina. Si el bloque excede una pagina,
     * DomPDF lo vuelve a partir sin perder filas.
     */
    private function keepTogether(string $html): string
    {
        return '<div class="keep-together">'.$html.'</div>';
    }

    /**
     * @param  ReportSection  $period
     * @param  array<string, mixed>  $filters
     */
    private function renderHeader(
        string $hospitalName,
        string $rtn,
        string $address,
        string $governmentLine,
        string $secretariatLine,
        array $period,
        Carbon $now,
        ?string $generatedBy,
        array $filters = [],
    ): string {
        $from = $this->stringValue($period['from'] ?? null);
        $to = $this->stringValue($period['to'] ?? null);
        $filterLine = $this->filtersLabel($filters);

        return <<<HTML
<div class="page-header">
    <div class="page-header-left">
        <p class="gov">{$this->e($governmentLine)}</p>
        <p class="sec">{$this->e($secretariatLine)}</p>
        <h1 class="hospital">{$this->e($hospitalName)}</h1>
        <p class="meta">RTN: {$this->e($rtn)}</p>
        <p class="meta">{$this->e($address)}</p>
    </div>
    <div class="page-header-right">
        <p class="doc-type">Reporte Ejecutivo</p>
        <p class="period">Periodo: {$this->e($from)} a {$this->e($to)}</p>
        <p class="period">Filtros: {$this->e($filterLine)}</p>
        <p class="period">Generado: {$this->e($now->format('Y-m-d H:i'))}</p>
        <p class="period">Zona horaria: America/Tegucigalpa</p>
        <p class="period">Por: {$this->e($generatedBy ?? 'Sistema')}</p>
    </div>
    <div class="clear"></div>
</div>
HTML;
    }

    /** @param ReportSection $filters */
    private function filtersLabel(array $filters): string
    {
        $parts = [];
        foreach ([
            'cash_session_id' => 'sesion',
            'user_id' => 'cajero',
            'category_id' => 'categoria',
            'area_id' => 'area',
            'method' => 'metodo',
            'status' => 'estado',
        ] as $key => $label) {
            $value = $this->nullableString($filters[$key] ?? null);
            if ($value !== null && $value !== '') {
                $parts[] = $label.': '.$value;
            }
        }

        return $parts === [] ? 'Sin filtros adicionales' : implode(', ', $parts);
    }

    /**
     * @param  ReportSection  $summary
     * @param  ReportSection  $comparison
     */
    private function renderExecutiveSummary(array $summary, array $comparison): string
    {
        $billed = $this->money($summary['billed_total'] ?? '0.00');
        $collected = $this->money($summary['collected_total'] ?? '0.00');
        $pending = $this->money($summary['pending_total'] ?? '0.00');
        $voided = $this->money($summary['voided_total'] ?? '0.00');
        $average = $this->money($summary['average_ticket'] ?? '0.00');

        $billedComparison = $this->section($comparison['billed'] ?? null);
        $collectedComparison = $this->section($comparison['collected'] ?? null);
        $billedDelta = $this->pct($billedComparison['delta_percentage'] ?? null);
        $collectedDelta = $this->pct($collectedComparison['delta_percentage'] ?? null);
        $previousPeriod = $this->section($comparison['previous_period'] ?? null);
        $prevLabel = $this->stringValue($previousPeriod['from'] ?? null).' - '.$this->stringValue($previousPeriod['to'] ?? null);

        return $this->sectionTitle(
            'Resumen Ejecutivo',
            'Lectura contable para el periodo seleccionado. '.
            'Comparado contra '.$prevLabel.'.'
        )
        .'<div class="kpi-grid">'
        .$this->kpiCard('Total Facturado', $billed, $billedDelta, 'Excluye facturas anuladas.')
        .$this->kpiCard('Total Cobrado', $collected, $collectedDelta, 'Pagos registrados y no anulados.')
        .$this->kpiCard('Saldo Pendiente', $pending, null, 'Facturas emitidas o parciales.')
        .$this->kpiCard('Anulado', $voided, null, 'Facturas anuladas. Fuera del ingreso neto.')
        .$this->kpiCard('Facturas', $this->count($summary['invoice_count'] ?? 0), null, 'Documentos emitidos.')
        .$this->kpiCard('Pagos contabilizados', $this->count($summary['receipt_count'] ?? 0), null, 'Transacciones de pago posteadas; una factura puede tener varios pagos.')
        .$this->kpiCard('Pagadas', $this->count($summary['paid_count'] ?? 0), null, 'Facturas liquidadas.')
        .$this->kpiCard('Parciales', $this->count($summary['partial_count'] ?? 0), null, 'Con saldo pendiente.')
        .$this->kpiCard('Ticket Promedio', $average, null, 'Total facturado / facturas.')
        .'</div>';
    }

    private function kpiCard(string $label, string $value, ?string $delta, string $helper): string
    {
        $deltaHtml = $delta !== null
            ? '<p class="kpi-delta">'.$this->e($delta).' vs periodo anterior</p>'
            : '';

        return '<div class="kpi-card">'
            .'<p class="kpi-label">'.$this->e($label).'</p>'
            .'<p class="kpi-value">'.$this->e($value).'</p>'
            .$deltaHtml
            .'<p class="kpi-helper">'.$this->e($helper).'</p>'
            .'</div>';
    }

    /** @param ReportRows $operations */
    private function renderOperations(array $operations): string
    {
        if ($operations === []) {
            return $this->keepTogether(
                $this->sectionTitle('Operaciones', 'Facturas emitidas en el periodo seleccionado.')
                .'<p class="empty">No hay operaciones emitidas en el periodo.</p>'
            );
        }

        $rows = [['Fecha', 'N Factura', 'Paciente', 'Caja/Sesion', 'Cajero', 'Total', 'Pagado', 'Saldo', 'Estado', 'Documento']];
        $totalCents = 0;
        $paidCents = 0;
        $balanceCents = 0;
        foreach ($operations as $operation) {
            $totalCents += $this->moneyCents($operation['total'] ?? '0.00');
            $paidCents += $this->moneyCents($operation['paid'] ?? '0.00');
            $balanceCents += $this->moneyCents($operation['balance'] ?? '0.00');
            $rows[] = [
                $this->localDateLabel($operation['date'] ?? null),
                $this->stringValue($operation['invoice_number'] ?? null),
                $this->stringValue($operation['patient'] ?? null),
                $this->stringValue($operation['cash_session_label'] ?? null),
                $this->stringValue($operation['cashier'] ?? null),
                $this->money($operation['total'] ?? '0.00'),
                $this->money($operation['paid'] ?? '0.00'),
                $this->money($operation['balance'] ?? '0.00'),
                $this->stringValue($operation['status_label'] ?? null),
                $this->stringValue($operation['receipt_document'] ?? null),
            ];
        }

        $rows[] = [
            'Total', '', '', '', '',
            $this->formatMoneyCents($totalCents),
            $this->formatMoneyCents($paidCents),
            $this->formatMoneyCents($balanceCents),
            '', '',
        ];

        return $this->sectionTitle(
            'Operaciones',
            'Fecha de emision, paciente, caja/sesion, cajero, total, pagado, saldo, estado y documento relacionado.'
        ).$this->renderTable($rows, ['left', 'left', 'left', 'left', 'left', 'right', 'right', 'right', 'left', 'left']);
    }

    /** @param ReportRows $detail */
    private function renderDetail(array $detail): string
    {
        if ($detail === []) {
            return $this->keepTogether(
                $this->sectionTitle('Detalle', 'Lineas de las operaciones del periodo.')
                .'<p class="empty">No hay lineas de detalle en el periodo.</p>'
            );
        }

        $rows = [['N Factura', 'Paciente', 'Servicio', 'Categoria', 'Cantidad', 'Precio registrado', 'Ajuste por regla', 'Impuesto', 'Importe final', 'Gratuidad']];
        foreach ($detail as $line) {
            $rows[] = [
                $this->stringValue($line['invoice_number'] ?? null),
                $this->stringValue($line['patient'] ?? null),
                $this->stringValue($line['service'] ?? null),
                $this->stringValue($line['category'] ?? null),
                $this->moneyValue($line['quantity'] ?? null),
                $this->money($line['unit_price'] ?? '0.00'),
                $this->adjustmentLabel($line),
                $this->money($line['tax'] ?? '0.00'),
                $this->money($line['line_total'] ?? '0.00'),
                ($line['is_free'] ?? false) === true ? $this->stringValue($line['rule_label'] ?? null, 'Gratuidad') : 'No',
            ];
        }

        return $this->sectionTitle(
            'Detalle',
            'Producto/servicio, cantidad, precio registrado, ajuste por regla, impuestos e importe final. La gratuidad se identifica por linea.'
        ).$this->renderTable($rows, ['left', 'left', 'left', 'left', 'right', 'right', 'right', 'right', 'right', 'left']);
    }

    /** @param ReportRows $collections */
    private function renderCollections(array $collections): string
    {
        if ($collections === []) {
            return $this->keepTogether(
                $this->sectionTitle('Cobros', 'Pagos reales por fecha de pago.')
                .'<p class="empty">No hay cobros en el periodo.</p>'
            );
        }

        $rows = [['Fecha de pago', 'N Factura', 'Paciente', 'Caja/Sesion', 'Cajero', 'Metodo', 'Referencia', 'Importe', 'Estado']];
        $totalCents = 0;
        foreach ($collections as $collection) {
            $totalCents += $this->moneyCents($collection['amount'] ?? '0.00');
            $rows[] = [
                $this->localDateTimeLabel($collection['paid_at'] ?? null),
                $this->stringValue($collection['invoice_number'] ?? null),
                $this->stringValue($collection['patient'] ?? null),
                $this->stringValue($collection['cash_session_label'] ?? null),
                $this->stringValue($collection['cashier'] ?? null),
                $this->stringValue($collection['method_label'] ?? null),
                $this->stringValue($collection['reference'] ?? null),
                $this->money($collection['amount'] ?? '0.00'),
                $this->stringValue($collection['status_label'] ?? null),
            ];
        }

        $rows[] = ['Total', '', '', '', '', '', '', $this->formatMoneyCents($totalCents), ''];

        return $this->sectionTitle(
            'Cobros',
            'Fecha real de pago (separada de la emision), paciente, caja/sesion, cajero, metodo, referencia, importe y estado.'
        ).$this->renderTable($rows, ['left', 'left', 'left', 'left', 'left', 'left', 'left', 'right', 'left']);
    }

    /** @param ReportRows $gratuities */
    private function renderGratuities(array $gratuities): string
    {
        if ($gratuities === []) {
            return $this->keepTogether(
                $this->sectionTitle('Gratuidades', 'Unidades entregadas sin cobro por regla.')
                .'<p class="empty">No hay lineas gratuitas en el periodo.</p>'
            );
        }

        $header = ['N Factura', 'Paciente', 'Servicio', 'Categoria', 'Cantidad entregada', 'Valor del ajuste', 'Motivo'];
        $rows = [];
        foreach ($gratuities as $gratuity) {
            $rows[] = [
                $this->stringValue($gratuity['invoice_number'] ?? null),
                $this->stringValue($gratuity['patient'] ?? null),
                $this->stringValue($gratuity['service'] ?? null),
                $this->stringValue($gratuity['category'] ?? null),
                $this->moneyValue($gratuity['quantity'] ?? null),
                $this->adjustmentLabel($gratuity, 'adjustment_value', 'adjustment_persisted'),
                $this->stringValue($gratuity['reason'] ?? null),
            ];
        }

        $heading = $this->sectionTitle(
            'Gratuidades',
            'Cantidad entregada gratuitamente no equivale a cantidad cobrada. El valor del ajuste se informa cuando quedo registrado en la operacion; un historico sin dato dice "No registrado", nunca cero.'
        );
        $alignments = ['left', 'left', 'left', 'left', 'right', 'right', 'left'];
        $html = '';

        // Cada bloque cabe holgadamente en carta. El primero viaja con el
        // titulo, y cada continuacion vuelve a incluir el encabezado de columnas.
        foreach (array_chunk($rows, 8) as $index => $chunk) {
            $table = $this->renderTableBlock($header, $chunk, $alignments);
            $html .= $this->keepTogether(($index === 0 ? $heading : '').$table);
        }

        return $html;
    }

    /**
     * @param  ReportSection  $summary
     * @param  ReportRows  $paymentMethods
     * @param  ReportSection  $accountingPolicy
     */
    private function renderFinancialReading(array $summary, array $paymentMethods, array $accountingPolicy): string
    {
        $billed = $this->money($summary['billed_total'] ?? '0.00');
        $collected = $this->money($summary['collected_total'] ?? '0.00');
        $pending = $this->money($summary['pending_total'] ?? '0.00');
        $voided = $this->money($summary['voided_total'] ?? '0.00');
        $reversed = $this->money($summary['reversed_total'] ?? '0.00');

        $cash = '0.00';
        foreach ($paymentMethods as $method) {
            if (($method['method'] ?? null) === 'cash') {
                $cash = $this->money($method['amount'] ?? '0.00');
            }
        }

        $rows = [
            ['Concepto', 'Monto', 'Fuente / definicion'],
            ['Facturado', $billed, $this->stringValue($accountingPolicy['billed_definition'] ?? null, 'Facturas emitidas no anuladas; anulaciones ya excluidas.')],
            ['Cobrado', $collected, $this->stringValue($accountingPolicy['collected_definition'] ?? null, 'Pagos posteados no reversados; reversos ya excluidos.')],
            ['Efectivo recaudado', $cash, 'Pagos con metodo efectivo. Afecta efectivo esperado de caja.'],
            ['Pendiente', $pending, 'Saldo abierto de facturas emitidas o parciales.'],
            ['Anulado', $voided, 'Dato de control. Ya esta excluido del total facturado y no se resta otra vez.'],
            ['Reversado', $reversed, 'Dato de control. Ya esta excluido del total cobrado y no se resta otra vez.'],
        ];

        return $this->keepTogether($this->sectionTitle(
            'Lectura Financiera',
            'Definiciones contables no negociables. Cada monto cita su fuente y definicion.'
        ).$this->renderTable($rows, ['left', 'right', 'left']));
    }

    /** @param ReportRows $paymentMethods */
    private function renderPaymentMethods(array $paymentMethods): string
    {
        $rows = [['Metodo', 'Monto', 'Pagos', '% del total']];
        $totalCents = 0;
        $totalCount = 0;

        foreach ($paymentMethods as $method) {
            $totalCents += $this->moneyCents($method['amount'] ?? '0.00');
            $totalCount += $this->countValue($method['count'] ?? 0);
            $rows[] = [
                $this->stringValue($method['label'] ?? null, $this->stringValue($method['method'] ?? null)),
                $this->money($method['amount'] ?? '0.00'),
                $this->count($method['count'] ?? 0),
                number_format($this->percentageFloat($method['percentage'] ?? '0'), 2).'%',
            ];
        }

        if ($paymentMethods !== []) {
            $rows[] = [
                'Total',
                $this->formatMoneyCents($totalCents),
                number_format($totalCount),
                $totalCents > 0 ? '100.00%' : '0.00%',
            ];
        }

        return $this->keepTogether($this->sectionTitle(
            'Recaudacion por Metodo de Pago',
            'Efectivo entra al efectivo esperado de caja. Los demas metodos se concilian por separado. El total debe cuadrar con el Total Cobrado.'
        ).$this->renderTable($rows, ['left', 'right', 'right', 'right']));
    }

    /** @param ReportRows $dailyTrend */
    private function renderDailyTrend(array $dailyTrend): string
    {
        if ($dailyTrend === []) {
            return $this->keepTogether(
                $this->sectionTitle('Tendencia Diaria', 'Sin datos en el periodo seleccionado.')
                .'<p class="empty">No hay datos para mostrar.</p>'
            );
        }

        // Separa dias con movimiento de dias en cero. Ningun dia del periodo se
        // omite: los ceros se listan en un detalle explicito y compacto.
        $active = [];
        $inactiveDates = [];
        foreach ($dailyTrend as $row) {
            $hasActivity = $this->moneyCents($row['billed'] ?? '0.00') !== 0
                || $this->moneyCents($row['collected'] ?? '0.00') !== 0
                || $this->moneyCents($row['pending'] ?? '0.00') !== 0
                || $this->countValue($row['voided_count'] ?? 0) !== 0
                || $this->countValue($row['invoice_count'] ?? 0) !== 0;

            if ($hasActivity) {
                $active[] = $row;
            } else {
                $inactiveDates[] = $this->localDateLabel($row['date'] ?? null);
            }
        }

        $html = $this->sectionTitle(
            'Tendencia Diaria',
            'Dias con movimiento y detalle explicito de dias sin actividad. No se omite ninguna fecha del periodo.'
        );

        if ($active === []) {
            $html .= '<p class="empty">No hay facturacion ni cobros en el periodo seleccionado.</p>';
        } else {
            $rows = [['Fecha', 'Facturado', 'Cobrado', 'Pendiente', 'Anuladas', 'Facturas']];
            $totalBilled = 0;
            $totalCollected = 0;
            $totalPending = 0;
            $totalVoided = 0;
            $totalInvoices = 0;

            foreach ($active as $row) {
                $billedCents = $this->moneyCents($row['billed'] ?? '0.00');
                $collectedCents = $this->moneyCents($row['collected'] ?? '0.00');
                $pendingCents = $this->moneyCents($row['pending'] ?? '0.00');
                $voidedCount = $this->countValue($row['voided_count'] ?? 0);
                $invoiceCount = $this->countValue($row['invoice_count'] ?? 0);

                $totalBilled += $billedCents;
                $totalCollected += $collectedCents;
                $totalPending += $pendingCents;
                $totalVoided += $voidedCount;
                $totalInvoices += $invoiceCount;

                $rows[] = [
                    $this->localDateLabel($row['date'] ?? null),
                    $this->money($row['billed'] ?? '0.00'),
                    $this->money($row['collected'] ?? '0.00'),
                    $this->money($row['pending'] ?? '0.00'),
                    $this->count($row['voided_count'] ?? 0),
                    $this->count($row['invoice_count'] ?? 0),
                ];
            }

            $rows[] = [
                'Total dias con actividad',
                $this->formatMoneyCents($totalBilled),
                $this->formatMoneyCents($totalCollected),
                $this->formatMoneyCents($totalPending),
                number_format($totalVoided),
                number_format($totalInvoices),
            ];

            $html .= $this->renderTable($rows, ['left', 'right', 'right', 'right', 'right', 'right']);
        }

        if ($inactiveDates !== []) {
            $html .= '<h3 class="subsection">Dias sin actividad ('.count($inactiveDates).')</h3>'
                .'<p class="empty">Fechas del periodo con cero facturacion, cobro, pendiente y anulaciones: '
                .$this->e(implode(', ', $inactiveDates)).'.</p>';
        }

        return $html;
    }

    /** @param ReportSection $services */
    private function renderServices(array $services): string
    {
        $byAmount = $this->rows($services['top_by_amount'] ?? null);
        $byQuantity = $this->rows($services['top_by_quantity'] ?? null);
        $byCategory = $this->rows($services['by_category'] ?? null);
        $byArea = $this->rows($services['by_area'] ?? null);

        $html = $this->sectionTitle(
            'Conceptos asociados a pagos',
            'Lineas con importe cobrable de operaciones que recibieron pagos reales en el periodo. Cantidad y valor corresponden a la linea emitida; cobrado distribuye esos pagos.'
        );

        if ($byAmount !== []) {
            $rows = [['Servicio', 'Categoria', 'Cantidad cobrable', 'Valor de lineas', 'Cobrado en periodo']];
            foreach ($byAmount as $row) {
                $rows[] = [
                    $this->stringValue($row['service'] ?? null),
                    $this->stringValue($row['category'] ?? null),
                    $this->moneyValue($row['quantity'] ?? null),
                    $this->money($row['total'] ?? '0.00'),
                    $this->money($row['collected'] ?? '0.00'),
                ];
            }
            $html .= $this->keepTogether('<h3 class="subsection">Top por valor de linea</h3>'.$this->renderTable($rows, ['left', 'left', 'right', 'right', 'right']));
        }

        if ($byQuantity !== []) {
            $rows = [['Servicio', 'Categoria', 'Cantidad cobrable', 'Valor de lineas']];
            foreach ($byQuantity as $row) {
                $rows[] = [
                    $this->stringValue($row['service'] ?? null),
                    $this->stringValue($row['category'] ?? null),
                    $this->moneyValue($row['quantity'] ?? null),
                    $this->money($row['total'] ?? '0.00'),
                ];
            }
            $html .= $this->keepTogether('<h3 class="subsection">Top por cantidad</h3>'.$this->renderTable($rows, ['left', 'left', 'right', 'right']));
        }

        if ($byCategory !== []) {
            $rows = [['Categoria', 'Cantidad cobrable', 'Valor de lineas', 'Cobrado en periodo', 'Lineas']];
            foreach ($byCategory as $row) {
                $rows[] = [
                    $this->stringValue($row['category'] ?? null),
                    $this->moneyValue($row['quantity'] ?? null),
                    $this->money($row['total'] ?? '0.00'),
                    $this->money($row['collected'] ?? '0.00'),
                    $this->count($row['item_count'] ?? 0),
                ];
            }
            $html .= $this->keepTogether('<h3 class="subsection">Por categoria</h3>'.$this->renderTable($rows, ['left', 'right', 'right', 'right', 'right']));
        }

        if ($byArea !== []) {
            $rows = [['Area', 'Cantidad cobrable', 'Valor de lineas', 'Lineas']];
            foreach ($byArea as $row) {
                $rows[] = [
                    $this->stringValue($row['area'] ?? null),
                    $this->moneyValue($row['quantity'] ?? null),
                    $this->money($row['total'] ?? '0.00'),
                    $this->count($row['item_count'] ?? 0),
                ];
            }
            $html .= $this->keepTogether('<h3 class="subsection">Por area</h3>'.$this->renderTable($rows, ['left', 'right', 'right', 'right']));
        }

        if ($byAmount === [] && $byQuantity === [] && $byCategory === [] && $byArea === []) {
            return $this->keepTogether($html.'<p class="empty">No hay conceptos cobrables asociados a pagos reales en el periodo.</p>');
        }

        return $html;
    }

    /** @param ReportRows $cashiers */
    private function renderCashiers(array $cashiers): string
    {
        if ($cashiers === []) {
            return $this->keepTogether(
                $this->sectionTitle('Cajeros', 'Sin pagos en el periodo.')
                .'<p class="empty">No hay cajeros con cobros en el periodo seleccionado.</p>'
            );
        }

        $rows = [['Cajero', 'Cobrado', 'Efectivo', 'Transferencia', 'Tarjeta', 'Otro', 'Pagos', 'Anuladas', 'Diferencias']];
        foreach ($cashiers as $row) {
            $rows[] = [
                $this->stringValue($row['name'] ?? null),
                $this->money($row['collected'] ?? '0.00'),
                $this->money($row['cash'] ?? '0.00'),
                $this->money($row['transfer'] ?? '0.00'),
                $this->money($row['card'] ?? '0.00'),
                $this->money($row['other'] ?? '0.00'),
                $this->count($row['payment_count'] ?? 0),
                $this->count($row['voided_count'] ?? 0),
                $this->moneySigned($row['difference_total'] ?? '0.00'),
            ];
        }

        return $this->sectionTitle(
            'Cajeros',
            'Recaudacion, distribucion por metodo y diferencias de caja por cajero.'
        ).$this->renderTable($rows, ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right']);
    }

    /** @param ReportRows $cashSessions */
    private function renderCashSessions(array $cashSessions): string
    {
        if ($cashSessions === []) {
            return $this->keepTogether(
                $this->sectionTitle('Sesiones de Caja', 'Sin sesiones registradas en el periodo.')
                .'<p class="empty">No hay aperturas o cierres en el periodo seleccionado.</p>'
            );
        }

        $rows = [['Sesion #', 'Caja fisica', 'Cajero', 'Apertura', 'Cierre', 'Inicial', 'Esperado', 'Contado', 'Diferencia', 'Estado', 'Nota']];
        foreach ($cashSessions as $row) {
            $registerCode = $this->nullableString($row['cash_register_code'] ?? null);
            $registerName = $this->nullableString($row['cash_register_name'] ?? null);
            $registerLabel = $registerName !== null && $registerName !== ''
                ? $registerName.($registerCode !== null && $registerCode !== '' ? ' ('.$registerCode.')' : '')
                : ($registerCode !== null && $registerCode !== '' ? $registerCode : 'Sin caja asignada');

            $rows[] = [
                $this->count($row['id'] ?? 0),
                $registerLabel,
                $this->stringValue($row['cashier'] ?? null),
                $this->localDateTimeLabel($row['opened_at'] ?? null),
                $this->localDateTimeLabel($row['closed_at'] ?? null),
                $this->money($row['opening_amount'] ?? '0.00'),
                $this->money($row['expected_cash'] ?? '0.00'),
                ($row['counted_cash'] ?? null) !== null ? $this->money($row['counted_cash']) : '-',
                ($row['difference'] ?? null) !== null ? $this->moneySigned($row['difference']) : '-',
                $this->statusLabel($row['status_label'] ?? $row['status'] ?? null),
                $this->stringValue($row['closure_note'] ?? null),
            ];
        }

        return $this->sectionTitle(
            'Sesiones de Caja',
            'Identidad de caja fisica y sesion, aperturas, cierres, contado vs esperado y diferencia justificada.'
        ).$this->renderTable($rows, ['right', 'left', 'left', 'left', 'left', 'right', 'right', 'right', 'right', 'left', 'left']);
    }

    /** @param ReportSection $pendingAging */
    private function renderPendingAging(array $pendingAging): string
    {
        $items = $this->rows($pendingAging['items'] ?? null);
        $bucket0Data = $this->section($pendingAging['0_7_days'] ?? null);
        $bucket8Data = $this->section($pendingAging['8_30_days'] ?? null);
        $bucket31Data = $this->section($pendingAging['31_plus_days'] ?? null);

        $bucket0 = $this->money($bucket0Data['amount'] ?? null);
        $bucket8 = $this->money($bucket8Data['amount'] ?? null);
        $bucket31 = $this->money($bucket31Data['amount'] ?? null);

        $count0 = $this->count($bucket0Data['count'] ?? null);
        $count8 = $this->count($bucket8Data['count'] ?? null);
        $count31 = $this->count($bucket31Data['count'] ?? null);

        $summaryTable = $this->renderTable(
            [
                ['Antiguedad', 'Cantidad', 'Saldo pendiente'],
                ['0 a 7 dias', $count0, $bucket0],
                ['8 a 30 dias', $count8, $bucket8],
                ['31 o mas dias', $count31, $bucket31],
            ],
            ['left', 'right', 'right']
        );

        $html = $this->sectionTitle(
            'Pendientes y Antiguedad',
            'Facturas con saldo abierto, agrupadas por dias desde la emision.'
        ).$summaryTable;

        if ($items !== []) {
            $rows = [['# Factura', 'Paciente', 'Emitida', 'Antiguedad', 'Total', 'Saldo']];
            foreach ($items as $row) {
                $rows[] = [
                    $this->stringValue($row['invoice_number'] ?? null),
                    $this->stringValue($row['patient'] ?? null),
                    $this->localDateLabel($row['issued_at'] ?? null),
                    $this->count($row['age_days'] ?? 0).' d',
                    $this->money($row['total'] ?? '0.00'),
                    $this->money($row['balance_due'] ?? '0.00'),
                ];
            }
            $html .= $this->keepTogether('<h3 class="subsection">Detalle</h3>'.$this->renderTable($rows, ['left', 'left', 'left', 'right', 'right', 'right']));
        }

        return $html;
    }

    /** @param ReportRows $rows */
    private function renderVoidsAndReversals(array $rows): string
    {
        if ($rows === []) {
            return $this->keepTogether(
                $this->sectionTitle('Anulaciones y Reversas', 'Sin anulaciones o reversas en el periodo.')
                .'<p class="empty">No hay movimientos en el periodo seleccionado.</p>'
            );
        }

        $tableRows = [['Tipo', '# Factura', 'Paciente', 'Monto', 'Usuario', 'Autorizado por', 'Motivo', 'Fecha']];
        foreach ($rows as $row) {
            $kind = ($row['kind'] ?? '') === 'reversal' ? 'Reversa' : 'Anulacion';
            $tableRows[] = [
                $kind,
                $this->stringValue($row['invoice_number'] ?? null),
                $this->stringValue($row['patient'] ?? null),
                $this->money($row['amount'] ?? null),
                $this->stringValue($row['user'] ?? null),
                $this->stringValue($row['authorized_by'] ?? null),
                $this->stringValue($row['reason'] ?? null),
                $this->localDateTimeLabel($row['created_at'] ?? null),
            ];
        }

        return $this->keepTogether($this->sectionTitle(
            'Anulaciones y Reversas',
            'Operaciones fuera del ingreso neto. Cada una con usuario, autorizador y motivo.'
        ).$this->renderTable($tableRows, ['left', 'left', 'left', 'right', 'left', 'left', 'left', 'left']));
    }

    /** @param ReportSection $audit */
    private function renderAudit(array $audit): string
    {
        $rows = [
            ['Indicador', 'Cantidad'],
            ['Eventos criticos', $this->count($audit['critical_events'] ?? 0)],
            ['Reimpresiones', $this->count($audit['reprints'] ?? 0)],
            ['Cambios fiscales', $this->count($audit['fiscal_changes'] ?? 0)],
            ['Diferencias de caja', $this->count($audit['cash_differences'] ?? 0)],
            ['Eventos de respaldo', $this->count($audit['backup_events'] ?? 0)],
        ];

        return $this->keepTogether($this->sectionTitle(
            'Resumen de Auditoria',
            'Conteos institucionales para supervision.'
        ).$this->renderTable($rows, ['left', 'right']));
    }

    /** @return ReportSection */
    private function section(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        $section = [];
        foreach ($value as $key => $item) {
            if (is_string($key)) {
                $section[$key] = $item;
            }
        }

        return $section;
    }

    /** @return ReportRows */
    private function rows(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        $rows = [];
        foreach ($value as $row) {
            if (is_array($row)) {
                $rows[] = $this->section($row);
            }
        }

        return $rows;
    }

    private function nullableString(mixed $value): ?string
    {
        return is_string($value) ? $value : null;
    }

    private function stringValue(mixed $value, string $default = ''): string
    {
        return $this->nullableString($value) ?? $default;
    }

    private function moneyValue(mixed $value): string
    {
        if (is_int($value)) {
            return (string) $value;
        }

        return is_string($value) && is_numeric($value) ? $value : '0';
    }

    private function countValue(mixed $value): int
    {
        if (is_int($value)) {
            return max(0, $value);
        }

        return is_string($value) && ctype_digit($value) ? (int) $value : 0;
    }

    private function moneyCents(mixed $value): int
    {
        try {
            return Money::parseCents($this->moneyValue($value), 'amount');
        } catch (\Throwable) {
            return 0;
        }
    }

    /**
     * Presenta una marca ISO como fecha local legible (America/Tegucigalpa).
     * Valores no parseables se muestran vacios, nunca como cadena ISO cruda.
     */
    private function localDateTimeLabel(mixed $value): string
    {
        $text = $this->nullableString($value);

        if ($text === null || trim($text) === '') {
            return '';
        }

        $text = trim($text);

        // Rechaza cadenas sin forma de fecha para no presentar valores hostiles
        // (p. ej. "@SUM(1,1)") ni fechas epoch inventadas.
        if (preg_match('/^\d[0-9TZtz+\-\.\/: ]*$/', $text) !== 1) {
            return '';
        }

        try {
            return Carbon::parse($text)->setTimezone('America/Tegucigalpa')->format('d/m/Y H:i');
        } catch (\Throwable) {
            return '';
        }
    }

    /** Presenta una fecha ISO como fecha local d/m/Y; vacia si no es parseable. */
    private function localDateLabel(mixed $value): string
    {
        $text = $this->nullableString($value);

        if ($text === null || trim($text) === '') {
            return '';
        }

        $text = trim($text);

        if (preg_match('/^\d[0-9TZtz+\-\.\/: ]*$/', $text) !== 1) {
            return '';
        }

        try {
            return Carbon::parse($text)->setTimezone('America/Tegucigalpa')->format('d/m/Y');
        } catch (\Throwable) {
            return '';
        }
    }

    private function statusLabel(mixed $status): string
    {
        $value = $this->nullableString($status);

        if ($value === null || $value === '') {
            return '';
        }

        return match ($value) {
            'open' => 'Abierta',
            'closed' => 'Cerrada',
            default => $value,
        };
    }

    private function nullableFloat(mixed $value): ?float
    {
        if (is_int($value) || is_float($value)) {
            $float = $value + 0.0;

            return is_finite($float) ? $float : null;
        }

        if (! is_string($value) || ! is_numeric($value)) {
            return null;
        }

        $float = $value + 0.0;

        return is_finite($float) ? $float : null;
    }

    private function renderFooter(Carbon $now): string
    {
        $stamp = $now->copy()->setTimezone('America/Tegucigalpa')->format('Y-m-d H:i');

        return <<<HTML
<div class="page-footer">
    <p>Documento generado por S_Hospital el {$this->e($stamp)} (America/Tegucigalpa).</p>
    <p>Los montos anulados y reversados ya estan excluidos de los totales activos; no se restan una segunda vez.</p>
</div>
HTML;
    }

    /**
     * @param  list<list<string>>  $rows
     * @param  list<string>  $alignments
     */
    /**
     * Renderiza una tabla. Si excede `$maxBodyRows`, la divide en bloques que
     * repiten el encabezado y viajan juntos (evita continuaciones sin titulo de
     * columna y titulos huerfanos). No se omite ninguna fila.
     *
     * @param  list<list<string>>  $rows
     * @param  list<string>  $alignments
     */
    private function renderTable(array $rows, array $alignments = [], int $maxBodyRows = 12): string
    {
        if ($rows === []) {
            return '<p class="empty">Sin datos.</p>';
        }

        $header = array_shift($rows);

        if (count($rows) <= $maxBodyRows) {
            return $this->renderTableBlock($header, $rows, $alignments);
        }

        $html = '';
        foreach (array_chunk($rows, max(1, $maxBodyRows)) as $chunk) {
            $html .= $this->keepTogether($this->renderTableBlock($header, $chunk, $alignments));
        }

        return $html;
    }

    /**
     * @param  list<string>  $header
     * @param  list<list<string>>  $rows
     * @param  list<string>  $alignments
     */
    private function renderTableBlock(array $header, array $rows, array $alignments): string
    {
        $tableClass = count($header) >= 8 ? 'report-table report-table-wide' : 'report-table';
        $head = '<tr>';
        foreach ($header as $i => $cell) {
            $align = $alignments[$i] ?? 'left';
            $head .= '<th style="text-align:'.$this->e($align).';">'.$this->e((string) $cell).'</th>';
        }
        $head .= '</tr>';

        $body = '';
        foreach ($rows as $row) {
            $body .= '<tr>';
            foreach ($row as $i => $cell) {
                $align = $alignments[$i] ?? 'left';
                $text = (string) $cell;
                $class = preg_match('/^(?:- )?L\. [0-9,]+\.\d{2}$/', $text) === 1 ? ' class="money-cell"' : '';
                $body .= '<td'.$class.' style="text-align:'.$this->e($align).';">'.$this->e($text).'</td>';
            }
            $body .= '</tr>';
        }

        return '<table class="'.$tableClass.'"><thead>'.$head.'</thead><tbody>'.$body.'</tbody></table>';
    }

    private function wrapHtml(string $css, string $body, string $hospitalName): string
    {
        $title = 'Reporte Ejecutivo - '.$hospitalName;

        return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>'.$this->e($title).'</title><style>'.$css.'</style></head><body data-report-style="minimal-monochrome">'.$body.'</body></html>';
    }

    private function buildCss(): string
    {
        return <<<'CSS'
@page { size: letter portrait; margin: 1.5cm 1.5cm 1.8cm 1.5cm; }
body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #1f2937;
    font-size: 11px;
    line-height: 1.45;
    margin: 0;
    padding: 0;
}
.page-header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 18px; }
.page-header-left { float: left; }
.page-header-right { float: right; text-align: right; }
.gov { font-size: 10px; color: #475569; margin: 0; text-transform: uppercase; letter-spacing: 0.05em; }
.sec { font-size: 10px; color: #374151; margin: 2px 0 0; text-transform: uppercase; letter-spacing: 0.05em; font-weight: bold; }
.hospital { font-size: 18px; color: #0f172a; margin: 4px 0 0; font-weight: bold; }
.meta { font-size: 10px; color: #64748b; margin: 0; }
.doc-type { font-size: 16px; color: #0f172a; margin: 0; font-weight: bold; text-transform: uppercase; }
.period { font-size: 10px; color: #475569; margin: 2px 0 0; }
.clear { clear: both; }
.section-heading { margin-top: 18px; border-bottom: 1px solid #2563eb; padding-bottom: 4px; page-break-inside: avoid; break-inside: avoid; page-break-after: avoid; break-after: avoid; }
.section-title { font-size: 13px; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 0.04em; }
.section-sub { font-size: 10px; color: #475569; margin: 4px 0 0; }
.subsection { font-size: 11px; color: #0f172a; margin: 12px 0 4px; text-transform: uppercase; letter-spacing: 0.04em; page-break-after: avoid; break-after: avoid; }
.kpi-grid { width: 100%; margin-top: 6px; }
.kpi-card { display: inline-block; width: 24%; vertical-align: top; background: #ffffff; border: 0; border-top: 1px solid #9ca3af; padding: 8px 0; margin: 0 0.5% 8px; box-sizing: border-box; }
.kpi-label { font-size: 9px; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; margin: 0; }
.kpi-value { font-size: 15px; color: #0f172a; font-weight: bold; margin: 4px 0 0; white-space: nowrap; }
.kpi-delta { font-size: 9px; color: #374151; margin: 2px 0 0; font-weight: bold; }
.kpi-helper { font-size: 9px; color: #64748b; margin: 2px 0 0; }
/* En continuaciones (p. ej. "Por area") se repite el encabezado y se evita
   que un titulo quede huerfano al final de pagina. */
.report-table { width: 100%; border-collapse: collapse; margin-top: 4px; page-break-inside: auto; }
.report-table thead { display: table-header-group; }
.report-table tr { page-break-inside: avoid; }
.report-table th { background: #ffffff; border-bottom: 1px solid #111827; color: #111827; font-size: 10px; padding: 6px 8px; text-align: left; }
.report-table td { font-size: 10px; padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
.report-table-wide th { padding-left: 3px; padding-right: 3px; }
.report-table-wide td { padding-left: 3px; padding-right: 3px; }
.report-table .money-cell { font-variant-numeric: tabular-nums; white-space: nowrap; }
.report-table tr:nth-child(even) td { background: #f8fafc; }
.empty { font-size: 10px; color: #64748b; font-style: italic; margin: 6px 0; }
.keep-together { page-break-inside: avoid; }
.page-footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #cbd5e1; font-size: 9px; color: #64748b; text-align: center; }
.page-footer p { margin: 2px 0; }
CSS;
    }
}
