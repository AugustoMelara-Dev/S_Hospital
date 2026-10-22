<?php

namespace App\Actions\Reports;

use App\Support\ExcelSafe;
use App\Support\HospitalName;
use App\Support\Money;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\PageSetup;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Builds the institutional XLSX workbook from the executive report payload.
 *
 * Hojas obligatorias (MANDATO_DEV §14): Resumen, Operaciones, Detalle, Cobros,
 * Caja. La gratuidad se identifica en Resumen y Detalle. No se agregan hojas de
 * relleno.
 *
 * Reglas de tipo:
 *  - importes/cantidades -> numerico con formato;
 *  - conteos -> entero;
 *  - variaciones porcentuales -> fraccion 0..1 con formato de porcentaje;
 *  - fechas -> serial Excel con formato local;
 *  - numeros de factura y texto que empieza con `= + - @` -> texto explicito.
 *
 * @phpstan-type ExecutiveReport array<string, mixed>
 */
class ExecutiveExcelExportService
{
    private const COUNT_FORMAT = '#,##0';

    private const MONEY_FORMAT = '#,##0.00';

    private const SUMMARY_MONEY_FORMAT = '"L." #,##0.00';

    private const SIGNED_PERCENT_FORMAT = '+0.00%;-0.00%;0.00%';

    private const TEXT_FORMAT = '@';

    private const DATE_FORMAT = 'dd/mm/yyyy';

    private const DATETIME_FORMAT = 'dd/mm/yyyy hh:mm';

    private const HEADER_ROW = 3;

    private const HOSPITAL_TIMEZONE = 'America/Tegucigalpa';

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
        $this->buildOperationsSheet($spreadsheet, $report, $hospitalName, $rtn);
        $this->buildDetailSheet($spreadsheet, $report, $hospitalName, $rtn);
        $this->buildCollectionsSheet($spreadsheet, $report, $hospitalName, $rtn);
        $this->buildCashSheet($spreadsheet, $report, $hospitalName, $rtn);

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

        $summary = $this->section($report['summary'] ?? null);
        $comparison = $this->section($report['comparison'] ?? null);
        $billedComparison = $this->section($comparison['billed'] ?? null);
        $collectedComparison = $this->section($comparison['collected'] ?? null);
        $period = $this->section($report['period'] ?? null);
        $filters = $this->section($report['filters'] ?? null);

        $row = 1;
        $sheet->setCellValue("A{$row}", ExcelSafe::value('Reporte institucional'));
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
        $sheet->setCellValue("A{$row}", ExcelSafe::value('Filtros: '.$this->filterSummary($filters)));
        $sheet->mergeCells("A{$row}:C{$row}");
        $row++;
        $sheet->setCellValue("A{$row}", ExcelSafe::value('Generado: '.($generatedBy ?? 'Sistema').' - '.
            Carbon::now(self::HOSPITAL_TIMEZONE)->format('Y-m-d H:i')));
        $sheet->mergeCells("A{$row}:C{$row}");
        $row++;
        $sheet->setCellValue("A{$row}", ExcelSafe::value('Zona horaria: '.($this->plainText($period['timezone'] ?? null) ?: self::HOSPITAL_TIMEZONE)));
        $sheet->mergeCells("A{$row}:C{$row}");
        $row += 2;

        $this->applyTableHeaderStyle($sheet, "A{$row}:C{$row}");
        $sheet->setCellValue("A{$row}", $this->safeText('Indicador'));
        $sheet->setCellValue("B{$row}", $this->safeText('Valor'));
        $sheet->setCellValue("C{$row}", $this->safeText('Variacion vs periodo anterior'));
        $row++;

