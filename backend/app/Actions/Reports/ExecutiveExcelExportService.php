<?php

namespace App\Actions\Reports;

use App\Support\ExcelSafe;
use App\Support\HospitalName;
use App\Support\Money;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Builds a multi-sheet XLSX workbook from an executive report payload.
 *
 * Sheets:
 *  1. Resumen
 *  2. Cobros por metodo
 *  3. Facturado diario
 *  4. Servicios
 *  5. Cajeros
 *  6. Caja
 *  7. Pendientes
 *  8. Anulaciones y reversas
 *  9. Auditoria
 * 10. Glosario
 *
 * @phpstan-type ExecutiveReport array<string, mixed>
 */
class ExecutiveExcelExportService
{
    /**
     * @param  ExecutiveReport  $report
     * @param  array<string, mixed>  $fiscal
     */
    public function generate(array $report, array $fiscal, Carbon $from, Carbon $to, ?string $generatedBy = null): Spreadsheet
    {
        $spreadsheet = new Spreadsheet;
        $spreadsheet->removeSheetByIndex(0);

        $hospitalName = HospitalName::display($this->plainText($fiscal['hospital_name'] ?? null));
        $rtn = $this->plainText($fiscal['rtn'] ?? null) ?? 'N/A';

        $this->buildSummarySheet($spreadsheet, $report, $hospitalName, $rtn, $from, $to, $generatedBy);
        $this->buildPaymentMethodsSheet($spreadsheet, $report, $hospitalName, $rtn);
        $this->buildDailyTrendSheet($spreadsheet, $report, $hospitalName, $rtn);
        $this->buildServicesSheet($spreadsheet, $report, $hospitalName, $rtn);
        $this->buildCashiersSheet($spreadsheet, $report, $hospitalName, $rtn);
        $this->buildCashSessionsSheet($spreadsheet, $report, $hospitalName, $rtn);
        $this->buildPendingSheet($spreadsheet, $report, $hospitalName, $rtn);
        if (($report['can_view_audit'] ?? true) === true) {
            $this->buildVoidsSheet($spreadsheet, $report, $hospitalName, $rtn);
            $this->buildAuditSheet($spreadsheet, $report, $hospitalName, $rtn);
        }
        $this->buildGlossarySheet($spreadsheet, $hospitalName, $rtn);

        return $spreadsheet;
    }

