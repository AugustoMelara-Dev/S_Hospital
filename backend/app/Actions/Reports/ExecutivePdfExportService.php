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

        $css = $this->buildCss();
        $html = $this->wrapHtml(
            $css,
            $this->renderHeader($hospitalName, $rtn, $address, $governmentLine, $secretariatLine, $period, $now, $generatedBy)
            .$this->renderExecutiveSummary($summary, $comparison)
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

        return Pdf::loadHTML($html)->output();
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
        return Money::formatLempiras(Money::parseCents($this->moneyValue($value), 'amount'));
    }

    private function moneySigned(mixed $value): string
    {
        $raw = $this->moneyValue($value);
        $cents = Money::parseCents($raw, 'amount');
        $absolute = abs($cents);
        $formatted = intdiv($absolute, 100).'.'.str_pad((string) ($absolute % 100), 2, '0', STR_PAD_LEFT);

        return $cents < 0 ? '- L. '.$formatted : 'L. '.$formatted;
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

    /** @param ReportSection $period */
    private function renderHeader(
        string $hospitalName,
        string $rtn,
        string $address,
        string $governmentLine,
        string $secretariatLine,
        array $period,
        Carbon $now,
        ?string $generatedBy,
    ): string {
        $from = $this->stringValue($period['from'] ?? null);
        $to = $this->stringValue($period['to'] ?? null);

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
        <p class="period">Generado: {$this->e($now->format('Y-m-d H:i'))}</p>
        <p class="period">Zona horaria: America/Tegucigalpa</p>
        <p class="period">Por: {$this->e($generatedBy ?? 'Sistema')}</p>
    </div>
    <div class="clear"></div>
</div>
HTML;
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
        .$this->kpiCard('Recibos', $this->count($summary['receipt_count'] ?? 0), null, 'Pagos contabilizados.')
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

        return $this->sectionTitle(
            'Lectura Financiera',
            'Definiciones contables no negociables. Cada monto cita su fuente y definicion.'
        ).$this->renderTable($rows, ['left', 'right', 'left']);
    }

    /** @param ReportRows $paymentMethods */
    private function renderPaymentMethods(array $paymentMethods): string
    {
        $rows = [['Metodo', 'Monto', 'Pagos', '% del total']];
        foreach ($paymentMethods as $method) {
            $rows[] = [
                $this->stringValue($method['label'] ?? null, $this->stringValue($method['method'] ?? null)),
                $this->money($method['amount'] ?? '0.00'),
                $this->count($method['count'] ?? 0),
                number_format($this->percentageFloat($method['percentage'] ?? '0'), 2).'%',
            ];
        }

        return $this->sectionTitle(
            'Recaudacion por Metodo de Pago',
            'Efectivo entra al efectivo esperado de caja. Los demas metodos se concilian por separado.'
        ).$this->renderTable($rows, ['left', 'right', 'right', 'right']);
    }

    /** @param ReportRows $dailyTrend */
    private function renderDailyTrend(array $dailyTrend): string
    {
        if ($dailyTrend === []) {
            return $this->sectionTitle('Tendencia Diaria', 'Sin datos en el periodo seleccionado.')
                .'<p class="empty">No hay datos para mostrar.</p>';
        }

        $rows = [['Fecha', 'Facturado', 'Cobrado', 'Pendiente', 'Anuladas', 'Facturas']];
        foreach ($dailyTrend as $row) {
            $rows[] = [
                $this->stringValue($row['date'] ?? null),
                $this->money($row['billed'] ?? '0.00'),
                $this->money($row['collected'] ?? '0.00'),
                $this->money($row['pending'] ?? '0.00'),
                $this->count($row['voided_count'] ?? 0),
                $this->count($row['invoice_count'] ?? 0),
            ];
        }

        return $this->sectionTitle(
            'Tendencia Diaria',
            'Facturado, cobrado, pendiente y anulaciones por dia.'
        ).$this->renderTable($rows, ['left', 'right', 'right', 'right', 'right', 'right']);
    }

    /** @param ReportSection $services */
    private function renderServices(array $services): string
    {
        $byAmount = $this->rows($services['top_by_amount'] ?? null);
        $byQuantity = $this->rows($services['top_by_quantity'] ?? null);
        $byCategory = $this->rows($services['by_category'] ?? null);
        $byArea = $this->rows($services['by_area'] ?? null);

        $html = $this->sectionTitle(
            'Servicios y Categorias',
            'Top servicios por monto, cantidad, categoria y area.'
        );

        if ($byAmount !== []) {
            $rows = [['Servicio', 'Categoria', 'Cantidad', 'Facturado', 'Cobrado']];
            foreach ($byAmount as $row) {
                $rows[] = [
                    $this->stringValue($row['service'] ?? null),
                    $this->stringValue($row['category'] ?? null),
                    $this->moneyValue($row['quantity'] ?? null),
                    $this->money($row['total'] ?? '0.00'),
                    $this->money($row['collected'] ?? '0.00'),
                ];
            }
            $html .= '<h3 class="subsection">Top por monto</h3>'.$this->renderTable($rows, ['left', 'left', 'right', 'right', 'right']);
        }

        if ($byQuantity !== []) {
            $rows = [['Servicio', 'Categoria', 'Cantidad', 'Facturado']];
            foreach ($byQuantity as $row) {
                $rows[] = [
                    $this->stringValue($row['service'] ?? null),
                    $this->stringValue($row['category'] ?? null),
                    $this->moneyValue($row['quantity'] ?? null),
                    $this->money($row['total'] ?? '0.00'),
                ];
            }
            $html .= '<h3 class="subsection">Top por cantidad</h3>'.$this->renderTable($rows, ['left', 'left', 'right', 'right']);
        }

        if ($byCategory !== []) {
            $rows = [['Categoria', 'Cantidad', 'Facturado', 'Cobrado', 'Items']];
            foreach ($byCategory as $row) {
                $rows[] = [
                    $this->stringValue($row['category'] ?? null),
                    $this->moneyValue($row['quantity'] ?? null),
                    $this->money($row['total'] ?? '0.00'),
                    $this->money($row['collected'] ?? '0.00'),
                    $this->count($row['item_count'] ?? 0),
                ];
            }
            $html .= '<h3 class="subsection">Por categoria</h3>'.$this->renderTable($rows, ['left', 'right', 'right', 'right', 'right']);
        }

        if ($byArea !== []) {
            $rows = [['Area', 'Cantidad', 'Facturado', 'Items']];
            foreach ($byArea as $row) {
                $rows[] = [
                    $this->stringValue($row['area'] ?? null),
                    $this->moneyValue($row['quantity'] ?? null),
                    $this->money($row['total'] ?? '0.00'),
                    $this->count($row['item_count'] ?? 0),
                ];
            }
            $html .= '<h3 class="subsection">Por area</h3>'.$this->renderTable($rows, ['left', 'right', 'right', 'right']);
        }

        if ($byAmount === [] && $byQuantity === [] && $byCategory === [] && $byArea === []) {
            $html .= '<p class="empty">No hay servicios facturados en el periodo.</p>';
        }

        return $html;
    }

    /** @param ReportRows $cashiers */
    private function renderCashiers(array $cashiers): string
    {
        if ($cashiers === []) {
            return $this->sectionTitle('Cajeros', 'Sin pagos en el periodo.')
                .'<p class="empty">No hay cajeros con cobros en el periodo seleccionado.</p>';
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
            return $this->sectionTitle('Sesiones de Caja', 'Sin sesiones registradas en el periodo.')
                .'<p class="empty">No hay aperturas o cierres en el periodo seleccionado.</p>';
        }

        $rows = [['Cajero', 'Apertura', 'Cierre', 'Inicial', 'Esperado', 'Contado', 'Diferencia', 'Estado', 'Nota']];
        foreach ($cashSessions as $row) {
            $rows[] = [
                $this->stringValue($row['cashier'] ?? null),
                $this->stringValue($row['opened_at'] ?? null),
                $this->stringValue($row['closed_at'] ?? null),
                $this->money($row['opening_amount'] ?? '0.00'),
                $this->money($row['expected_cash'] ?? '0.00'),
                ($row['counted_cash'] ?? null) !== null ? $this->money($row['counted_cash']) : '-',
                ($row['difference'] ?? null) !== null ? $this->moneySigned($row['difference']) : '-',
                $this->stringValue($row['status'] ?? null),
                $this->stringValue($row['closure_note'] ?? null),
            ];
        }

        return $this->sectionTitle(
            'Sesiones de Caja',
            'Aperturas, cierres, contado vs esperado y diferencia justificada.'
        ).$this->renderTable($rows, ['left', 'left', 'left', 'right', 'right', 'right', 'right', 'left', 'left']);
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
                    $this->stringValue($row['issued_at'] ?? null),
                    $this->count($row['age_days'] ?? 0).' d',
                    $this->money($row['total'] ?? '0.00'),
                    $this->money($row['balance_due'] ?? '0.00'),
                ];
            }
            $html .= '<h3 class="subsection">Detalle</h3>'.$this->renderTable($rows, ['left', 'left', 'left', 'right', 'right', 'right']);
        }

        return $html;
    }

    /** @param ReportRows $rows */
    private function renderVoidsAndReversals(array $rows): string
    {
        if ($rows === []) {
            return $this->sectionTitle('Anulaciones y Reversas', 'Sin anulaciones o reversas en el periodo.')
                .'<p class="empty">No hay movimientos en el periodo seleccionado.</p>';
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
                $this->stringValue($row['created_at'] ?? null),
            ];
        }

        return $this->sectionTitle(
            'Anulaciones y Reversas',
            'Operaciones fuera del ingreso neto. Cada una con usuario, autorizador y motivo.'
        ).$this->renderTable($tableRows, ['left', 'left', 'left', 'right', 'left', 'left', 'left', 'left']);
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

        return $this->sectionTitle(
            'Resumen de Auditoria',
            'Conteos institucionales para supervision.'
        ).$this->renderTable($rows, ['left', 'right']);
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

    private function nullableFloat(mixed $value): ?float
    {
        if (is_int($value) || is_float($value)) {
            $float = (float) $value;

            return is_finite($float) ? $float : null;
        }

        return is_string($value) && is_numeric($value) && is_finite((float) $value)
            ? (float) $value
            : null;
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
    private function renderTable(array $rows, array $alignments = []): string
    {
        if ($rows === []) {
            return '<p class="empty">Sin datos.</p>';
        }

        $header = array_shift($rows);
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
                $body .= '<td style="text-align:'.$this->e($align).';">'.$this->e((string) $cell).'</td>';
            }
            $body .= '</tr>';
        }

        return '<table class="report-table"><thead>'.$head.'</thead><tbody>'.$body.'</tbody></table>';
    }

    private function wrapHtml(string $css, string $body, string $hospitalName): string
    {
        $title = 'Reporte Ejecutivo - '.$hospitalName;

        return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>'.$this->e($title).'</title><style>'.$css.'</style></head><body>'.$body.'</body></html>';
    }

    private function buildCss(): string
    {
        return <<<'CSS'
@page { margin: 1.5cm; }
body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #1f2937;
    font-size: 11px;
    line-height: 1.45;
    margin: 0;
    padding: 0;
}
.page-header { border-bottom: 2px solid #0d9488; padding-bottom: 12px; margin-bottom: 18px; }
.page-header-left { float: left; }
.page-header-right { float: right; text-align: right; }
.gov { font-size: 10px; color: #475569; margin: 0; text-transform: uppercase; letter-spacing: 0.05em; }
.sec { font-size: 10px; color: #0d9488; margin: 2px 0 0; text-transform: uppercase; letter-spacing: 0.05em; font-weight: bold; }
.hospital { font-size: 18px; color: #0f172a; margin: 4px 0 0; font-weight: bold; }
.meta { font-size: 10px; color: #64748b; margin: 0; }
.doc-type { font-size: 16px; color: #0f172a; margin: 0; font-weight: bold; text-transform: uppercase; }
.period { font-size: 10px; color: #475569; margin: 2px 0 0; }
.clear { clear: both; }
.section-heading { margin-top: 18px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
.section-title { font-size: 13px; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 0.04em; }
.section-sub { font-size: 10px; color: #475569; margin: 4px 0 0; }
.subsection { font-size: 11px; color: #0f172a; margin: 12px 0 4px; text-transform: uppercase; letter-spacing: 0.04em; }
.kpi-grid { width: 100%; margin-top: 6px; }
.kpi-card { display: inline-block; width: 24%; vertical-align: top; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px; margin: 0 0.5% 8px; box-sizing: border-box; }
.kpi-label { font-size: 9px; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; margin: 0; }
.kpi-value { font-size: 15px; color: #0f172a; font-weight: bold; margin: 4px 0 0; }
.kpi-delta { font-size: 9px; color: #0d9488; margin: 2px 0 0; font-weight: bold; }
.kpi-helper { font-size: 9px; color: #64748b; margin: 2px 0 0; }
.report-table { width: 100%; border-collapse: collapse; margin-top: 4px; }
.report-table th { background: #0f172a; color: #f8fafc; font-size: 10px; padding: 6px 8px; text-align: left; }
.report-table td { font-size: 10px; padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
.report-table tr:nth-child(even) td { background: #f8fafc; }
.empty { font-size: 10px; color: #64748b; font-style: italic; margin: 6px 0; }
.page-footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #cbd5e1; font-size: 9px; color: #64748b; text-align: center; }
.page-footer p { margin: 2px 0; }
CSS;
    }
}