        $metrics = [
            ['Total facturado (emision)', $this->moneyFloat($summary['billed_total'] ?? '0.00'), 'money', $this->percentageFraction($billedComparison['delta_percentage'] ?? null)],
            ['Total cobrado (fecha de pago)', $this->moneyFloat($summary['collected_total'] ?? '0.00'), 'money', $this->percentageFraction($collectedComparison['delta_percentage'] ?? null)],
            ['Saldo al corte', $this->moneyFloat($summary['pending_total'] ?? '0.00'), 'money', null],
            ['Anulado', $this->moneyFloat($summary['voided_total'] ?? '0.00'), 'money', null],
            ['Reversado', $this->moneyFloat($summary['reversed_total'] ?? '0.00'), 'money', null],
            ['Facturas emitidas', $this->safeCount($summary['invoice_count'] ?? 0), 'count', null],
            ['Pagos contabilizados', $this->safeCount($summary['receipt_count'] ?? 0), 'count', null],
            ['Pagadas', $this->safeCount($summary['paid_count'] ?? 0), 'count', null],
            ['Parciales', $this->safeCount($summary['partial_count'] ?? 0), 'count', null],
            ['Pendientes', $this->safeCount($summary['pending_count'] ?? 0), 'count', null],
            ['Anuladas', $this->safeCount($summary['voided_count'] ?? 0), 'count', null],
            ['Operaciones sin cobro', $this->safeCount($summary['without_charge_count'] ?? 0), 'count', null],
            ['Ticket promedio', $this->moneyFloat($summary['average_ticket'] ?? '0.00'), 'money', null],
        ];

        $firstDataRow = $row;
        foreach ($metrics as $metric) {
            $kind = $metric[2];
            $delta = $metric[3];
            $sheet->setCellValue("A{$row}", $this->safeText($metric[0]));
            $sheet->setCellValue("B{$row}", $metric[1]);
            $sheet->setCellValue("C{$row}", $delta ?? '');
            $this->applyDataRowStyle($sheet, "A{$row}", self::TEXT_FORMAT);
            $this->applyDataRowStyle($sheet, "B{$row}", $kind === 'count' ? self::COUNT_FORMAT : self::SUMMARY_MONEY_FORMAT);
            $this->applyDataRowStyle($sheet, "C{$row}", $delta === null ? self::TEXT_FORMAT : self::SIGNED_PERCENT_FORMAT);
            $row++;
        }

        $row++;
        $sheet->setCellValue("A{$row}", $this->safeText('Gratuidad y emision sin cobro'));
        $sheet->mergeCells("A{$row}:C{$row}");
        $this->applySubtitleStyle($sheet, "A{$row}:C{$row}");
        $row++;
        $this->applyTableHeaderStyle($sheet, "A{$row}:C{$row}");
        $sheet->setCellValue("A{$row}", $this->safeText('Indicador'));
        $sheet->setCellValue("B{$row}", $this->safeText('Valor'));
        $sheet->setCellValue("C{$row}", $this->safeText('Nota'));
        $row++;

        $gratuityAdjustmentPersisted = ($summary['gratuity_adjustment_persisted'] ?? false) === true;
        $gratuityRows = [
            ['Lineas gratuitas (unidades entregadas)', $this->safeCount($summary['gratuity_item_count'] ?? 0), 'count', 'Solo el medicamento elegible por regla; no son unidades cobradas.', true],
            ['Valor del ajuste registrado', $gratuityAdjustmentPersisted ? $this->moneyFloat($summary['gratuity_adjustment_total'] ?? '0.00') : 'No registrado', 'money', $gratuityAdjustmentPersisted ? 'Calculado desde el ajuste por linea.' : 'Historico sin ajuste por linea: no se inventa 0.00.', $gratuityAdjustmentPersisted],
        ];

        foreach ($gratuityRows as $metric) {
            $kind = $metric[2];
            $numeric = $metric[4];
            $sheet->setCellValue("A{$row}", $this->safeText($metric[0]));
            if ($numeric) {
                $sheet->setCellValue("B{$row}", $metric[1]);
                $this->applyDataRowStyle($sheet, "B{$row}", $kind === 'count' ? self::COUNT_FORMAT : self::SUMMARY_MONEY_FORMAT);
            } else {
                $this->setTextCell($sheet, "B{$row}", $metric[1]);
            }
            $sheet->setCellValue("C{$row}", $this->safeText($metric[3]));
            $this->applyDataRowStyle($sheet, "A{$row}", self::TEXT_FORMAT);
            $this->applyDataRowStyle($sheet, "C{$row}", self::TEXT_FORMAT);
            $row++;
        }

        foreach (['A' => 44, 'B' => 22, 'C' => 52] as $letter => $width) {
            $sheet->getColumnDimension($letter)->setWidth($width);
        }

