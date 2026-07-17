<?php

namespace App\Actions\Reports;

use App\Models\Area;
use App\Models\CashRegisterSession;
use App\Models\Category;
use App\Models\FiscalSetting;
use App\Models\User;
use App\Support\ExcelSafe;
use App\Support\HospitalName;
use App\Support\Money;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\Chart\Chart;
use PhpOffice\PhpSpreadsheet\Chart\DataSeries;
use PhpOffice\PhpSpreadsheet\Chart\DataSeriesValues;
use PhpOffice\PhpSpreadsheet\Chart\Layout;
use PhpOffice\PhpSpreadsheet\Chart\Legend;
use PhpOffice\PhpSpreadsheet\Chart\PlotArea;
use PhpOffice\PhpSpreadsheet\Chart\Title;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Color;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;

/** @phpstan-type ReportPayload array<string, mixed> */
class PremiumExcelExportService
{
    private function moneyFloat(mixed $value): float
    {
        return Money::parseCents((string) ($value ?? 0), 'amount') / 100;
    }

    /**
     * @param  ReportPayload  $income
     * @param  ReportPayload  $categories
     * @param  ReportPayload  $areas
     * @param  ReportPayload  $services
     * @param  ReportPayload  $operations
     * @param  ReportPayload|null  $cashSessionReport
     */
    public function generate(
        array $income,
        array $categories,
        array $areas,
        array $services,
        array $operations,
        Carbon $from,
        Carbon $to,
        ?array $cashSessionReport = null
    ): Spreadsheet {
        $spreadsheet = new Spreadsheet;

        // Remove default sheet
        $spreadsheet->removeSheetByIndex(0);

        $settings = FiscalSetting::query()->firstOrNew();
        $hospitalName = HospitalName::display($settings->hospital_name);
        $hospitalRtn = $settings->rtn ?? 'N/A';

        // Style presets
        $headerStyle = [
            'font' => [
                'bold' => true,
                'color' => ['rgb' => 'FFFFFF'],
                'size' => 11,
                'name' => 'Segoe UI',
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => '0F766E'], // Premium Teal Accent
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
        ];

        $titleStyle = [
            'font' => [
                'bold' => true,
                'color' => ['rgb' => '0F766E'],
                'size' => 16,
                'name' => 'Segoe UI',
            ],
        ];

        $subtitleStyle = [
            'font' => [
                'italic' => true,
                'color' => ['rgb' => '4B5563'],
                'size' => 10,
                'name' => 'Segoe UI',
            ],
        ];

        $kpiCardStyle = [
            'font' => [
                'bold' => true,
                'size' => 12,
                'color' => ['rgb' => '0F172A'],
                'name' => 'Segoe UI',
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => 'F0FDFA'], // Soft Teal Background
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => '99F6E4'], // Teal Border
                ],
            ],
        ];

        $boldRowStyle = [
            'font' => [
                'bold' => true,
                'name' => 'Segoe UI',
            ],
        ];

        $borderStyle = [
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => 'CBD5E1'],
                ],
            ],
        ];

        // SHEET 0: Filtros Aplicados (Nueva Hoja al Inicio)
        $sheet0 = $spreadsheet->createSheet();
        $sheet0->setTitle('Filtros Aplicados');
        $sheet0->setShowGridlines(true);

        // Header Title
        $sheet0->mergeCells('B2:E2');
        $sheet0->setCellValue('B2', 'REPORTES CONSOLIDADOS - FILTROS APLICADOS');
        $sheet0->getStyle('B2:E2')->applyFromArray($titleStyle);

        // Subtitle / Brand
        $sheet0->setCellValue('B3', "Establecimiento: {$hospitalName}");
        $sheet0->getStyle('B3')->applyFromArray($subtitleStyle);
        $sheet0->setCellValue('B4', "RTN: {$hospitalRtn}");
        $sheet0->getStyle('B4')->applyFromArray($subtitleStyle);

        // Filters Table Headers
        $sheet0->setCellValue('B6', 'Filtro / Parámetro');
        $sheet0->setCellValue('C6', 'Valor Aplicado');
        $sheet0->getStyle('B6:C6')->applyFromArray($headerStyle);

        // Filters Content
        $sheet0->setCellValue('B7', 'Fecha Inicial (Desde)');
        $sheet0->setCellValue('C7', $from->format('d/m/Y'));

        $sheet0->setCellValue('B8', 'Fecha Final (Hasta)');
        $sheet0->setCellValue('C8', $to->format('d/m/Y'));

        $sheet0->setCellValue('B9', 'Nombre del Hospital');
        $sheet0->setCellValue('C9', ExcelSafe::value($hospitalName));

        $sheet0->setCellValue('B10', 'RTN del Hospital');
        $sheet0->setCellValue('C10', $hospitalRtn);

        $sheet0->setCellValue('B11', 'Fecha de Generación');
        $sheet0->setCellValue('C11', now()->format('d/m/Y H:i:s'));

        $currentUser = auth()->user();
        $sheet0->setCellValue('B12', 'Generado Por');
        $sheet0->setCellValue('C12', ExcelSafe::value($currentUser instanceof User ? $currentUser->name : 'Sistema'));

        $row = 13;
        foreach ($this->appliedFilterRows($income['filters'] ?? []) as [$label, $value]) {
            $sheet0->setCellValue('B'.$row, $label);
            $sheet0->setCellValue('C'.$row, ExcelSafe::value($value));
            $row++;
        }

        $lastFilterRow = $row - 1;
        $sheet0->getStyle("B7:C{$lastFilterRow}")->applyFromArray($borderStyle);
        $sheet0->getStyle("B7:B{$lastFilterRow}")->applyFromArray($boldRowStyle);
        $sheet0->getStyle("C7:C{$lastFilterRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);

        // Auto widths
        foreach (['B', 'C'] as $col) {
            $sheet0->getColumnDimension($col)->setAutoSize(true);
        }

        if ($cashSessionReport !== null) {
            $this->addCashSessionClosureSheet(
                $spreadsheet,
                $cashSessionReport,
                $headerStyle,
                $titleStyle,
                $subtitleStyle,
                $boldRowStyle,
                $borderStyle,
            );
        }

        // SHEET 1: Resumen General
        $sheet1 = $spreadsheet->createSheet();
        $sheet1->setTitle('Resumen General');
        $sheet1->setShowGridlines(true);

        // Hospital Brand Block & Header Logo Loader
        $logoPath = Storage::disk('public')->path('branding/logo.png');
        if (Storage::disk('public')->exists('branding/logo.png') && file_exists($logoPath)) {
            $sheet1->mergeCells('B2:C4');
            $sheet1->getStyle('B2:C4')->applyFromArray([
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '0F766E'],
                ],
                'alignment' => [
                    'horizontal' => Alignment::HORIZONTAL_CENTER,
                    'vertical' => Alignment::VERTICAL_CENTER,
                ],
            ]);

            try {
                $drawing = new Drawing;
                $drawing->setName('Logo del Hospital');
                $drawing->setDescription('Logo oficial de la institucion');
                $drawing->setPath($logoPath);
                $drawing->setHeight(50); // Balanced height for the 3 merged rows
                $drawing->setCoordinates('B2');
                $drawing->setOffsetX(15);
                $drawing->setOffsetY(5);
                $drawing->setWorksheet($sheet1);
            } catch (\Exception $e) {
                // Fail-safe default placeholder if image loading fails.
                $sheet1->setCellValue('B2', "Logo\nInstitucional");
                $sheet1->getStyle('B2:C4')->getFont()->getColor()->setRGB('FFFFFF');
            }
        } else {
            // Default Medical Placeholder if no custom logo is uploaded
            $sheet1->mergeCells('B2:C4');
            $sheet1->setCellValue('B2', "Logo\nInstitucional");
            $sheet1->getStyle('B2:C4')->applyFromArray([
                'font' => [
                    'bold' => true,
                    'color' => ['rgb' => 'FFFFFF'],
                    'size' => 14,
                    'name' => 'Segoe UI',
                ],
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '0F766E'],
                ],
                'alignment' => [
                    'horizontal' => Alignment::HORIZONTAL_CENTER,
                    'vertical' => Alignment::VERTICAL_CENTER,
                    'wrapText' => true,
                ],
            ]);
        }

        $sheet1->setCellValue('D2', ExcelSafe::value($hospitalName));
        $sheet1->getStyle('D2')->applyFromArray($titleStyle);
        $sheet1->setCellValue('D3', "RTN: {$hospitalRtn}");
        $sheet1->getStyle('D3')->applyFromArray($subtitleStyle);
        $sheet1->setCellValue('D4', "Reporte Consolidado del {$from->format('d/m/Y')} al {$to->format('d/m/Y')}");
        $sheet1->getStyle('D4')->applyFromArray($subtitleStyle);

        // KPI Cards
        $sheet1->mergeCells('B6:C6');
        $sheet1->setCellValue('B6', 'TOTAL FACTURADO');
        $sheet1->getStyle('B6:C6')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet1->setCellValue('B7', $this->moneyFloat($income['total_billed']));
        $sheet1->getStyle('B7')->getNumberFormat()->setFormatCode('\"L. \"#,##0.00;\"- L. \"#,##0.00');
        $sheet1->getStyle('B6:C7')->applyFromArray($kpiCardStyle);
        $sheet1->getStyle('B7')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $sheet1->mergeCells('E6:F6');
        $sheet1->setCellValue('E6', 'TOTAL COBRADO');
        $sheet1->getStyle('E6:F6')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet1->setCellValue('E7', $this->moneyFloat($income['total_collected']));
        $sheet1->getStyle('E7')->getNumberFormat()->setFormatCode('\"L. \"#,##0.00;\"- L. \"#,##0.00');
        $sheet1->getStyle('E6:F7')->applyFromArray($kpiCardStyle);
        $sheet1->getStyle('E7')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet1->getStyle('E6:F6')->getFill()->setStartColor(new Color('CCFBF1')); // Highlighted soft green/teal

        $sheet1->mergeCells('H6:I6');
        $sheet1->setCellValue('H6', 'FACTURAS EMITIDAS');
        $sheet1->getStyle('H6:I6')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet1->setCellValue('H7', (int) $income['invoice_count']);
        $sheet1->getStyle('H7')->getNumberFormat()->setFormatCode('#,##0');
        $sheet1->getStyle('H6:I7')->applyFromArray($kpiCardStyle);
        $sheet1->getStyle('H7')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        // Table: Metodos de Pago
        $sheet1->setCellValue('B10', 'Método de Pago');
        $sheet1->setCellValue('C10', 'Total Cobrado');
        $sheet1->getStyle('B10:C10')->applyFromArray($headerStyle);

        $row = 11;
        $methodLabels = [
            'cash' => 'Efectivo',
            'transfer' => 'Transferencia',
            'card' => 'Tarjeta',
            'other' => 'Otro',
        ];

        foreach ($income['payments_by_method'] as $method => $total) {
            $sheet1->setCellValue('B'.$row, ExcelSafe::value($methodLabels[$method] ?? ucfirst($method)));
            $sheet1->setCellValue('C'.$row, $this->moneyFloat($total));
            $sheet1->getStyle('C'.$row)->getNumberFormat()->setFormatCode('\"L. \"#,##0.00;\"- L. \"#,##0.00');
            $row++;
        }

        // Summary row
        $sheet1->setCellValue('B'.$row, 'Total');
        $sheet1->setCellValue('C'.$row, '=SUM(C11:C'.($row - 1).')');
        $sheet1->getStyle('C'.$row)->getNumberFormat()->setFormatCode('\"L. \"#,##0.00;\"- L. \"#,##0.00');
        $sheet1->getStyle('B'.$row.':C'.$row)->applyFromArray($boldRowStyle);
        $sheet1->getStyle('B'.$row.':C'.$row)->getBorders()->getTop()->setBorderStyle(Border::BORDER_DOUBLE);

        // Freeze pane
        $sheet1->freezePane('A11');

        // Dynamic Interactive Excel Pie Chart for Payment Methods
        $methodCount = count($income['payments_by_method']);
        if ($methodCount > 0) {
            $lastMethodRow = 11 + $methodCount - 1;
            $dataSeriesLabels1 = [
                new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_STRING, "'Resumen General'!\$C\$10", null, 1),
            ];
            $xAxisTickValues1 = [
                new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_STRING, "'Resumen General'!\$B\$11:\$B\$".$lastMethodRow, null, $methodCount),
            ];
            $dataSeriesValues1 = [
                new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_NUMBER, "'Resumen General'!\$C\$11:\$C\$".$lastMethodRow, null, $methodCount),
            ];

            $series1 = new DataSeries(
                DataSeries::TYPE_PIECHART,
                null,
                range(0, count($dataSeriesValues1) - 1),
                $dataSeriesLabels1,
                $xAxisTickValues1,
                $dataSeriesValues1
            );

            $layout1 = new Layout;
            $layout1->setShowVal(true);
            $layout1->setShowPercent(true);

            $plotArea1 = new PlotArea($layout1, [$series1]);
            $legend1 = new Legend(Legend::POSITION_RIGHT, null, false);
            $title1 = new Title('Distribución de Cobros por Método de Pago');

            $chart1 = new Chart(
                'payment_methods_chart',
                $title1,
                $legend1,
                $plotArea1,
                true,
                DataSeries::EMPTY_AS_GAP
            );

            $chart1->setTopLeftPosition('E10');
            $chart1->setBottomRightPosition('L23');

            $sheet1->addChart($chart1);
        }

        // Auto widths
        foreach (['B', 'C', 'D', 'E', 'F', 'H', 'I'] as $col) {
            $sheet1->getColumnDimension($col)->setAutoSize(true);
        }

        $financialSheet = $spreadsheet->createSheet();
        $financialSheet->setTitle('Lectura Financiera');
        $financialSheet->setShowGridlines(true);

        $financialSheet->mergeCells('B2:D2');
        $financialSheet->setCellValue('B2', 'Lectura financiera del periodo');
        $financialSheet->getStyle('B2:D2')->applyFromArray($titleStyle);
        $financialSheet->setCellValue('B3', "Rango de fechas: {$from->format('d/m/Y')} al {$to->format('d/m/Y')}");
        $financialSheet->getStyle('B3')->applyFromArray($subtitleStyle);

        $financialSheet->setCellValue('B5', 'Concepto');
        $financialSheet->setCellValue('C5', 'Monto');
        $financialSheet->setCellValue('D5', 'Fuente');
        $financialSheet->getStyle('B5:D5')->applyFromArray($headerStyle);

        $financialRows = [
            ['Facturado', $this->moneyFloat($income['total_billed'] ?? 0), 'Facturas no anuladas emitidas en el rango'],
            ['Cobrado', $this->moneyFloat($income['total_collected'] ?? 0), 'Pagos publicados no anulados en el rango'],
            ['Pendiente', $this->moneyFloat($income['total_pending'] ?? 0), 'Saldo actual de facturas emitidas o parciales'],
            ['Parcial', $this->moneyFloat($income['total_partial'] ?? 0), 'Facturas con pago parcial separadas de pagadas'],
            ['Anulado', $this->moneyFloat($income['total_voided'] ?? 0), 'Facturas anuladas reportadas fuera de ingresos'],
        ];

        $row = 6;
        foreach ($financialRows as [$label, $amount, $source]) {
            $financialSheet->setCellValue('B'.$row, $label);
            $financialSheet->setCellValue('C'.$row, $amount);
            $financialSheet->setCellValue('D'.$row, ExcelSafe::value($source));
            $financialSheet->getStyle('C'.$row)->getNumberFormat()->setFormatCode('\"L. \"#,##0.00;\"- L. \"#,##0.00');
            $row++;
        }

        $financialSheet->getStyle('B6:D'.($row - 1))->applyFromArray($borderStyle);
        $financialSheet->getStyle('B6:B'.($row - 1))->applyFromArray($boldRowStyle);
        $financialSheet->freezePane('A6');

        foreach (['B', 'C', 'D'] as $col) {
            $financialSheet->getColumnDimension($col)->setAutoSize(true);
        }

        $categoryAmountBasis = $categories['amount_basis'] ?? ReportAmountBasis::BILLED;
        $areaAmountBasis = $areas['amount_basis'] ?? ReportAmountBasis::BILLED;
        $serviceAmountBasis = $services['amount_basis'] ?? ReportAmountBasis::BILLED;
        $categoryAmountLabel = $categoryAmountBasis === ReportAmountBasis::COLLECTED_PRORATED
            ? 'Cobrado asignado proporcionalmente'
            : 'Monto Facturado';
        $areaAmountLabel = $areaAmountBasis === ReportAmountBasis::COLLECTED_PRORATED
            ? 'Cobrado asignado proporcionalmente'
            : 'Monto Facturado';
        $serviceAmountLabel = $serviceAmountBasis === ReportAmountBasis::COLLECTED_PRORATED
            ? 'Cobrado asignado proporcionalmente'
            : 'Monto Facturado';

        // SHEET 2: Facturacion por Categoria
        $sheet2 = $spreadsheet->createSheet();
        $sheet2->setTitle('Categorías');
        $sheet2->setShowGridlines(true);

        $sheet2->setCellValue('B2', $categoryAmountBasis === ReportAmountBasis::COLLECTED_PRORATED
            ? 'Cobros asignados por Categoría de Servicio'
            : 'Facturación por Categoría de Servicio');
        $sheet2->getStyle('B2')->applyFromArray($titleStyle);
        $sheet2->setCellValue('B3', "Rango de fechas: {$from->format('d/m/Y')} al {$to->format('d/m/Y')}");
        $sheet2->getStyle('B3')->applyFromArray($subtitleStyle);
        $sheet2->setCellValue('B4', $categories['amount_source'] ?? '');
        $sheet2->getStyle('B4')->applyFromArray($subtitleStyle);

        $sheet2->setCellValue('B5', 'Categoría');
        $sheet2->setCellValue('C5', 'Cantidad Facturada');
        $sheet2->setCellValue('D5', $categoryAmountLabel);
        $sheet2->getStyle('B5:D5')->applyFromArray($headerStyle);

        $row = 6;
        foreach ($categories['categories'] as $cat) {
            $sheet2->setCellValue('B'.$row, ExcelSafe::value($cat['category']));
            $sheet2->setCellValue('C'.$row, (int) $cat['quantity']);
            $sheet2->setCellValue('D'.$row, $this->moneyFloat($cat['total']));

            $sheet2->getStyle('C'.$row)->getNumberFormat()->setFormatCode('#,##0');
            $sheet2->getStyle('D'.$row)->getNumberFormat()->setFormatCode('\"L. \"#,##0.00;\"- L. \"#,##0.00');
            $row++;
        }

        // Summary row
        $sheet2->setCellValue('B'.$row, 'Total');
        $sheet2->setCellValue('C'.$row, '=SUM(C6:C'.($row - 1).')');
        $sheet2->setCellValue('D'.$row, '=SUM(D6:D'.($row - 1).')');

        $sheet2->getStyle('C'.$row)->getNumberFormat()->setFormatCode('#,##0');
        $sheet2->getStyle('D'.$row)->getNumberFormat()->setFormatCode('\"L. \"#,##0.00;\"- L. \"#,##0.00');
        $sheet2->getStyle('B'.$row.':D'.$row)->applyFromArray($boldRowStyle);
        $sheet2->getStyle('B'.$row.':D'.$row)->getBorders()->getTop()->setBorderStyle(Border::BORDER_DOUBLE);

        // Freeze pane & auto-filter
        $sheet2->freezePane('A6');
        $sheet2->setAutoFilter('B5:D'.($row - 1));

        // Dynamic Interactive Excel Column Chart for Service Categories
        $categoryCount = count($categories['categories']);
        if ($categoryCount > 0) {
            $dataSeriesLabels2 = [
                new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_STRING, "'Categorías'!\$D\$5", null, 1),
            ];
            $xAxisTickValues2 = [
                new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_STRING, "'Categorías'!\$B\$6:\$B\$".(5 + $categoryCount), null, $categoryCount),
            ];
            $dataSeriesValues2 = [
                new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_NUMBER, "'Categorías'!\$D\$6:\$D\$".(5 + $categoryCount), null, $categoryCount),
            ];

            $series2 = new DataSeries(
                DataSeries::TYPE_BARCHART,
                DataSeries::GROUPING_CLUSTERED,
                range(0, count($dataSeriesValues2) - 1),
                $dataSeriesLabels2,
                $xAxisTickValues2,
                $dataSeriesValues2
            );
            $series2->setPlotDirection(DataSeries::DIRECTION_COL);

            $plotArea2 = new PlotArea(null, [$series2]);
            $legend2 = new Legend(Legend::POSITION_RIGHT, null, false);
            $title2 = new Title('Facturación por Categoría de Servicio (L.)');

            $chart2 = new Chart(
                'categories_chart',
                $title2,
                $legend2,
                $plotArea2,
                true,
                DataSeries::EMPTY_AS_GAP
            );

            $chart2->setTopLeftPosition('F5');
            $chart2->setBottomRightPosition('M20');

            $sheet2->addChart($chart2);
        }

        foreach (['B', 'C', 'D'] as $col) {
            $sheet2->getColumnDimension($col)->setAutoSize(true);
        }

        // SHEET 3: Facturacion por Area
        $sheetArea = $spreadsheet->createSheet();
        $sheetArea->setTitle('Áreas');
        $sheetArea->setShowGridlines(true);

        $sheetArea->setCellValue('B2', $areaAmountBasis === ReportAmountBasis::COLLECTED_PRORATED
            ? 'Cobros asignados por Área Institucional'
            : 'Facturación por Área Institucional');
        $sheetArea->getStyle('B2')->applyFromArray($titleStyle);
        $sheetArea->setCellValue('B3', "Rango de fechas: {$from->format('d/m/Y')} al {$to->format('d/m/Y')}");
        $sheetArea->getStyle('B3')->applyFromArray($subtitleStyle);
        $sheetArea->setCellValue('B4', $areas['amount_source'] ?? '');
        $sheetArea->getStyle('B4')->applyFromArray($subtitleStyle);

        $sheetArea->setCellValue('B5', 'Area');
        $sheetArea->setCellValue('C5', 'Items');
        $sheetArea->setCellValue('D5', 'Cantidad');
        $sheetArea->setCellValue('E5', $areaAmountLabel);
        $sheetArea->getStyle('B5:E5')->applyFromArray($headerStyle);

        $row = 6;
        if (empty($areas['areas'])) {
            $sheetArea->setCellValue('B'.$row, 'Sin facturación por área en el rango');
            $sheetArea->mergeCells('B'.$row.':E'.$row);
            $row++;
        } else {
            foreach ($areas['areas'] as $area) {
                $sheetArea->setCellValue('B'.$row, ExcelSafe::value($area['area']));
                $sheetArea->setCellValue('C'.$row, (int) $area['item_count']);
                $sheetArea->setCellValue('D'.$row, $this->moneyFloat($area['quantity']));
                $sheetArea->setCellValue('E'.$row, $this->moneyFloat($area['total']));

                $sheetArea->getStyle('C'.$row)->getNumberFormat()->setFormatCode('#,##0');
                $sheetArea->getStyle('D'.$row)->getNumberFormat()->setFormatCode('#,##0.00');
                $sheetArea->getStyle('E'.$row)->getNumberFormat()->setFormatCode('\"L. \"#,##0.00;\"- L. \"#,##0.00');
                $row++;
            }
        }

        $lastAreaRow = $row - 1;
        $sheetArea->setCellValue('B'.$row, 'Total');
        $sheetArea->setCellValue('C'.$row, empty($areas['areas']) ? 0 : '=SUM(C6:C'.($row - 1).')');
        $sheetArea->setCellValue('D'.$row, empty($areas['areas']) ? 0 : '=SUM(D6:D'.($row - 1).')');
        $sheetArea->setCellValue('E'.$row, empty($areas['areas']) ? 0 : '=SUM(E6:E'.($row - 1).')');

        $sheetArea->getStyle('C'.$row)->getNumberFormat()->setFormatCode('#,##0');
        $sheetArea->getStyle('D'.$row)->getNumberFormat()->setFormatCode('#,##0.00');
        $sheetArea->getStyle('E'.$row)->getNumberFormat()->setFormatCode('\"L. \"#,##0.00;\"- L. \"#,##0.00');
        $sheetArea->getStyle('B'.$row.':E'.$row)->applyFromArray($boldRowStyle);
        $sheetArea->getStyle('B'.$row.':E'.$row)->getBorders()->getTop()->setBorderStyle(Border::BORDER_DOUBLE);
        $sheetArea->freezePane('A6');
        if ($lastAreaRow >= 6) {
            $sheetArea->setAutoFilter('B5:E'.$lastAreaRow);
        }

        foreach (['B', 'C', 'D', 'E'] as $col) {
            $sheetArea->getColumnDimension($col)->setAutoSize(true);
        }

        // SHEET 4: Facturacion por Servicio
        $sheet3 = $spreadsheet->createSheet();
        $sheet3->setTitle('Servicios');
        $sheet3->setShowGridlines(true);

        $sheet3->setCellValue('B2', $serviceAmountBasis === ReportAmountBasis::COLLECTED_PRORATED
            ? 'Servicios con cobro asignado'
            : 'Facturación Detallada por Servicio');
        $sheet3->getStyle('B2')->applyFromArray($titleStyle);
        $sheet3->setCellValue('B3', "Rango de fechas: {$from->format('d/m/Y')} al {$to->format('d/m/Y')}");
        $sheet3->getStyle('B3')->applyFromArray($subtitleStyle);
        $sheet3->setCellValue('B4', $services['amount_source'] ?? '');
        $sheet3->getStyle('B4')->applyFromArray($subtitleStyle);

        $sheet3->setCellValue('B5', 'Servicio');
        $sheet3->setCellValue('C5', 'Categoría');
        $sheet3->setCellValue('D5', 'Cantidad');
        $sheet3->setCellValue('E5', $serviceAmountLabel);
        $sheet3->getStyle('B5:E5')->applyFromArray($headerStyle);

        $row = 6;
        foreach ($services['services'] as $svc) {
            $sheet3->setCellValue('B'.$row, ExcelSafe::value($svc['service']));
            $sheet3->setCellValue('C'.$row, ExcelSafe::value($svc['category']));
            $sheet3->setCellValue('D'.$row, (int) $svc['quantity']);
            $sheet3->setCellValue('E'.$row, $this->moneyFloat($svc['total']));

            $sheet3->getStyle('D'.$row)->getNumberFormat()->setFormatCode('#,##0');
            $sheet3->getStyle('E'.$row)->getNumberFormat()->setFormatCode('\"L. \"#,##0.00;\"- L. \"#,##0.00');
            $row++;
        }

        $lastServiceRow = $row - 1;

        // Summary row
        $sheet3->setCellValue('B'.$row, 'Total');
        $sheet3->setCellValue('D'.$row, '=SUM(D6:D'.($row - 1).')');
        $sheet3->setCellValue('E'.$row, '=SUM(E6:E'.($row - 1).')');

        $sheet3->getStyle('D'.$row)->getNumberFormat()->setFormatCode('#,##0');
        $sheet3->getStyle('E'.$row)->getNumberFormat()->setFormatCode('\"L. \"#,##0.00;\"- L. \"#,##0.00');
        $sheet3->getStyle('B'.$row.':E'.$row)->applyFromArray($boldRowStyle);
        $sheet3->getStyle('B'.$row.':E'.$row)->getBorders()->getTop()->setBorderStyle(Border::BORDER_DOUBLE);

        // Freeze pane & auto-filter
        $sheet3->freezePane('A6');
        $sheet3->setAutoFilter('B5:E'.$lastServiceRow);

        // Premium Highlight: Top 5 Services Horizontal Bar Chart
        $topServices = array_slice($services['services'], 0, 5);
        $topCount = count($topServices);

        if ($topCount > 0) {
            // Write top 5 to a dedicated calculation block to the side
            $sheet3->setCellValue('G10', 'Top 5 Servicios');
            $sheet3->setCellValue('H10', 'Monto Facturado');
            $sheet3->getStyle('G10:H10')->applyFromArray($headerStyle);
            $sheet3->getStyle('G10:H10')->getFill()->setStartColor(new Color('0D9488'));

            $calcRow = 11;
            foreach ($topServices as $svc) {
                $sheet3->setCellValue('G'.$calcRow, ExcelSafe::value($svc['service']));
                $sheet3->setCellValue('H'.$calcRow, $this->moneyFloat($svc['total']));
                $sheet3->getStyle('H'.$calcRow)->getNumberFormat()->setFormatCode('\"L. \"#,##0.00;\"- L. \"#,##0.00');
                $calcRow++;
            }

            // Add Horizontal Bar Chart for Top 5
            $dataSeriesLabels3 = [
                new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_STRING, "'Servicios'!\$H\$10", null, 1),
            ];
            $xAxisTickValues3 = [
                new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_STRING, "'Servicios'!\$G\$11:\$G\$".(10 + $topCount), null, $topCount),
            ];
            $dataSeriesValues3 = [
                new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_NUMBER, "'Servicios'!\$H\$11:\$H\$".(10 + $topCount), null, $topCount),
            ];

            $series3 = new DataSeries(
                DataSeries::TYPE_BARCHART,
                DataSeries::GROUPING_STANDARD,
                range(0, count($dataSeriesValues3) - 1),
                $dataSeriesLabels3,
                $xAxisTickValues3,
                $dataSeriesValues3
            );
            $series3->setPlotDirection(DataSeries::DIRECTION_BAR);

            $plotArea3 = new PlotArea(null, [$series3]);
            $legend3 = new Legend(Legend::POSITION_RIGHT, null, false);
            $title3 = new Title('Top 5 Servicios por Monto Facturado (L.)');

            $chart3 = new Chart(
                'top_services_chart',
                $title3,
                $legend3,
                $plotArea3,
                true,
                DataSeries::EMPTY_AS_GAP
            );

            $chart3->setTopLeftPosition('G12');
            $chart3->setBottomRightPosition('N26');

            $sheet3->addChart($chart3);
        }

        foreach (['B', 'C', 'D', 'E', 'G', 'H'] as $col) {
            $sheet3->getColumnDimension($col)->setAutoSize(true);
        }

        // SHEET 4: Cajeros
        $sheet4 = $spreadsheet->createSheet();
        $sheet4->setTitle('Cajeros');
        $sheet4->setShowGridlines(true);

        $sheet4->setCellValue('B2', 'Recaudaciones por Cajero');
        $sheet4->getStyle('B2')->applyFromArray($titleStyle);
        $sheet4->setCellValue('B3', "Rango de fechas: {$from->format('d/m/Y')} al {$to->format('d/m/Y')}");
        $sheet4->getStyle('B3')->applyFromArray($subtitleStyle);

        $sheet4->setCellValue('B5', 'Nombre Cajero');
        $sheet4->setCellValue('C5', 'Usuario');
        $sheet4->setCellValue('D5', 'Cantidad de Pagos');
        $sheet4->setCellValue('E5', 'Total Cobrado');
        $sheet4->getStyle('B5:E5')->applyFromArray($headerStyle);

        $row = 6;
        foreach ($operations['cashiers'] as $cashier) {
            $sheet4->setCellValue('B'.$row, ExcelSafe::value($cashier['name']));
            $username = (string) ($cashier['username'] ?? '');
            $sheet4->setCellValue('C'.$row, ExcelSafe::value($username === '' ? '' : '@'.$username));
            $sheet4->setCellValue('D'.$row, (int) $cashier['payment_count']);
            $sheet4->setCellValue('E'.$row, $this->moneyFloat($cashier['total_collected']));

            $sheet4->getStyle('D'.$row)->getNumberFormat()->setFormatCode('#,##0');
            $sheet4->getStyle('E'.$row)->getNumberFormat()->setFormatCode('\"L. \"#,##0.00;\"- L. \"#,##0.00');
            $row++;
        }

        // Summary row
        $sheet4->setCellValue('B'.$row, 'Total');
        $sheet4->setCellValue('D'.$row, '=SUM(D6:D'.($row - 1).')');
        $sheet4->setCellValue('E'.$row, '=SUM(E6:E'.($row - 1).')');

        $sheet4->getStyle('D'.$row)->getNumberFormat()->setFormatCode('#,##0');
        $sheet4->getStyle('E'.$row)->getNumberFormat()->setFormatCode('\"L. \"#,##0.00;\"- L. \"#,##0.00');
        $sheet4->getStyle('B'.$row.':E'.$row)->applyFromArray($boldRowStyle);
        $sheet4->getStyle('B'.$row.':E'.$row)->getBorders()->getTop()->setBorderStyle(Border::BORDER_DOUBLE);

        // Freeze pane & auto-filter
        $sheet4->freezePane('A6');
        $sheet4->setAutoFilter('B5:E'.($row - 1));

        // Add Bar Chart for Cashiers (only if there are more than 1 cashier)
        $cashierCount = count($operations['cashiers']);
        if ($cashierCount > 1) {
            $dataSeriesLabels4 = [
                new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_STRING, "'Cajeros'!\$E\$5", null, 1),
            ];
            $xAxisTickValues4 = [
                new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_STRING, "'Cajeros'!\$B\$6:\$B\$".(5 + $cashierCount), null, $cashierCount),
            ];
            $dataSeriesValues4 = [
                new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_NUMBER, "'Cajeros'!\$E\$6:\$E\$".(5 + $cashierCount), null, $cashierCount),
            ];

            $series4 = new DataSeries(
                DataSeries::TYPE_BARCHART,
                DataSeries::GROUPING_CLUSTERED,
                range(0, count($dataSeriesValues4) - 1),
                $dataSeriesLabels4,
                $xAxisTickValues4,
                $dataSeriesValues4
            );
            $series4->setPlotDirection(DataSeries::DIRECTION_COL);

            $plotArea4 = new PlotArea(null, [$series4]);
            $legend4 = new Legend(Legend::POSITION_RIGHT, null, false);
            $title4 = new Title('Total Recaudado por Cajero (L.)');

            $chart4 = new Chart(
                'cashiers_chart',
                $title4,
                $legend4,
                $plotArea4,
                true,
                DataSeries::EMPTY_AS_GAP
            );

            $chart4->setTopLeftPosition('G5');
            $chart4->setBottomRightPosition('N20');

            $sheet4->addChart($chart4);
        }

        foreach (['B', 'C', 'D', 'E'] as $col) {
            $sheet4->getColumnDimension($col)->setAutoSize(true);
        }

        if (($operations['can_view_audit'] ?? true) === true) {
            // SHEET 5: Auditoría y Caja (Anulaciones y Reimpresiones)
            $sheet5 = $spreadsheet->createSheet();
            $sheet5->setTitle('Auditoría');
            $sheet5->setShowGridlines(true);

            // Voids section
            $sheet5->setCellValue('B2', 'Historial de Facturas Anuladas');
            $sheet5->getStyle('B2')->applyFromArray($titleStyle);

            $sheet5->setCellValue('B4', 'Nº Factura');
            $sheet5->setCellValue('C4', 'Paciente');
            $sheet5->setCellValue('D4', 'Monto');
            $sheet5->setCellValue('E4', 'Motivo de Anulación');
            $sheet5->setCellValue('F4', 'Anulado por');
            $sheet5->getStyle('B4:F4')->applyFromArray($headerStyle);
            $sheet5->getStyle('B4:F4')->getFill()->setStartColor(new Color('BE123C')); // Premium Crimson/Red for Voids

            $row = 5;
            foreach ($operations['voids'] as $void) {
                $sheet5->setCellValue('B'.$row, ExcelSafe::value($void['invoice_number']));
                $sheet5->setCellValue('C'.$row, ExcelSafe::value($void['patient_name'] ?? 'N/A'));
                $sheet5->setCellValue('D'.$row, $this->moneyFloat($void['total']));
                $sheet5->setCellValue('E'.$row, ExcelSafe::value($void['reason'] ?? $void['void_reason'] ?? 'Sin motivo'));
                $sheet5->setCellValue('F'.$row, ExcelSafe::value($void['user'] ?? $void['voided_by_name'] ?? 'N/A'));

                $sheet5->getStyle('D'.$row)->getNumberFormat()->setFormatCode('\"L. \"#,##0.00;\"- L. \"#,##0.00');
                $row++;
            }

            // Summary row for voids
            $sheet5->setCellValue('B'.$row, 'Total Anulado');
            $sheet5->setCellValue('D'.$row, '=SUM(D5:D'.($row - 1).')');
            $sheet5->getStyle('D'.$row)->getNumberFormat()->setFormatCode('\"L. \"#,##0.00;\"- L. \"#,##0.00');
            $sheet5->getStyle('B'.$row.':F'.$row)->applyFromArray($boldRowStyle);
            $sheet5->getStyle('B'.$row.':F'.$row)->getBorders()->getTop()->setBorderStyle(Border::BORDER_DOUBLE);

            // Reprints section (below voids table)
            $row += 3;
            $sheet5->setCellValue('B'.$row, 'Historial de Reimpresiones Institucionales');
            $sheet5->getStyle('B'.$row)->applyFromArray($titleStyle);

            $row += 2;
            $sheet5->setCellValue('B'.$row, 'Nº Factura');
            $sheet5->setCellValue('C'.$row, 'Paciente');
            $sheet5->setCellValue('D'.$row, 'Ancho de Papel');
            $sheet5->setCellValue('E'.$row, 'Motivo');
            $sheet5->setCellValue('F'.$row, 'Reimpreso por');
            $sheet5->getStyle("B{$row}:F{$row}")->applyFromArray($headerStyle);
            $sheet5->getStyle("B{$row}:F{$row}")->getFill()->setStartColor(new Color('B45309')); // Premium Amber/Bronze for reprints

            $row++;
            foreach ($operations['reprints'] as $reprint) {
                $sheet5->setCellValue('B'.$row, ExcelSafe::value($reprint['invoice_number']));
                $sheet5->setCellValue('C'.$row, ExcelSafe::value($reprint['patient_name'] ?? 'N/A'));
                $sheet5->setCellValue('D'.$row, $this->receiptWidthLabel($reprint['width'] ?? null));
                $sheet5->setCellValue('E'.$row, ExcelSafe::value($reprint['reason'] ?? 'Sin motivo'));
                $sheet5->setCellValue('F'.$row, ExcelSafe::value($reprint['user'] ?? $reprint['username'] ?? 'N/A'));
                $row++;
            }

            // Payment reversals section
            $row += 3;
            $sheet5->setCellValue('B'.$row, 'Historial de Reversos de Pago');
            $sheet5->getStyle('B'.$row)->applyFromArray($titleStyle);

            $row += 2;
            $sheet5->setCellValue('B'.$row, 'Factura');
            $sheet5->setCellValue('C'.$row, 'Paciente');
            $sheet5->setCellValue('D'.$row, 'Método');
            $sheet5->setCellValue('E'.$row, 'Monto');
            $sheet5->setCellValue('F'.$row, 'Motivo');
            $sheet5->setCellValue('G'.$row, 'Reversado por');
            $sheet5->setCellValue('H'.$row, 'Fecha');
            $sheet5->getStyle("B{$row}:H{$row}")->applyFromArray($headerStyle);
            $sheet5->getStyle("B{$row}:H{$row}")->getFill()->setStartColor(new Color('6D28D9'));

            $row++;
            foreach ($operations['payment_voids'] ?? [] as $paymentVoid) {
                $sheet5->setCellValue('B'.$row, ExcelSafe::value($paymentVoid['invoice_number'] ?? 'N/A'));
                $sheet5->setCellValue('C'.$row, ExcelSafe::value($paymentVoid['patient_name'] ?? 'N/A'));
                $sheet5->setCellValue('D'.$row, ExcelSafe::value($this->paymentMethodLabel($paymentVoid['method'] ?? '')));
                $sheet5->setCellValue('E'.$row, $this->moneyFloat($paymentVoid['amount'] ?? 0));
                $sheet5->setCellValue('F'.$row, ExcelSafe::value($paymentVoid['reason'] ?? 'Sin motivo'));
                $sheet5->setCellValue('G'.$row, ExcelSafe::value($paymentVoid['voided_by'] ?? 'N/A'));
                $sheet5->setCellValue('H'.$row, isset($paymentVoid['voided_at'])
                    ? Carbon::parse($paymentVoid['voided_at'])->format('d/m/Y H:i')
                    : 'N/A');
                $sheet5->getStyle('E'.$row)->getNumberFormat()->setFormatCode('\"L. \"#,##0.00;\"- L. \"#,##0.00');
                $row++;
            }

            // Freeze pane
            $sheet5->freezePane('A5');

            foreach (['B', 'C', 'D', 'E', 'F', 'G', 'H'] as $col) {
                $sheet5->getColumnDimension($col)->setAutoSize(true);
            }
        }

        return $spreadsheet;
    }

    /**
     * @param  array<string, mixed>  $report
     * @param  array<string, mixed>  $headerStyle
     * @param  array<string, mixed>  $titleStyle
     * @param  array<string, mixed>  $subtitleStyle
     * @param  array<string, mixed>  $boldRowStyle
     * @param  array<string, mixed>  $borderStyle
     */
    private function addCashSessionClosureSheet(
        Spreadsheet $spreadsheet,
        array $report,
        array $headerStyle,
        array $titleStyle,
        array $subtitleStyle,
        array $boldRowStyle,
        array $borderStyle,
    ): void {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Cierre de Caja');
        $sheet->setShowGridlines(true);

        $cashSession = $report['cash_session'] ?? [];
        $totalsByMethod = array_merge([
            'cash' => '0.00',
            'transfer' => '0.00',
            'card' => '0.00',
            'other' => '0.00',
        ], is_array($report['totals_by_method'] ?? null) ? $report['totals_by_method'] : []);

        $sheet->mergeCells('B2:D2');
        $sheet->setCellValue('B2', 'CIERRE DE CAJA');
        $sheet->getStyle('B2:D2')->applyFromArray($titleStyle);
        $sheet->setCellValue('B3', 'Resumen imprimible/exportable de la caja seleccionada');
        $sheet->getStyle('B3')->applyFromArray($subtitleStyle);

        $sheet->setCellValue('B5', 'Caja');
        $sheet->setCellValue('C5', (int) ($cashSession['id'] ?? 0));
        $sheet->setCellValue('B6', 'Estado');
        $sheet->setCellValue('C6', ExcelSafe::value((string) ($cashSession['status'] ?? '')));
        $sheet->setCellValue('B7', 'Cajero');
        $sheet->setCellValue('C7', ExcelSafe::value((string) data_get($cashSession, 'user.name', 'Sin asignar')));
        $sheet->setCellValue('B8', 'Abierta');
        $sheet->setCellValue('C8', $this->dateTimeLabel($cashSession['opened_at'] ?? null));
        $sheet->setCellValue('B9', 'Cerrada');
        $sheet->setCellValue('C9', $this->dateTimeLabel($cashSession['closed_at'] ?? null));
        $sheet->setCellValue('B10', 'Esperado en caja');
        $sheet->setCellValue('C10', $this->moneyFloat($report['expected_cash_amount'] ?? $cashSession['expected_amount'] ?? 0));
        $sheet->setCellValue('B11', 'Contado al cierre');
        $sheet->setCellValue('C11', $this->moneyFloat($cashSession['closing_amount'] ?? 0));
        $sheet->setCellValue('B12', 'Diferencia');
        $sheet->setCellValue('C12', $this->moneyFloat($cashSession['difference_amount'] ?? 0));
        $sheet->setCellValue('B13', 'Motivo / nota');
        $sheet->setCellValue('C13', ExcelSafe::value((string) ($cashSession['closing_notes'] ?? 'Sin diferencia')));

        $sheet->getStyle('B5:C13')->applyFromArray($borderStyle);
        $sheet->getStyle('B5:B13')->applyFromArray($boldRowStyle);
        $sheet->getStyle('C10:C12')->getNumberFormat()->setFormatCode('"L. "#,##0.00;"- L. "#,##0.00');

        $sheet->setCellValue('B15', 'Metodo');
        $sheet->setCellValue('C15', 'Total');
        $sheet->getStyle('B15:C15')->applyFromArray($headerStyle);

        $methodRows = [
            ['Efectivo', $totalsByMethod['cash']],
            ['Transferencia', $totalsByMethod['transfer']],
            ['Tarjeta', $totalsByMethod['card']],
            ['Otro', $totalsByMethod['other']],
        ];
        $row = 16;
        foreach ($methodRows as [$label, $amount]) {
            $sheet->setCellValue('B'.$row, $label);
            $sheet->setCellValue('C'.$row, $this->moneyFloat($amount));
            $sheet->getStyle('C'.$row)->getNumberFormat()->setFormatCode('"L. "#,##0.00;"- L. "#,##0.00');
            $row++;
        }

        $sheet->setCellValue('B21', 'Total cobrado');
        $sheet->setCellValue('C21', $this->moneyFloat($report['payments_total'] ?? 0));
        $sheet->setCellValue('B22', 'Pagos');
        $sheet->setCellValue('C22', (int) ($report['payments_count'] ?? 0));
        $sheet->setCellValue('B23', 'Pendientes al cierre');
        $sheet->setCellValue('C23', (int) ($report['pending_invoice_count'] ?? 0));
        $sheet->setCellValue('B24', 'Monto pendiente');
        $sheet->setCellValue('C24', $this->moneyFloat($report['pending_amount'] ?? 0));
        $sheet->getStyle('B21:C24')->applyFromArray($borderStyle);
        $sheet->getStyle('B21:B24')->applyFromArray($boldRowStyle);
        $sheet->getStyle('C21:C21')->getNumberFormat()->setFormatCode('"L. "#,##0.00;"- L. "#,##0.00');
        $sheet->getStyle('C24:C24')->getNumberFormat()->setFormatCode('"L. "#,##0.00;"- L. "#,##0.00');

        $sheet->freezePane('A15');

        foreach (['B', 'C', 'D'] as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }
    }

    private function dateTimeLabel(mixed $value): string
    {
        if ($value === null || $value === '') {
            return 'N/A';
        }

        return Carbon::parse((string) $value)->format('d/m/Y H:i');
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return list<array{0: string, 1: string}>
     */
    private function appliedFilterRows(array $filters): array
    {
        $rows = [];

        if (! empty($filters['cash_session_id'])) {
            $rows[] = ['Caja', $this->cashSessionLabel((int) $filters['cash_session_id'])];
        }

        if (! empty($filters['method'])) {
            $rows[] = ['Método de pago', $this->paymentMethodLabel((string) $filters['method'])];
        }

        if (! empty($filters['status'])) {
            $rows[] = ['Estado de factura', $this->invoiceStatusLabel((string) $filters['status'])];
        }

        if (! empty($filters['user_id'])) {
            $rows[] = [
                'Cajero',
                User::query()->whereKey($filters['user_id'])->value('name') ?? 'Usuario no disponible',
            ];
        }

        if (! empty($filters['area_id'])) {
            $rows[] = [
                'Área',
                Area::query()->whereKey($filters['area_id'])->value('name') ?? 'Área no disponible',
            ];
        }

        if (! empty($filters['category_id'])) {
            $rows[] = [
                'Categoría',
                Category::query()->whereKey($filters['category_id'])->value('name') ?? 'Categoría no disponible',
            ];
        }

        return $rows;
    }

    private function paymentMethodLabel(string $method): string
    {
        return [
            'cash' => 'Efectivo',
            'transfer' => 'Transferencia',
            'card' => 'Tarjeta',
            'other' => 'Otro',
        ][$method] ?? ucfirst($method);
    }

    private function invoiceStatusLabel(string $status): string
    {
        return [
            'issued' => 'Emitida',
            'partial' => 'Parcial',
            'paid' => 'Pagada',
            'void' => 'Anulada',
        ][$status] ?? ucfirst($status);
    }

    private function cashSessionLabel(int $cashSessionId): string
    {
        $cashSession = CashRegisterSession::query()
            ->with('user:id,name')
            ->find($cashSessionId);

        if ($cashSession === null) {
            return 'Caja no disponible';
        }

        $cashier = $cashSession->user->name ?? 'Cajero no disponible';
        $openedAt = $cashSession->opened_at?->format('d/m/Y H:i') ?? 'fecha no disponible';
        $status = [
            CashRegisterSession::STATUS_OPEN => 'Abierta',
            CashRegisterSession::STATUS_CLOSED => 'Cerrada',
        ][$cashSession->status] ?? ucfirst((string) $cashSession->status);

        return "{$cashier} - Apertura {$openedAt} - {$status}";
    }

    private function receiptWidthLabel(?string $width): string
    {
        return [
            '58' => 'Termico 58mm',
            '80' => 'Termico 80mm',
            '58mm' => 'Termico 58mm',
            '80mm' => 'Termico 80mm',
            'a5' => 'A5',
            'half_letter' => 'Media carta',
            'letter' => 'Carta',
        ][$width ?? ''] ?? 'N/A';
    }
}
