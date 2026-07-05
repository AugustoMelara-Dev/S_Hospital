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
 */
class ExecutivePdfExportService
{
    public function buildHtml(array $report, array $fiscal, ?string $generatedBy = null, ?Carbon $generatedAt = null): string
    {
        $now = $generatedAt ?? Carbon::now('America/Tegucigalpa');
        $hospitalName = HospitalName::display($fiscal['hospital_name'] ?? null);
        $rtn = (string) ($fiscal['rtn'] ?? 'N/A');
        $address = (string) ($fiscal['address'] ?? '');
        $governmentLine = (string) ($fiscal['receipt_government_line'] ?? 'Gobierno de Honduras');
        $secretariatLine = (string) ($fiscal['receipt_secretariat_line'] ?? 'Secretaria de Salud');

        $period = $report['period'] ?? [];
        $summary = $report['summary'] ?? [];
        $paymentMethods = $report['payment_methods'] ?? [];
        $dailyTrend = $report['daily_trend'] ?? [];
        $services = $report['services'] ?? [];
        $cashiers = $report['cashiers'] ?? [];
        $cashSessions = $report['cash_sessions'] ?? [];
        $pendingAging = $report['pending_aging'] ?? [];
        $canViewAudit = ($report['can_view_audit'] ?? true) === true;
        $voids = $report['voids_and_reversals'] ?? [];
        $audit = $report['audit_summary'] ?? [];
        $comparison = $report['comparison'] ?? [];

        $css = $this->buildCss();
        $html = $this->wrapHtml(
            $css,
            $this->renderHeader($hospitalName, $rtn, $address, $governmentLine, $secretariatLine, $period, $now, $generatedBy)
            .$this->renderExecutiveSummary($summary, $comparison)
            .$this->renderFinancialReading($summary, $paymentMethods)
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

    private function money(?string $value): string
    {
        return Money::formatLempiras(Money::parseCents((string) ($value ?? 0), 'amount'));
    }

    private function moneySigned(?string $value): string
    {
        $raw = (string) ($value ?? '0');
        $cents = Money::parseCents($raw, 'amount');
        $absolute = abs($cents);
        $formatted = intdiv($absolute, 100).'.'.str_pad((string) ($absolute % 100), 2, '0', STR_PAD_LEFT);

        return $cents < 0 ? '- L. '.$formatted : 'L. '.$formatted;
    }

    private function pct(?float $value): string
    {
        if ($value === null) {
            return 'n/d';
        }

        $sign = $value > 0 ? '+' : '';

        return $sign.number_format($value, 2).'%';
    }

    private function percentageFloat(mixed $value): float
    {
        $string = (string) ($value ?? '0');

        if (is_numeric($string)) {
            return $string + 0;
        }

        return 0.0;
    }

    private function count(?int $value): string
    {
        return number_format((int) ($value ?? 0));
    }

    private function sectionTitle(string $title, string $subtitle = ''): string
    {
        $sub = $subtitle !== ''
            ? '<p class="section-sub">'.$this->e($subtitle).'</p>'
            : '';

        return '<div class="section-heading"><h2 class="section-title">'.$this->e($title).'</h2>'.$sub.'</div>';
    }

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
        $from = $period['from'] ?? '';
        $to = $period['to'] ?? '';

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

    private function renderExecutiveSummary(array $summary, array $comparison): string
    {
        $billed = $this->money($summary['billed_total'] ?? '0.00');
        $collected = $this->money($summary['collected_total'] ?? '0.00');
        $pending = $this->money($summary['pending_total'] ?? '0.00');
        $voided = $this->money($summary['voided_total'] ?? '0.00');
        $average = $this->money($summary['average_ticket'] ?? '0.00');

        $billedDelta = $this->pct($comparison['billed']['delta_percentage'] ?? null);
        $collectedDelta = $this->pct($comparison['collected']['delta_percentage'] ?? null);
        $previousPeriod = $comparison['previous_period'] ?? [];
        $prevLabel = ($previousPeriod['from'] ?? '').' - '.($previousPeriod['to'] ?? '');

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

    private function renderFinancialReading(array $summary, array $paymentMethods): string
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
            ['Facturado', $billed, 'Total de facturas emitidas no anuladas en el periodo.'],
            ['Cobrado', $collected, 'Total de pagos registrados no anulados en el periodo.'],
            ['Efectivo recaudado', $cash, 'Pagos con metodo efectivo. Afecta efectivo esperado de caja.'],
            ['Pendiente', $pending, 'Saldo abierto de facturas emitidas o parciales.'],
            ['Anulado', $voided, 'Facturas anuladas. Fuera del ingreso neto.'],
            ['Reversado', $reversed, 'Operaciones revertidas con auditoria. Fuera del ingreso neto.'],
        ];

        return $this->sectionTitle(
            'Lectura Financiera',
            'Definiciones contables no negociables. Cada monto cita su fuente y definicion.'
        ).$this->renderTable($rows, ['left', 'right', 'left']);
    }

    private function renderPaymentMethods(array $paymentMethods): string
    {
        $rows = [['Metodo', 'Monto', 'Pagos', '% del total']];
        foreach ($paymentMethods as $method) {
            $rows[] = [
                (string) ($method['label'] ?? $method['method'] ?? ''),
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

    private function renderDailyTrend(array $dailyTrend): string
    {
        if ($dailyTrend === []) {
            return $this->sectionTitle('Tendencia Diaria', 'Sin datos en el periodo seleccionado.')
                .'<p class="empty">No hay datos para mostrar.</p>';
        }

        $rows = [['Fecha', 'Facturado', 'Cobrado', 'Pendiente', 'Anuladas', 'Facturas']];
        foreach ($dailyTrend as $row) {
            $rows[] = [
                (string) ($row['date'] ?? ''),
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

    private function renderServices(array $services): string
    {
        $byAmount = $services['top_by_amount'] ?? [];
        $byQuantity = $services['top_by_quantity'] ?? [];
        $byCategory = $services['by_category'] ?? [];
        $byArea = $services['by_area'] ?? [];

        $html = $this->sectionTitle(
            'Servicios y Categorias',
            'Top servicios por monto, cantidad, categoria y area.'
        );

        if ($byAmount !== []) {
            $rows = [['Servicio', 'Categoria', 'Cantidad', 'Facturado', 'Cobrado']];
            foreach ($byAmount as $row) {
                $rows[] = [
                    (string) ($row['service'] ?? ''),
                    (string) ($row['category'] ?? ''),
                    (string) ($row['quantity'] ?? '0.00'),
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
                    (string) ($row['service'] ?? ''),
                    (string) ($row['category'] ?? ''),
                    (string) ($row['quantity'] ?? '0.00'),
                    $this->money($row['total'] ?? '0.00'),
                ];
            }
            $html .= '<h3 class="subsection">Top por cantidad</h3>'.$this->renderTable($rows, ['left', 'left', 'right', 'right']);
        }

        if ($byCategory !== []) {
            $rows = [['Categoria', 'Cantidad', 'Facturado', 'Cobrado', 'Items']];
            foreach ($byCategory as $row) {
                $rows[] = [
                    (string) ($row['category'] ?? ''),
                    (string) ($row['quantity'] ?? '0.00'),
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
                    (string) ($row['area'] ?? ''),
                    (string) ($row['quantity'] ?? '0.00'),
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

    private function renderCashiers(array $cashiers): string
    {
        if ($cashiers === []) {
            return $this->sectionTitle('Cajeros', 'Sin pagos en el periodo.')
                .'<p class="empty">No hay cajeros con cobros en el periodo seleccionado.</p>';
        }

        $rows = [['Cajero', 'Cobrado', 'Efectivo', 'Transferencia', 'Tarjeta', 'Otro', 'Pagos', 'Anuladas', 'Diferencias']];
        foreach ($cashiers as $row) {
            $rows[] = [
                (string) ($row['name'] ?? ''),
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

    private function renderCashSessions(array $cashSessions): string
    {
        if ($cashSessions === []) {
            return $this->sectionTitle('Sesiones de Caja', 'Sin sesiones registradas en el periodo.')
                .'<p class="empty">No hay aperturas o cierres en el periodo seleccionado.</p>';
        }

        $rows = [['Cajero', 'Apertura', 'Cierre', 'Inicial', 'Esperado', 'Contado', 'Diferencia', 'Estado', 'Nota']];
        foreach ($cashSessions as $row) {
            $rows[] = [
                (string) ($row['cashier'] ?? ''),
                (string) ($row['opened_at'] ?? ''),
                (string) ($row['closed_at'] ?? ''),
                $this->money($row['opening_amount'] ?? '0.00'),
                $this->money($row['expected_cash'] ?? '0.00'),
                $row['counted_cash'] !== null ? $this->money((string) $row['counted_cash']) : '-',
                $row['difference'] !== null ? $this->moneySigned((string) $row['difference']) : '-',
                (string) ($row['status'] ?? ''),
                (string) ($row['closure_note'] ?? ''),
            ];
        }

        return $this->sectionTitle(
            'Sesiones de Caja',
            'Aperturas, cierres, contado vs esperado y diferencia justificada.'
        ).$this->renderTable($rows, ['left', 'left', 'left', 'right', 'right', 'right', 'right', 'left', 'left']);
    }

    private function renderPendingAging(array $pendingAging): string
    {
        $items = $pendingAging['items'] ?? [];

        $bucket0 = $this->money($pendingAging['0_7_days']['amount'] ?? '0.00');
        $bucket8 = $this->money($pendingAging['8_30_days']['amount'] ?? '0.00');
        $bucket31 = $this->money($pendingAging['31_plus_days']['amount'] ?? '0.00');

        $count0 = $this->count($pendingAging['0_7_days']['count'] ?? 0);
        $count8 = $this->count($pendingAging['8_30_days']['count'] ?? 0);
        $count31 = $this->count($pendingAging['31_plus_days']['count'] ?? 0);

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
                    (string) ($row['invoice_number'] ?? ''),
                    (string) ($row['patient'] ?? ''),
                    (string) ($row['issued_at'] ?? ''),
                    $this->count($row['age_days'] ?? 0).' d',
                    $this->money($row['total'] ?? '0.00'),
                    $this->money($row['balance_due'] ?? '0.00'),
                ];
            }
            $html .= '<h3 class="subsection">Detalle</h3>'.$this->renderTable($rows, ['left', 'left', 'left', 'right', 'right', 'right']);
        }

        return $html;
    }

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
                (string) ($row['invoice_number'] ?? ''),
                (string) ($row['patient'] ?? ''),
                $this->money((string) ($row['amount'] ?? '0.00')),
                (string) ($row['user'] ?? ''),
                (string) ($row['authorized_by'] ?? ''),
                (string) ($row['reason'] ?? ''),
                (string) ($row['created_at'] ?? ''),
            ];
        }

        return $this->sectionTitle(
            'Anulaciones y Reversas',
            'Operaciones fuera del ingreso neto. Cada una con usuario, autorizador y motivo.'
        ).$this->renderTable($tableRows, ['left', 'left', 'left', 'right', 'left', 'left', 'left', 'left']);
    }

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

    private function renderFooter(Carbon $now): string
    {
        $stamp = $now->copy()->setTimezone('America/Tegucigalpa')->format('Y-m-d H:i');

        return <<<HTML
<div class="page-footer">
    <p>Documento generado por S_Hospital el {$this->e($stamp)} (America/Tegucigalpa).</p>
    <p>Los montos anulados y reversados no forman parte del ingreso neto.</p>
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