    /** @param ExecutiveReport $report */
    private function buildSummarySheet(
        Spreadsheet $spreadsheet,
        array $report,
        string $hospitalName,
        string $rtn,
        Carbon $from,
        Carbon $to,
        ?string $generatedBy,
    ): void {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Resumen');

        $row = 1;
        $sheet->setCellValue("A{$row}", ExcelSafe::value('Reporte Ejecutivo'));
        $sheet->mergeCells("A{$row}:C{$row}");
        $this->applyTitleStyle($sheet, "A{$row}:C{$row}");
        $row++;

        $sheet->setCellValue("A{$row}", ExcelSafe::value($hospitalName));
        $sheet->mergeCells("A{$row}:C{$row}");
        $this->applySubtitleStyle($sheet, "A{$row}:C{$row}");
        $row++;

        $sheet->setCellValue("A{$row}", ExcelSafe::value('RTN: '.$rtn));
        $sheet->mergeCells("A{$row}:C{$row}");
        $row++;

        $sheet->setCellValue("A{$row}", ExcelSafe::value('Periodo: '.$from->toDateString().' a '.$to->toDateString()));
        $sheet->mergeCells("A{$row}:C{$row}");
        $row++;

        $sheet->setCellValue("A{$row}", ExcelSafe::value('Generado: '.($generatedBy ?? 'Sistema').' - '.
            Carbon::now('America/Tegucigalpa')->format('Y-m-d H:i')));
        $sheet->mergeCells("A{$row}:C{$row}");
        $row += 2;

        $summary = $this->section($report['summary'] ?? null);
        $comparison = $this->section($report['comparison'] ?? null);
        $billedComparison = $this->section($comparison['billed'] ?? null);
        $collectedComparison = $this->section($comparison['collected'] ?? null);

        $rows = [
            ['Indicador', 'Valor', 'Variacion vs periodo anterior'],
            ['Total Facturado', $this->moneyFloat($summary['billed_total'] ?? '0.00'), $this->pctLabel($billedComparison['delta_percentage'] ?? null)],
            ['Total Cobrado', $this->moneyFloat($summary['collected_total'] ?? '0.00'), $this->pctLabel($collectedComparison['delta_percentage'] ?? null)],
            ['Saldo Pendiente', $this->moneyFloat($summary['pending_total'] ?? '0.00'), null],
            ['Anulado', $this->moneyFloat($summary['voided_total'] ?? '0.00'), null],
            ['Reversado', $this->moneyFloat($summary['reversed_total'] ?? '0.00'), null],
            ['Facturas', $this->safeCount($summary['invoice_count'] ?? 0), null],
            ['Recibos', $this->safeCount($summary['receipt_count'] ?? 0), null],
            ['Pagadas', $this->safeCount($summary['paid_count'] ?? 0), null],
            ['Parciales', $this->safeCount($summary['partial_count'] ?? 0), null],
            ['Pendientes', $this->safeCount($summary['pending_count'] ?? 0), null],
            ['Anuladas', $this->safeCount($summary['voided_count'] ?? 0), null],
            ['Ticket Promedio', $this->moneyFloat($summary['average_ticket'] ?? '0.00'), null],
        ];

        foreach ($rows as $r) {
            $sheet->setCellValue("A{$row}", $this->safeText($r[0]));
            $sheet->setCellValue("B{$row}", $r[1]);
            $sheet->setCellValue("C{$row}", $this->safeText($r[2] ?? ''));
            $row++;
        }

        $this->applyTableHeaderStyle($sheet, 'A'.($row - count($rows)).':C'.($row - 1));
        $this->applyDataRowStyle($sheet, 'B2:B'.($row - 1), '#,##0.00');
        $this->applyDataRowStyle($sheet, 'A2:A'.($row - 1), '@');
        $sheet->getColumnDimension('A')->setWidth(40);
        $sheet->getColumnDimension('B')->setWidth(24);
        $sheet->getColumnDimension('C')->setWidth(28);

        $sheet->freezePane('A6');
    }

    /** @param ExecutiveReport $report */
    private function buildPaymentMethodsSheet(Spreadsheet $spreadsheet, array $report, string $hospital, string $rtn): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Cobros por metodo');

        $methods = $this->rows($report['payment_methods'] ?? null);
        $row = $this->writeSheetHeader($sheet, 'Cobros por Metodo de Pago', [
            'Metodo', 'Monto (L.)', 'Pagos', '% del total',
        ]);

        $totalCents = 0;
        foreach ($methods as $method) {
            $totalCents += $this->moneyToCents($method['amount'] ?? '0.00');
        }

        foreach ($methods as $method) {
            $sheet->setCellValue("A{$row}", $this->safeText($method['label'] ?? $method['method'] ?? ''));
            $sheet->setCellValue("B{$row}", $this->moneyFloat($method['amount'] ?? '0.00'));
            $sheet->setCellValue("C{$row}", $this->safeCount($method['count'] ?? 0));
            $sheet->setCellValue("D{$row}", $this->percentageValue($method['percentage'] ?? '0'));
            $row++;
        }

        $sheet->setCellValue("A{$row}", 'Total');
        $sheet->setCellValue("B{$row}", $totalCents / 100);
        $sheet->setCellValue("C{$row}", array_sum(array_map(fn ($m) => $this->safeCount($m['count'] ?? 0), $methods)));
        $sheet->setCellValue("D{$row}", 1);
        $this->applyBoldRow($sheet, "A{$row}:D{$row}");