        $sheet->getRowDimension(1)->setRowHeight(24);
        $sheet->getRowDimension(self::HEADER_ROW)->setRowHeight(18);
        $sheet->freezePane('A'.$firstDataRow);
        $this->configurePrintSetup($sheet, 'C', $row - 1, PageSetup::ORIENTATION_PORTRAIT);
    }

    /** @param ExecutiveReport $report */
    private function buildOperationsSheet(Spreadsheet $spreadsheet, array $report, string $hospital, string $rtn): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Operaciones');

        $headers = ['Fecha', 'N Factura', 'Paciente', 'Caja/Sesion', 'Cajero', 'Total (L.)', 'Pagado (L.)', 'Saldo (L.)', 'Estado', 'Liquidacion', 'Documento'];
        $row = $this->writeSheetHeader($sheet, 'Operaciones emitidas', $headers, 'K');

        $total = 0.0;
        $paid = 0.0;
        $balance = 0.0;
        $firstDataRow = $row;
        foreach ($this->rows($report['operations'] ?? null) as $operation) {
            $sheet->setCellValue("A{$row}", $this->localDateTime($operation['date'] ?? null, dateOnly: true));
            $this->setTextCell($sheet, "B{$row}", $operation['invoice_number'] ?? '');
            $this->setTextCell($sheet, "C{$row}", $operation['patient'] ?? '');
            $this->setTextCell($sheet, "D{$row}", $operation['cash_session_label'] ?? '');
            $this->setTextCell($sheet, "E{$row}", $operation['cashier'] ?? '');
            $sheet->setCellValue("F{$row}", $this->moneyFloat($operation['total'] ?? '0.00'));
            $sheet->setCellValue("G{$row}", $this->moneyFloat($operation['paid'] ?? '0.00'));
            $sheet->setCellValue("H{$row}", $this->moneyFloat($operation['balance'] ?? '0.00'));
            $this->setTextCell($sheet, "I{$row}", $operation['status_label'] ?? '');
            $this->setTextCell($sheet, "J{$row}", $operation['settlement_label'] ?? '');
            $this->setTextCell($sheet, "K{$row}", $operation['receipt_document'] ?? '');

            $total += $this->moneyFloat($operation['total'] ?? '0.00');
            $paid += $this->moneyFloat($operation['paid'] ?? '0.00');
            $balance += $this->moneyFloat($operation['balance'] ?? '0.00');
            $row++;
        }

        if ($this->rows($report['operations'] ?? null) !== []) {
            $sheet->setCellValue("E{$row}", $this->safeText('Total'));
            $sheet->setCellValue("F{$row}", $total);
            $sheet->setCellValue("G{$row}", $paid);
            $sheet->setCellValue("H{$row}", $balance);
            $this->applyBoldRow($sheet, "A{$row}:K{$row}");
            $row++;
        }

        $this->applyDataRangeStyle($sheet, 'A', 'A', $firstDataRow, $row - 1, self::DATE_FORMAT);
        $this->applyDataRangeStyle($sheet, 'F', 'H', $firstDataRow, $row - 1, self::MONEY_FORMAT);
        $this->autoFilter($sheet, 'K', $row - 1);
        $this->autoSizeColumns($sheet, ['A' => 12, 'B' => 22, 'C' => 28, 'D' => 22, 'E' => 22, 'F' => 14, 'G' => 14, 'H' => 14, 'I' => 24, 'J' => 20, 'K' => 24]);
        $this->applyWrappedTextRows($sheet, ['B', 'C', 'D', 'E', 'I', 'J', 'K'], $firstDataRow, $row - 2);
        $this->configurePrintSetup($sheet, 'K', $row - 1);
    }

    /** @param ExecutiveReport $report */
    private function buildDetailSheet(Spreadsheet $spreadsheet, array $report, string $hospital, string $rtn): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Detalle');

        $headers = ['Fecha', 'N Factura', 'Paciente', 'Servicio', 'Categoria', 'Area', 'Cantidad', 'Precio registrado (L.)', 'Ajuste por regla (L.)', 'Impuesto (L.)', 'Importe final (L.)', 'Gratuidad'];
        $row = $this->writeSheetHeader($sheet, 'Detalle por linea', $headers, 'L');

        $firstDataRow = $row;
        foreach ($this->rows($report['detail'] ?? null) as $line) {
            $sheet->setCellValue("A{$row}", $this->localDateTime($line['date'] ?? null, dateOnly: true));
            $this->setTextCell($sheet, "B{$row}", $line['invoice_number'] ?? '');
            $this->setTextCell($sheet, "C{$row}", $line['patient'] ?? '');
            $this->setTextCell($sheet, "D{$row}", $line['service'] ?? '');
            $this->setTextCell($sheet, "E{$row}", $line['category'] ?? '');
            $this->setTextCell($sheet, "F{$row}", $line['area'] ?? '');
            $sheet->setCellValue("G{$row}", $this->quantityValue($line['quantity'] ?? '0'));
            $sheet->setCellValue("H{$row}", $this->moneyFloat($line['unit_price'] ?? '0.00'));
            // Un historico sin ajuste persistido no se escribe como 0.00 numerico:
            // cero afirmaria un ajuste medido que nunca se registro.
            if (($line['rule_adjustment_persisted'] ?? true) === false) {
                $this->setTextCell($sheet, "I{$row}", 'No registrado');
            } else {
                $sheet->setCellValue("I{$row}", $this->moneyFloat($line['rule_adjustment'] ?? '0.00'));
                $this->applyDataRowStyle($sheet, "I{$row}", self::MONEY_FORMAT);
            }
            $sheet->setCellValue("J{$row}", $this->moneyFloat($line['tax'] ?? '0.00'));
            $sheet->setCellValue("K{$row}", $this->moneyFloat($line['line_total'] ?? '0.00'));
            $this->setTextCell($sheet, "L{$row}", ($line['is_free'] ?? false) === true ? ($line['rule_label'] ?? 'Gratuidad') : 'No');
            $row++;
        }

        $this->applyDataRangeStyle($sheet, 'A', 'A', $firstDataRow, $row - 1, self::DATE_FORMAT);
        $this->applyDataRangeStyle($sheet, 'G', 'H', $firstDataRow, $row - 1, self::MONEY_FORMAT);
        $this->applyDataRangeStyle($sheet, 'J', 'K', $firstDataRow, $row - 1, self::MONEY_FORMAT);
        $this->autoFilter($sheet, 'L', $row - 1);
        $this->autoSizeColumns($sheet, ['A' => 12, 'B' => 22, 'C' => 28, 'D' => 34, 'E' => 20, 'F' => 18, 'G' => 12, 'H' => 18, 'I' => 18, 'J' => 14, 'K' => 16, 'L' => 28]);
        $this->applyWrappedTextRows($sheet, ['B', 'C', 'D', 'E', 'F', 'I', 'L'], $firstDataRow, $row - 1);
        $this->configurePrintSetup($sheet, 'L', $row - 1);
    }

    /** @param ExecutiveReport $report */
    private function buildCollectionsSheet(Spreadsheet $spreadsheet, array $report, string $hospital, string $rtn): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Cobros');

        $headers = ['Fecha de pago', 'N Factura', 'Paciente', 'Caja/Sesion', 'Cajero', 'Metodo', 'Referencia', 'Importe (L.)', 'Estado'];
        $row = $this->writeSheetHeader($sheet, 'Cobros reales por fecha de pago', $headers, 'I');

        $total = 0.0;
        $firstDataRow = $row;
        foreach ($this->rows($report['collections'] ?? null) as $collection) {
            $sheet->setCellValue("A{$row}", $this->localDateTime($collection['paid_at'] ?? null));
            $this->setTextCell($sheet, "B{$row}", $collection['invoice_number'] ?? '');
            $this->setTextCell($sheet, "C{$row}", $collection['patient'] ?? '');
            $this->setTextCell($sheet, "D{$row}", $collection['cash_session_label'] ?? '');
            $this->setTextCell($sheet, "E{$row}", $collection['cashier'] ?? '');
            $this->setTextCell($sheet, "F{$row}", $collection['method_label'] ?? '');
            $this->setTextCell($sheet, "G{$row}", $collection['reference'] ?? '');
            $sheet->setCellValue("H{$row}", $this->moneyFloat($collection['amount'] ?? '0.00'));
            $this->setTextCell($sheet, "I{$row}", $collection['status_label'] ?? '');
            $total += $this->moneyFloat($collection['amount'] ?? '0.00');
            $row++;
        }

        if ($this->rows($report['collections'] ?? null) !== []) {
            $sheet->setCellValue("G{$row}", $this->safeText('Total'));
            $sheet->setCellValue("H{$row}", $total);
            $this->applyBoldRow($sheet, "A{$row}:I{$row}");
            $row++;
        }

        $this->applyDataRangeStyle($sheet, 'A', 'A', $firstDataRow, $row - 1, self::DATETIME_FORMAT);
        $this->applyDataRangeStyle($sheet, 'H', 'H', $firstDataRow, $row - 1, self::MONEY_FORMAT);
        $this->autoFilter($sheet, 'I', $row - 1);
        $this->autoSizeColumns($sheet, ['A' => 18, 'B' => 22, 'C' => 28, 'D' => 22, 'E' => 22, 'F' => 16, 'G' => 24, 'H' => 16, 'I' => 14]);
        $this->applyWrappedTextRows($sheet, ['B', 'C', 'D', 'E', 'F', 'G', 'I'], $firstDataRow, $row - 2);
        $this->configurePrintSetup($sheet, 'I', $row - 1);
    }

    /** @param ExecutiveReport $report */
    private function buildCashSheet(Spreadsheet $spreadsheet, array $report, string $hospital, string $rtn): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Caja');

        $headers = ['Sesion #', 'Caja fisica', 'Codigo caja', 'Cajero', 'Apertura', 'Cierre', 'Inicial (L.)', 'Esperado (L.)', 'Contado (L.)', 'Diferencia (L.)', 'Estado', 'Nota'];
        $row = $this->writeSheetHeader($sheet, 'Sesiones de caja', $headers, 'L');

        $firstDataRow = $row;
        foreach ($this->rows($report['cash_sessions'] ?? null) as $session) {
            $registerCode = $this->cleanText($session['cash_register_code'] ?? null);
            $registerName = $this->cleanText($session['cash_register_name'] ?? null);
            $registerLabel = $registerName !== '' ? $registerName : ($registerCode !== '' ? $registerCode : 'Sin caja asignada');

            $sheet->setCellValue("A{$row}", $this->safeCount($session['id'] ?? 0));
            $this->setTextCell($sheet, "B{$row}", $registerLabel);
            $this->setTextCell($sheet, "C{$row}", $registerCode);
            $this->setTextCell($sheet, "D{$row}", $session['cashier'] ?? '');
            $sheet->setCellValue("E{$row}", $this->localDateTime($session['opened_at'] ?? null));
            $sheet->setCellValue("F{$row}", $this->localDateTime($session['closed_at'] ?? null));
            $sheet->setCellValue("G{$row}", $this->moneyFloat($session['opening_amount'] ?? '0.00'));
            $sheet->setCellValue("H{$row}", $this->moneyFloat($session['expected_cash'] ?? '0.00'));
            $sheet->setCellValue("I{$row}", ($session['counted_cash'] ?? null) !== null ? $this->moneyFloat($session['counted_cash']) : null);
            $sheet->setCellValue("J{$row}", ($session['difference'] ?? null) !== null ? $this->moneyFloat($session['difference']) : null);
            $this->setTextCell($sheet, "K{$row}", $this->statusLabel($session['status_label'] ?? $session['status'] ?? null));
            $this->setTextCell($sheet, "L{$row}", $session['closure_note'] ?? '');
            $row++;
        }

        $this->applyDataRangeStyle($sheet, 'A', 'A', $firstDataRow, $row - 1, self::COUNT_FORMAT);
        $this->applyDataRangeStyle($sheet, 'E', 'F', $firstDataRow, $row - 1, self::DATETIME_FORMAT);
        $this->applyDataRangeStyle($sheet, 'G', 'J', $firstDataRow, $row - 1, self::MONEY_FORMAT);
        $this->autoFilter($sheet, 'L', $row - 1);
        $this->autoSizeColumns($sheet, ['A' => 12, 'B' => 24, 'C' => 16, 'D' => 22, 'E' => 18, 'F' => 18, 'G' => 14, 'H' => 14, 'I' => 14, 'J' => 14, 'K' => 22, 'L' => 36]);
        $this->applyWrappedTextRows($sheet, ['B', 'C', 'D', 'K', 'L'], $firstDataRow, $row - 1);
        $this->configurePrintSetup($sheet, 'L', $row - 1);
    }

    /** @param list<string> $headers */
    private function writeSheetHeader(Worksheet $sheet, string $title, array $headers, string $lastColumn): int
    {
        $sheet->setCellValue('A1', $this->safeText($title));
        $sheet->mergeCells("A1:{$lastColumn}1");
        $this->applyTitleStyle($sheet, "A1:{$lastColumn}1");

        $row = self::HEADER_ROW;
        $column = 'A';
        foreach ($headers as $header) {
            $sheet->setCellValue("{$column}{$row}", $this->safeText($header));
            $column++;
        }

        $this->applyTableHeaderStyle($sheet, "A{$row}:{$lastColumn}{$row}");
        $this->applyDataRowStyle($sheet, "A{$row}:{$lastColumn}{$row}", self::TEXT_FORMAT);
        $sheet->getRowDimension(1)->setRowHeight(24);
        $sheet->getRowDimension($row)->setRowHeight(18);
        $sheet->freezePane('A'.($row + 1));

        return $row + 1;
    }

    /**
     * Area de impresion y titulos repetidos por hoja. El titulo (fila 1) y el
     * encabezado de tabla (fila 3) se repiten en cada pagina impresa; el ancho
     * se ajusta a una pagina pero la altura NO se comprime (fitToHeight = 0),
     * para no miniaturizar un detalle largo.
     */
    private function configurePrintSetup(
        Worksheet $sheet,
        string $lastColumn,
        int $lastRow,
        string $orientation = PageSetup::ORIENTATION_LANDSCAPE,
    ): void {
        $lastRow = max($lastRow, 1);
        $pageSetup = $sheet->getPageSetup();
        $pageSetup->setPrintArea("A1:{$lastColumn}{$lastRow}");
        $pageSetup->setRowsToRepeatAtTop([1, self::HEADER_ROW]);
        $pageSetup->setOrientation($orientation);
        $pageSetup->setFitToWidth(1);
        $pageSetup->setFitToHeight(0);
        $pageSetup->setPaperSize(PageSetup::PAPERSIZE_LETTER);
        $sheet->getPageMargins()->setTop(0.5)->setBottom(0.5)->setLeft(0.4)->setRight(0.4);
    }

    /**
     * Escribe una celda de texto con tipo explicito (nunca formula) y neutraliza
     * prefijos que Excel podria interpretar como formula.
     */
    private function setTextCell(Worksheet $sheet, string $coordinate, mixed $value): void
    {
        $sheet->setCellValueExplicit($coordinate, $this->safeText($value), DataType::TYPE_STRING);
        $sheet->getStyle($coordinate)->getNumberFormat()->setFormatCode(self::TEXT_FORMAT);
    }

    private function autoFilter(Worksheet $sheet, string $lastColumn, int $lastDataRow): void
    {
        $lastRow = max($lastDataRow, self::HEADER_ROW);
        $sheet->setAutoFilter('A'.self::HEADER_ROW.":{$lastColumn}{$lastRow}");
    }

    /** @param array<string, mixed> $filters */
    private function filterSummary(array $filters): string
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
            $value = $this->plainText($filters[$key] ?? null);
            if ($value !== null && $value !== '') {
                $parts[] = $label.': '.$value;
            }
        }

        return $parts === [] ? 'Sin filtros adicionales' : implode(', ', $parts);
    }

    private function applyTitleStyle(Worksheet $sheet, string $range): void
    {
        $sheet->getStyle($range)->applyFromArray([
            'font' => ['bold' => true, 'size' => 16, 'color' => ['rgb' => '0F172A']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
        ]);
    }

    private function applySubtitleStyle(Worksheet $sheet, string $range): void
    {
        $sheet->getStyle($range)->applyFromArray([
            'font' => ['bold' => true, 'size' => 11, 'color' => ['rgb' => '2563EB']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
        ]);
    }

    private function applyTableHeaderStyle(Worksheet $sheet, string $range): void
    {
        $sheet->getStyle($range)->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF'], 'size' => 10],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '2563EB']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER, 'wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'CBD5E1']]],
        ]);
    }

    private function applyBoldRow(Worksheet $sheet, string $range): void
    {
        $sheet->getStyle($range)->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'F1F5F9']],
        ]);
    }

    private function applyDataRangeStyle(Worksheet $sheet, string $startColumn, string $endColumn, int $firstRow, int $lastRow, string $numberFormat): void
    {
        if ($lastRow < $firstRow) {
            return;
        }

        $this->applyDataRowStyle($sheet, "{$startColumn}{$firstRow}:{$endColumn}{$lastRow}", $numberFormat);
    }

    private function applyDataRowStyle(Worksheet $sheet, string $range, string $numberFormat): void
    {
        $sheet->getStyle($range)->applyFromArray([
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'E2E8F0']]],
            'numberFormat' => ['formatCode' => $numberFormat],
        ]);
    }

    /** @param array<string, int|float> $columns */
    private function autoSizeColumns(Worksheet $sheet, array $columns): void
    {
        foreach ($columns as $letter => $width) {
            $sheet->getColumnDimension($letter)->setWidth($width);
        }
    }

    /**
     * Envuelve columnas textuales y da a cada fila la altura necesaria para que
     * nombres y notas queden completos al abrir o imprimir el archivo. Las
     * columnas numericas quedan fuera para conservar su alineacion natural.
     *
     * @param  list<string>  $columns
     */
    private function applyWrappedTextRows(Worksheet $sheet, array $columns, int $firstRow, int $lastRow): void
    {
        if ($lastRow < $firstRow) {
            return;
        }

        foreach (range($firstRow, $lastRow) as $row) {
            $lineCount = 1;

            foreach ($columns as $column) {
                $cell = $sheet->getCell("{$column}{$row}");
                $rawValue = $cell->getValue();
                $text = is_scalar($rawValue) ? (string) $rawValue : '';

                if ($cell->getDataType() === DataType::TYPE_STRING) {
                    $sheet->getStyle("{$column}{$row}")
                        ->getAlignment()
                        ->setHorizontal(Alignment::HORIZONTAL_LEFT)
                        ->setVertical(Alignment::VERTICAL_TOP)
                        ->setWrapText(true);
                }

                $usableWidth = max(1, (int) floor($sheet->getColumnDimension($column)->getWidth() - 2));
                $cellLines = 0;

                foreach (preg_split('/\R/u', $text) ?: [''] as $line) {
                    $cellLines += max(1, (int) ceil(mb_strlen($line, 'UTF-8') / $usableWidth));
                }

                $lineCount = max($lineCount, $cellLines);
            }

            $sheet->getRowDimension($row)->setRowHeight(min(120, max(18, $lineCount * 15)));
        }
    }

    private function safeText(mixed $value): string
    {
        $safe = ExcelSafe::value($this->cleanText($value));

        return is_string($safe) ? $safe : '';
    }

    private function cleanText(mixed $value): string
    {
        return $this->plainText($value) ?? '';
    }

    private function localDateTime(mixed $value, bool $dateOnly = false): float|string
    {
        $text = $this->plainText($value);

        if ($text === null || trim($text) === '') {
            return '';
        }

        if (! $this->looksLikeDate(trim($text))) {
            return '';
        }

        try {
            $date = Carbon::parse($text)->setTimezone(self::HOSPITAL_TIMEZONE);
            if ($dateOnly) {
                $date->setTime(0, 0);
            }

            $excelValue = ExcelDate::PHPToExcel($date);

            return is_float($excelValue) ? $excelValue : '';
        } catch (\Throwable) {
            return '';
        }
    }

    private function looksLikeDate(string $text): bool
    {
        return preg_match('/^\d[0-9TZtz+\-\.\/: ]*$/', $text) === 1;
    }

    private function statusLabel(mixed $status): string
    {
        $value = $this->cleanText($status);

        return match ($value) {
            'open' => 'Abierta',
            'closed' => 'Cerrada',
            default => $value,
        };
    }

    private function moneyFloat(mixed $value): float
    {
        return $this->moneyToCents($value) / 100;
    }

    private function moneyToCents(mixed $value): int
    {
        $text = trim($this->cleanText($value) ?: '0');
        $negative = str_starts_with($text, '-');
        $magnitude = ltrim($text, '+-');

        if ($magnitude === '') {
            return 0;
        }

        try {
            $cents = Money::parseCents($magnitude, 'amount');
        } catch (ValidationException) {
            return 0;
        }

        return $negative ? -$cents : $cents;
    }

    private function quantityValue(mixed $value): float
    {
        $string = $this->cleanText($value) ?: '0';

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

    private function percentageFraction(mixed $value): ?float
    {
        if ($value === null) {
            return null;
        }

        $string = $this->cleanText($value) ?: '0';
        if (! is_numeric($string)) {
            return 0.0;
        }

        $numeric = $string + 0;

        return is_finite($numeric) ? $numeric / 100 : 0.0;
    }

    private function safeCount(mixed $value): int
    {
        if (is_int($value)) {
            return max(0, $value);
        }

        if (is_float($value)) {
            return is_finite($value) ? max(0, (int) $value) : 0;
        }

        $string = trim($this->cleanText($value) ?: '0');

        if ($string === '' || ! is_numeric($string)) {
            return 0;
        }

        $numeric = $string + 0;

        return is_finite($numeric) ? max(0, (int) $numeric) : 0;
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