        $this->applyTableHeaderStyle($sheet, 'A4:D4');
        $this->applyDataRowStyle($sheet, 'B5:B'.$row, '#,##0.00');
        $this->applyDataRowStyle($sheet, 'C5:C'.$row, '#,##0');
        $this->applyDataRowStyle($sheet, 'D5:D'.$row, '0.00%');
        $this->autoSizeColumns($sheet, ['A' => 24, 'B' => 18, 'C' => 12, 'D' => 14]);
        $sheet->freezePane('A5');
    }

    /** @param ExecutiveReport $report */
    private function buildDailyTrendSheet(Spreadsheet $spreadsheet, array $report, string $hospital, string $rtn): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Facturado diario');

        $daily = $this->rows($report['daily_trend'] ?? null);
        $row = $this->writeSheetHeader($sheet, 'Tendencia Diaria', [
            'Fecha', 'Facturado (L.)', 'Cobrado (L.)', 'Pendiente (L.)', 'Anuladas', 'Facturas',
        ]);

        foreach ($daily as $day) {
            $sheet->setCellValue("A{$row}", $this->safeText($day['date'] ?? ''));
            $sheet->setCellValue("B{$row}", $this->moneyFloat($day['billed'] ?? '0.00'));
            $sheet->setCellValue("C{$row}", $this->moneyFloat($day['collected'] ?? '0.00'));
            $sheet->setCellValue("D{$row}", $this->moneyFloat($day['pending'] ?? '0.00'));
            $sheet->setCellValue("E{$row}", $this->safeCount($day['voided_count'] ?? 0));
            $sheet->setCellValue("F{$row}", $this->safeCount($day['invoice_count'] ?? 0));
            $row++;
        }

        $this->applyTableHeaderStyle($sheet, 'A4:F4');
        $this->applyDataRowStyle($sheet, 'B5:B'.$row, '#,##0.00');
        $this->applyDataRowStyle($sheet, 'C5:C'.$row, '#,##0.00');
        $this->applyDataRowStyle($sheet, 'D5:D'.$row, '#,##0.00');
        $this->applyDataRowStyle($sheet, 'E5:E'.$row, '#,##0');
        $this->applyDataRowStyle($sheet, 'F5:F'.$row, '#,##0');
        $this->autoSizeColumns($sheet, ['A' => 14, 'B' => 16, 'C' => 16, 'D' => 16, 'E' => 12, 'F' => 12]);
        $sheet->freezePane('A5');
    }

    /** @param ExecutiveReport $report */
    private function buildServicesSheet(Spreadsheet $spreadsheet, array $report, string $hospital, string $rtn): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Servicios');

        $row = $this->writeSheetHeader($sheet, 'Servicios facturados', [
            'Top por monto', '', '', '',
        ]);
        $row++;

        $sheet->fromArray(
            ['Servicio', 'Categoria', 'Cantidad', 'Facturado (L.)', 'Cobrado (L.)'],
            null,
            "A{$row}"
        );
        $this->applyTableHeaderStyle($sheet, "A{$row}:E{$row}");
        $row++;

        $services = $this->section($report['services'] ?? null);

        foreach ($this->rows($services['top_by_amount'] ?? null) as $service) {
            $sheet->setCellValue("A{$row}", $this->safeText($service['service'] ?? ''));
            $sheet->setCellValue("B{$row}", $this->safeText($service['category'] ?? ''));
            $sheet->setCellValue("C{$row}", $this->quantityValue($service['quantity'] ?? '0'));
            $sheet->setCellValue("D{$row}", $this->moneyFloat($service['total'] ?? '0.00'));
            $sheet->setCellValue("E{$row}", $this->moneyFloat($service['collected'] ?? '0.00'));
            $row++;
        }

        $row++;
        $sheet->setCellValue("A{$row}", 'Top por cantidad');
        $sheet->mergeCells("A{$row}:E{$row}");
        $this->applySubtitleStyle($sheet, "A{$row}:E{$row}");
        $row++;

        $sheet->fromArray(
            ['Servicio', 'Categoria', 'Cantidad', 'Facturado (L.)'],
            null,
            "A{$row}"
        );
        $this->applyTableHeaderStyle($sheet, "A{$row}:D{$row}");
        $row++;

        foreach ($this->rows($services['top_by_quantity'] ?? null) as $service) {
            $sheet->setCellValue("A{$row}", $this->safeText($service['service'] ?? ''));
            $sheet->setCellValue("B{$row}", $this->safeText($service['category'] ?? ''));
            $sheet->setCellValue("C{$row}", $this->quantityValue($service['quantity'] ?? '0'));
            $sheet->setCellValue("D{$row}", $this->moneyFloat($service['total'] ?? '0.00'));
            $row++;
        }

        $row++;
        $sheet->setCellValue("A{$row}", 'Por categoria');
        $sheet->mergeCells("A{$row}:E{$row}");
        $this->applySubtitleStyle($sheet, "A{$row}:E{$row}");
        $row++;

        $sheet->fromArray(
            ['Categoria', 'Cantidad', 'Facturado (L.)', 'Cobrado (L.)', 'Items'],
            null,
            "A{$row}"
        );
        $this->applyTableHeaderStyle($sheet, "A{$row}:E{$row}");
        $row++;

        foreach ($this->rows($services['by_category'] ?? null) as $cat) {
            $sheet->setCellValue("A{$row}", $this->safeText($cat['category'] ?? ''));
            $sheet->setCellValue("B{$row}", $this->quantityValue($cat['quantity'] ?? '0'));
            $sheet->setCellValue("C{$row}", $this->moneyFloat($cat['total'] ?? '0.00'));
            $sheet->setCellValue("D{$row}", $this->moneyFloat($cat['collected'] ?? '0.00'));
            $sheet->setCellValue("E{$row}", $this->safeCount($cat['item_count'] ?? 0));
            $row++;
        }

        $row++;
        $sheet->setCellValue("A{$row}", 'Por area');
        $sheet->mergeCells("A{$row}:E{$row}");
        $this->applySubtitleStyle($sheet, "A{$row}:E{$row}");
        $row++;

        $sheet->fromArray(
            ['Area', 'Cantidad', 'Facturado (L.)', 'Items'],
            null,
            "A{$row}"
        );
        $this->applyTableHeaderStyle($sheet, "A{$row}:D{$row}");
        $row++;

        foreach ($this->rows($services['by_area'] ?? null) as $area) {
            $sheet->setCellValue("A{$row}", $this->safeText($area['area'] ?? ''));
            $sheet->setCellValue("B{$row}", $this->quantityValue($area['quantity'] ?? '0'));
            $sheet->setCellValue("C{$row}", $this->moneyFloat($area['total'] ?? '0.00'));
            $sheet->setCellValue("D{$row}", $this->safeCount($area['item_count'] ?? 0));
            $row++;
        }

        $this->autoSizeColumns($sheet, ['A' => 40, 'B' => 24, 'C' => 14, 'D' => 16, 'E' => 16]);
    }

    /** @param ExecutiveReport $report */
    private function buildCashiersSheet(Spreadsheet $spreadsheet, array $report, string $hospital, string $rtn): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Cajeros');

        $row = $this->writeSheetHeader($sheet, 'Cajeros', [
            'Cajero', 'Cobrado (L.)', 'Efectivo (L.)', 'Transferencia (L.)', 'Tarjeta (L.)', 'Otro (L.)', 'Pagos', 'Anuladas', 'Diferencia (L.)',
        ]);

        foreach ($this->rows($report['cashiers'] ?? null) as $cashier) {
            $sheet->setCellValue("A{$row}", $this->safeText($cashier['name'] ?? ''));
            $sheet->setCellValue("B{$row}", $this->moneyFloat($cashier['collected'] ?? '0.00'));
            $sheet->setCellValue("C{$row}", $this->moneyFloat($cashier['cash'] ?? '0.00'));
            $sheet->setCellValue("D{$row}", $this->moneyFloat($cashier['transfer'] ?? '0.00'));
            $sheet->setCellValue("E{$row}", $this->moneyFloat($cashier['card'] ?? '0.00'));
            $sheet->setCellValue("F{$row}", $this->moneyFloat($cashier['other'] ?? '0.00'));
            $sheet->setCellValue("G{$row}", $this->safeCount($cashier['payment_count'] ?? 0));
            $sheet->setCellValue("H{$row}", $this->safeCount($cashier['voided_count'] ?? 0));
            $sheet->setCellValue("I{$row}", $this->moneyFloat($cashier['difference_total'] ?? '0.00'));
            $row++;
        }

        $this->applyTableHeaderStyle($sheet, 'A4:I4');
        $this->applyDataRowStyle($sheet, 'B5:B'.$row, '#,##0.00');
        $this->applyDataRowStyle($sheet, 'C5:C'.$row, '#,##0.00');
        $this->applyDataRowStyle($sheet, 'D5:D'.$row, '#,##0.00');
        $this->applyDataRowStyle($sheet, 'E5:E'.$row, '#,##0.00');
        $this->applyDataRowStyle($sheet, 'F5:F'.$row, '#,##0.00');
        $this->applyDataRowStyle($sheet, 'I5:I'.$row, '#,##0.00');
        $this->applyDataRowStyle($sheet, 'G5:G'.$row, '#,##0');
        $this->applyDataRowStyle($sheet, 'H5:H'.$row, '#,##0');
        $this->autoSizeColumns($sheet, ['A' => 28, 'B' => 16, 'C' => 16, 'D' => 16, 'E' => 16, 'F' => 16, 'G' => 10, 'H' => 10, 'I' => 16]);
        $sheet->freezePane('A5');
    }

    /** @param ExecutiveReport $report */
    private function buildCashSessionsSheet(Spreadsheet $spreadsheet, array $report, string $hospital, string $rtn): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Caja');

        $row = $this->writeSheetHeader($sheet, 'Sesiones de Caja', [
            'Cajero', 'Apertura', 'Cierre', 'Inicial (L.)', 'Esperado (L.)', 'Contado (L.)', 'Diferencia (L.)', 'Estado', 'Nota',
        ]);

        foreach ($this->rows($report['cash_sessions'] ?? null) as $session) {
            $sheet->setCellValue("A{$row}", $this->safeText($session['cashier'] ?? ''));
            $sheet->setCellValue("B{$row}", $this->safeText($session['opened_at'] ?? ''));
            $sheet->setCellValue("C{$row}", $this->safeText($session['closed_at'] ?? ''));
            $sheet->setCellValue("D{$row}", $this->moneyFloat($session['opening_amount'] ?? '0.00'));
            $sheet->setCellValue("E{$row}", $this->moneyFloat($session['expected_cash'] ?? '0.00'));
            $sheet->setCellValue("F{$row}", ($session['counted_cash'] ?? null) !== null ? $this->moneyFloat($session['counted_cash']) : null);
            $sheet->setCellValue("G{$row}", ($session['difference'] ?? null) !== null ? $this->moneyFloat($session['difference']) : null);
            $sheet->setCellValue("H{$row}", $this->safeText($session['status'] ?? ''));
            $sheet->setCellValue("I{$row}", $this->safeText($session['closure_note'] ?? ''));
            $row++;
        }

        $this->applyTableHeaderStyle($sheet, 'A4:I4');
        $this->applyDataRowStyle($sheet, 'D5:D'.$row, '#,##0.00');
        $this->applyDataRowStyle($sheet, 'E5:E'.$row, '#,##0.00');
        $this->applyDataRowStyle($sheet, 'F5:F'.$row, '#,##0.00');
        $this->applyDataRowStyle($sheet, 'G5:G'.$row, '#,##0.00');
        $this->autoSizeColumns($sheet, ['A' => 24, 'B' => 22, 'C' => 22, 'D' => 14, 'E' => 14, 'F' => 14, 'G' => 14, 'H' => 12, 'I' => 36]);
        $sheet->freezePane('A5');
    }

    /** @param ExecutiveReport $report */
    private function buildPendingSheet(Spreadsheet $spreadsheet, array $report, string $hospital, string $rtn): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Pendientes');

        $pending = $this->section($report['pending_aging'] ?? null);
        $recent = $this->section($pending['0_7_days'] ?? null);
        $midAge = $this->section($pending['8_30_days'] ?? null);
        $old = $this->section($pending['31_plus_days'] ?? null);
        $pendingItems = $this->rows($pending['items'] ?? null);
        $row = $this->writeSheetHeader($sheet, 'Pendientes y Antiguedad', [
            'Antiguedad', 'Cantidad', 'Saldo pendiente (L.)',
        ]);

        $sheet->setCellValue("A{$row}", '0 a 7 dias');
        $sheet->setCellValue("B{$row}", $this->safeCount($recent['count'] ?? 0));
        $sheet->setCellValue("C{$row}", $this->moneyFloat($recent['amount'] ?? '0.00'));
        $row++;

        $sheet->setCellValue("A{$row}", '8 a 30 dias');
        $sheet->setCellValue("B{$row}", $this->safeCount($midAge['count'] ?? 0));
        $sheet->setCellValue("C{$row}", $this->moneyFloat($midAge['amount'] ?? '0.00'));
        $row++;

        $sheet->setCellValue("A{$row}", '31 o mas dias');
        $sheet->setCellValue("B{$row}", $this->safeCount($old['count'] ?? 0));
        $sheet->setCellValue("C{$row}", $this->moneyFloat($old['amount'] ?? '0.00'));
        $row++;

        $row++;
        $sheet->setCellValue("A{$row}", 'Detalle de pendientes');
        $sheet->mergeCells("A{$row}:F{$row}");
        $this->applySubtitleStyle($sheet, "A{$row}:F{$row}");
        $row++;

        $sheet->fromArray(
            ['# Factura', 'Paciente', 'Emitida', 'Antiguedad (dias)', 'Total (L.)', 'Saldo (L.)'],
            null,
            "A{$row}"
        );
        $this->applyTableHeaderStyle($sheet, "A{$row}:F{$row}");
        $row++;

        foreach ($pendingItems as $item) {
            $sheet->setCellValue("A{$row}", $this->safeText($item['invoice_number'] ?? ''));
            $sheet->setCellValue("B{$row}", $this->safeText($item['patient'] ?? ''));
            $sheet->setCellValue("C{$row}", $this->safeText($item['issued_at'] ?? ''));
            $sheet->setCellValue("D{$row}", $this->safeCount($item['age_days'] ?? 0));
            $sheet->setCellValue("E{$row}", $this->moneyFloat($item['total'] ?? '0.00'));
            $sheet->setCellValue("F{$row}", $this->moneyFloat($item['balance_due'] ?? '0.00'));
            $row++;
        }

        $this->applyDataRowStyle($sheet, 'E'.($row - count($pendingItems)).':E'.$row, '#,##0.00');
        $this->applyDataRowStyle($sheet, 'F'.($row - count($pendingItems)).':F'.$row, '#,##0.00');
        $this->autoSizeColumns($sheet, ['A' => 18, 'B' => 28, 'C' => 16, 'D' => 14, 'E' => 14, 'F' => 14]);
    }

    /** @param ExecutiveReport $report */
    private function buildVoidsSheet(Spreadsheet $spreadsheet, array $report, string $hospital, string $rtn): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Anulaciones y reversas');

        $row = $this->writeSheetHeader($sheet, 'Anulaciones y Reversas', [
            'Tipo', '# Factura', 'Paciente', 'Monto (L.)', 'Usuario', 'Autorizado por', 'Motivo', 'Fecha',
        ]);

        foreach ($this->rows($report['voids_and_reversals'] ?? null) as $rowData) {
            $kind = ($rowData['kind'] ?? '') === 'reversal' ? 'Reversa' : 'Anulacion';
            $sheet->setCellValue("A{$row}", $this->safeText($kind));
            $sheet->setCellValue("B{$row}", $this->safeText($rowData['invoice_number'] ?? ''));
            $sheet->setCellValue("C{$row}", $this->safeText($rowData['patient'] ?? ''));
            $sheet->setCellValue("D{$row}", $this->moneyFloat($rowData['amount'] ?? '0.00'));
            $sheet->setCellValue("E{$row}", $this->safeText($rowData['user'] ?? ''));
            $sheet->setCellValue("F{$row}", $this->safeText($rowData['authorized_by'] ?? ''));
            $sheet->setCellValue("G{$row}", $this->safeText($rowData['reason'] ?? ''));
            $sheet->setCellValue("H{$row}", $this->safeText($rowData['created_at'] ?? ''));
            $row++;
        }

        $this->applyTableHeaderStyle($sheet, 'A4:H4');
        $this->applyDataRowStyle($sheet, 'D5:D'.$row, '#,##0.00');
        $this->autoSizeColumns($sheet, ['A' => 14, 'B' => 18, 'C' => 24, 'D' => 14, 'E' => 22, 'F' => 22, 'G' => 36, 'H' => 22]);
        $sheet->freezePane('A5');
    }

    /** @param ExecutiveReport $report */
    private function buildAuditSheet(Spreadsheet $spreadsheet, array $report, string $hospital, string $rtn): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Auditoria');

        $row = $this->writeSheetHeader($sheet, 'Auditoria', [
            'Indicador', 'Cantidad',
        ]);

        $audit = $this->section($report['audit_summary'] ?? null);

        $rows = [
            ['Eventos criticos', $this->safeCount($audit['critical_events'] ?? 0)],
            ['Reimpresiones', $this->safeCount($audit['reprints'] ?? 0)],
            ['Cambios fiscales', $this->safeCount($audit['fiscal_changes'] ?? 0)],
            ['Diferencias de caja', $this->safeCount($audit['cash_differences'] ?? 0)],
            ['Eventos de respaldo', $this->safeCount($audit['backup_events'] ?? 0)],
        ];

        foreach ($rows as $r) {
            $sheet->setCellValue("A{$row}", $this->safeText($r[0]));
            $sheet->setCellValue("B{$row}", $r[1]);
            $row++;
        }

        $this->applyTableHeaderStyle($sheet, 'A4:B4');
        $this->applyDataRowStyle($sheet, 'B5:B'.$row, '#,##0');
        $this->autoSizeColumns($sheet, ['A' => 28, 'B' => 12]);
    }

    private function buildGlossarySheet(Spreadsheet $spreadsheet, string $hospital, string $rtn): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Glosario');

        $row = $this->writeSheetHeader($sheet, 'Glosario de metricas', [
            'Termino', 'Definicion',
        ]);

        $definitions = [
            ['Facturado', 'Total de facturas emitidas en el periodo, excluyendo anuladas.'],
            ['Cobrado', 'Total de pagos registrados y no anulados, en facturas no anuladas.'],
            ['Pendiente', 'Saldo abierto de facturas emitidas o parciales.'],
            ['Anulado', 'Dato de control. Ya esta excluido de Facturado; no se resta otra vez.'],
            ['Reversado', 'Dato de control. Ya esta excluido de Cobrado; no se resta otra vez.'],
            ['Efectivo esperado', 'Efectivo inicial + pagos en efectivo del turno.'],
            ['Efectivo contado', 'Efectivo fisico reportado por el cajero al cierre.'],
            ['Diferencia de caja', 'Contado menos esperado. Positivo = sobrante. Negativo = faltante.'],
            ['Ticket promedio', 'Total facturado / numero de facturas.'],
            ['Factura parcial', 'Factura con pagos parciales que mantiene saldo pendiente.'],
            ['Reimpresion', 'Nueva emision de un comprobante ya emitido. Se audita con motivo.'],
            ['Cobrado neto operativo', 'Pagos posteados no reversados en facturas no anuladas. Anulaciones y reversos ya estan excluidos.'],
        ];

        foreach ($definitions as $definition) {
            $sheet->setCellValue("A{$row}", $this->safeText($definition[0]));
            $sheet->setCellValue("B{$row}", $this->safeText($definition[1]));
            $row++;
        }

        $this->applyTableHeaderStyle($sheet, 'A4:B4');
        $this->autoSizeColumns($sheet, ['A' => 28, 'B' => 80]);
        $sheet->getStyle('B5:B'.$row)->getAlignment()->setWrapText(true);
    }

    /** @param list<string> $headers */
    private function writeSheetHeader(
        Worksheet $sheet,
        string $title,
        array $headers,
    ): int {
        $sheet->setCellValue('A1', $this->safeText($title));
        $sheet->mergeCells('A1:'.chr(ord('A') + count($headers) - 1).'1');
        $this->applyTitleStyle($sheet, 'A1:'.chr(ord('A') + count($headers) - 1).'1');

        $row = 3;
        $col = 'A';
        foreach ($headers as $header) {
            $sheet->setCellValue("{$col}{$row}", $this->safeText($header));
            $col++;
        }
        $col = chr(ord($col) - 1);
        $this->applyTableHeaderStyle($sheet, "A{$row}:{$col}{$row}");

        return $row + 1;
    }

    private function applyTitleStyle(Worksheet $sheet, string $range): void
    {
        $sheet->getStyle($range)->applyFromArray([
            'font' => [
                'bold' => true,
                'size' => 16,
                'color' => ['rgb' => '0F172A'],
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_LEFT,
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
        ]);
    }

    private function applySubtitleStyle(Worksheet $sheet, string $range): void
    {
        $sheet->getStyle($range)->applyFromArray([
            'font' => [
                'bold' => true,
                'size' => 11,
                'color' => ['rgb' => '0F766E'],
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_LEFT,
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
        ]);
    }

    private function applyTableHeaderStyle(Worksheet $sheet, string $range): void
    {
        $sheet->getStyle($range)->applyFromArray([
            'font' => [
                'bold' => true,
                'color' => ['rgb' => 'FFFFFF'],
                'size' => 10,
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => '0F172A'],
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_LEFT,
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => 'CBD5E1'],
                ],
            ],
        ]);
    }

    private function applyBoldRow(Worksheet $sheet, string $range): void
    {
        $sheet->getStyle($range)->applyFromArray([
            'font' => [
                'bold' => true,
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => 'F1F5F9'],
            ],
        ]);
    }

    private function applyDataRowStyle(Worksheet $sheet, string $range, string $numberFormat): void
    {
        $sheet->getStyle($range)->applyFromArray([
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => 'E2E8F0'],
                ],
            ],
            'numberFormat' => [
                'formatCode' => $numberFormat,
            ],
        ]);
    }

    /** @param array<string, int|float> $columns */
    private function autoSizeColumns(Worksheet $sheet, array $columns): void
    {
        foreach ($columns as $letter => $width) {
            $sheet->getColumnDimension($letter)->setWidth($width);
        }
    }

    private function safeText(mixed $value): string
    {
        $safe = ExcelSafe::value($this->plainText($value) ?? '');

        return is_string($safe) ? $safe : '';
    }

    private function moneyFloat(mixed $value): float
    {
        return $this->moneyToCents($value) / 100;
    }

    private function moneyToCents(mixed $value): int
    {
        try {
            return Money::parseCents($this->plainText($value) ?? '0', 'amount');
        } catch (ValidationException) {
            return 0;
        }
    }

    private function quantityValue(mixed $value): float
    {
        $string = $this->plainText($value) ?? '0';

        if (is_numeric($string)) {
            $numeric = $string + 0;

            return is_finite($numeric) ? $numeric + 0.0 : 0.0;
        }

        try {
            return Money::parseCents($string, 'quantity') / 100;
        } catch (ValidationException) {
            return 0.0;
        }
    }

    private function percentageValue(mixed $value): float
    {
        return $this->percentageFloat($value) / 100;
    }

    private function percentageFloat(mixed $value): float
    {
        $string = $this->plainText($value) ?? '0';

        if (is_numeric($string)) {
            $numeric = $string + 0;

            return is_finite($numeric) ? $numeric + 0.0 : 0.0;
        }

        return 0.0;
    }

    private function safeCount(mixed $value): int
    {
        if (is_int($value)) {
            return max(0, $value);
        }

        if (is_float($value)) {
            return is_finite($value) ? max(0, (int) $value) : 0;
        }

        $string = trim($this->plainText($value) ?? '0');

        if ($string === '' || ! is_numeric($string)) {
            return 0;
        }

        $numeric = $string + 0;

        return is_finite($numeric) ? max(0, (int) $numeric) : 0;
    }

    private function pctLabel(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $percentage = $this->percentageFloat($value);
        $sign = $percentage > 0 ? '+' : '';

        return $sign.number_format($percentage, 2).'%';
    }

    /** @return array<string, mixed> */
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

    /** @return list<array<string, mixed>> */
    private function rows(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        $rows = [];
        foreach ($value as $item) {
            if (is_array($item)) {
                $rows[] = $this->section($item);
            }
        }

        return $rows;
    }

    private function plainText(mixed $value): ?string
    {
        return is_string($value) || is_int($value) || is_float($value) || is_bool($value)
            ? (string) $value
            : null;
    }
}
