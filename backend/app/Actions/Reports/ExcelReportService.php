<?php

namespace App\Actions\Reports;

use App\Models\FiscalSetting;
use App\Support\HospitalName;
use Illuminate\Support\Carbon;
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

class ExcelReportService
{
    public function generate(
        array $income,
        array $categories,
        array $services,
        array $operations,
        Carbon $from,
        Carbon $to
    ): Spreadsheet {
        $spreadsheet = new Spreadsheet;

        // Remove default sheet
        $spreadsheet->removeSheetByIndex(0);

        $settings = FiscalSetting::query()->first();
        $hospitalName = HospitalName::display($settings?->hospital_name);
        $hospitalRtn = $settings?->rtn ?? 'N/A';

        // Style presets
        $headerStyle = [
            'font' => [
                'bold' => true,
                'color' => ['rgb' => 'FFFFFF'],
                'size' => 11,
                'name' => 'Arial',
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => '1E3A8A'], // Navy Blue
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
        ];

        $titleStyle = [
            'font' => [
                'bold' => true,
                'color' => ['rgb' => '1E3A8A'],
                'size' => 16,
                'name' => 'Arial',
            ],
        ];

        $subtitleStyle = [
            'font' => [
                'italic' => true,
                'color' => ['rgb' => '4B5563'],
                'size' => 10,
                'name' => 'Arial',
            ],
        ];

        $kpiCardStyle = [
            'font' => [
                'bold' => true,
                'size' => 12,
                'color' => ['rgb' => '1E293B'],
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => 'F1F5F9'],
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => 'CBD5E1'],
                ],
            ],
        ];

        $boldRowStyle = [
            'font' => ['bold' => true],
        ];

        // SHEET 1: Resumen General
        $sheet1 = $spreadsheet->createSheet();
        $sheet1->setTitle('Resumen General');
        $sheet1->setShowGridlines(true);

        // Titles
        $sheet1->setCellValue('B2', $hospitalName);
        $sheet1->getStyle('B2')->applyFromArray($titleStyle);
        $sheet1->setCellValue('B3', "RTN: {$hospitalRtn}");
        $sheet1->getStyle('B3')->applyFromArray($subtitleStyle);
        $sheet1->setCellValue('B4', "Reporte Consolidado del {$from->format('d/m/Y')} al {$to->format('d/m/Y')}");
        $sheet1->getStyle('B4')->applyFromArray($subtitleStyle);

        // KPI Cards
        $sheet1->mergeCells('B6:C6');
        $sheet1->setCellValue('B6', 'TOTAL FACTURADO');
        $sheet1->getStyle('B6:C6')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet1->setCellValue('B7', (float) $income['total_billed']);
        $sheet1->getStyle('B7')->getNumberFormat()->setFormatCode('L. #,##0.00');
        $sheet1->getStyle('B6:C7')->applyFromArray($kpiCardStyle);
        $sheet1->getStyle('B7')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $sheet1->mergeCells('E6:F6');
        $sheet1->setCellValue('E6', 'TOTAL COBRADO');
        $sheet1->getStyle('E6:F6')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet1->setCellValue('E7', (float) $income['total_collected']);
        $sheet1->getStyle('E7')->getNumberFormat()->setFormatCode('L. #,##0.00');
        $sheet1->getStyle('E6:F7')->applyFromArray($kpiCardStyle);
        $sheet1->getStyle('E7')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        // Highlight collected with a soft green top border or fill
        $sheet1->getStyle('E6:F6')->getFill()->setStartColor(new Color('D1FAE5'));

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
            $sheet1->setCellValue('B'.$row, $methodLabels[$method] ?? ucfirst($method));
            $sheet1->setCellValue('C'.$row, (float) $total);
            $sheet1->getStyle('C'.$row)->getNumberFormat()->setFormatCode('L. #,##0.00');
            $row++;
        }

        // Summary row
        $sheet1->setCellValue('B'.$row, 'Total');
        $sheet1->setCellValue('C'.$row, '=SUM(C11:C'.($row - 1).')');
        $sheet1->getStyle('C'.$row)->getNumberFormat()->setFormatCode('L. #,##0.00');
        $sheet1->getStyle('B'.$row.':C'.$row)->applyFromArray($boldRowStyle);
        $sheet1->getStyle('B'.$row.':C'.$row)->getBorders()->getTop()->setBorderStyle(Border::BORDER_DOUBLE);

        // Dynamic Interactive Excel Pie Chart for Payment Methods
        $dataSeriesLabels1 = [
            new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_STRING, "'Resumen General'!\$C\$10", null, 1),
        ];
        $xAxisTickValues1 = [
            new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_STRING, "'Resumen General'!\$B\$11:\$B\$14", null, 4),
        ];
        $dataSeriesValues1 = [
            new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_NUMBER, "'Resumen General'!\$C\$11:\$C\$14", null, 4),
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
        $title1 = new Title('Distribución de Ingresos por Método de Pago');

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

        // Auto widths
        foreach (['B', 'C', 'E', 'F', 'H', 'I'] as $col) {
            $sheet1->getColumnDimension($col)->setAutoSize(true);
        }

        // SHEET 2: Ventas por Categoría
        $sheet2 = $spreadsheet->createSheet();
        $sheet2->setTitle('Categorías');
        $sheet2->setShowGridlines(true);

        $sheet2->setCellValue('B2', 'Ventas por Categoría de Servicio');
        $sheet2->getStyle('B2')->applyFromArray($titleStyle);
        $sheet2->setCellValue('B3', "Rango de fechas: {$from->format('d/m/Y')} al {$to->format('d/m/Y')}");
        $sheet2->getStyle('B3')->applyFromArray($subtitleStyle);

        $sheet2->setCellValue('B5', 'Categoría');
        $sheet2->setCellValue('C5', 'Cantidad Vendida');
        $sheet2->setCellValue('D5', 'Total Facturado');
        $sheet2->getStyle('B5:D5')->applyFromArray($headerStyle);

        $row = 6;
        foreach ($categories['categories'] as $cat) {
            $sheet2->setCellValue('B'.$row, $cat['category']);
            $sheet2->setCellValue('C'.$row, (int) $cat['quantity']);
            $sheet2->setCellValue('D'.$row, (float) $cat['total']);

            $sheet2->getStyle('C'.$row)->getNumberFormat()->setFormatCode('#,##0');
            $sheet2->getStyle('D'.$row)->getNumberFormat()->setFormatCode('L. #,##0.00');
            $row++;
        }

        // Summary row
        $sheet2->setCellValue('B'.$row, 'Total');
        $sheet2->setCellValue('C'.$row, '=SUM(C6:C'.($row - 1).')');
        $sheet2->setCellValue('D'.$row, '=SUM(D6:D'.($row - 1).')');

        $sheet2->getStyle('C'.$row)->getNumberFormat()->setFormatCode('#,##0');
        $sheet2->getStyle('D'.$row)->getNumberFormat()->setFormatCode('L. #,##0.00');
        $sheet2->getStyle('B'.$row.':D'.$row)->applyFromArray($boldRowStyle);
        $sheet2->getStyle('B'.$row.':D'.$row)->getBorders()->getTop()->setBorderStyle(Border::BORDER_DOUBLE);

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
            $title2 = new Title('Ventas Totales por Categoría de Servicio (L.)');

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

        // SHEET 3: Ventas por Servicio
        $sheet3 = $spreadsheet->createSheet();
        $sheet3->setTitle('Servicios');
        $sheet3->setShowGridlines(true);

        $sheet3->setCellValue('B2', 'Ventas Detalladas por Servicio');
        $sheet3->getStyle('B2')->applyFromArray($titleStyle);
        $sheet3->setCellValue('B3', "Rango de fechas: {$from->format('d/m/Y')} al {$to->format('d/m/Y')}");
        $sheet3->getStyle('B3')->applyFromArray($subtitleStyle);

        $sheet3->setCellValue('B5', 'Servicio');
        $sheet3->setCellValue('C5', 'Categoría');
        $sheet3->setCellValue('D5', 'Cantidad');
        $sheet3->setCellValue('E5', 'Monto Facturado');
        $sheet3->getStyle('B5:E5')->applyFromArray($headerStyle);

        $row = 6;
        foreach ($services['services'] as $svc) {
            $sheet3->setCellValue('B'.$row, $svc['service']);
            $sheet3->setCellValue('C'.$row, $svc['category']);
            $sheet3->setCellValue('D'.$row, (int) $svc['quantity']);
            $sheet3->setCellValue('E'.$row, (float) $svc['total']);

            $sheet3->getStyle('D'.$row)->getNumberFormat()->setFormatCode('#,##0');
            $sheet3->getStyle('E'.$row)->getNumberFormat()->setFormatCode('L. #,##0.00');
            $row++;
        }

        // Summary row
        $sheet3->setCellValue('B'.$row, 'Total');
        $sheet3->setCellValue('D'.$row, '=SUM(D6:D'.($row - 1).')');
        $sheet3->setCellValue('E'.$row, '=SUM(E6:E'.($row - 1).')');

        $sheet3->getStyle('D'.$row)->getNumberFormat()->setFormatCode('#,##0');
        $sheet3->getStyle('E'.$row)->getNumberFormat()->setFormatCode('L. #,##0.00');
        $sheet3->getStyle('B'.$row.':E'.$row)->applyFromArray($boldRowStyle);
        $sheet3->getStyle('B'.$row.':E'.$row)->getBorders()->getTop()->setBorderStyle(Border::BORDER_DOUBLE);

        foreach (['B', 'C', 'D', 'E'] as $col) {
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
            $sheet4->setCellValue('B'.$row, $cashier['name']);
            $sheet4->setCellValue('C'.$row, '@'.$cashier['username']);
            $sheet4->setCellValue('D'.$row, (int) $cashier['payment_count']);
            $sheet4->setCellValue('E'.$row, (float) $cashier['total_collected']);

            $sheet4->getStyle('D'.$row)->getNumberFormat()->setFormatCode('#,##0');
            $sheet4->getStyle('E'.$row)->getNumberFormat()->setFormatCode('L. #,##0.00');
            $row++;
        }

        // Summary row
        $sheet4->setCellValue('B'.$row, 'Total');
        $sheet4->setCellValue('D'.$row, '=SUM(D6:D'.($row - 1).')');
        $sheet4->setCellValue('E'.$row, '=SUM(E6:E'.($row - 1).')');

        $sheet4->getStyle('D'.$row)->getNumberFormat()->setFormatCode('#,##0');
        $sheet4->getStyle('E'.$row)->getNumberFormat()->setFormatCode('L. #,##0.00');
        $sheet4->getStyle('B'.$row.':E'.$row)->applyFromArray($boldRowStyle);
        $sheet4->getStyle('B'.$row.':E'.$row)->getBorders()->getTop()->setBorderStyle(Border::BORDER_DOUBLE);

        foreach (['B', 'C', 'D', 'E'] as $col) {
            $sheet4->getColumnDimension($col)->setAutoSize(true);
        }

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
        // Style void header with a reddish tint
        $sheet5->getStyle('B4:F4')->getFill()->setStartColor(new Color('EF4444'));

        $row = 5;
        foreach ($operations['voids'] as $void) {
            $sheet5->setCellValue('B'.$row, $void['invoice_number']);
            $sheet5->setCellValue('C'.$row, $void['patient_name'] ?? 'N/A');
            $sheet5->setCellValue('D'.$row, (float) $void['total']);
            $sheet5->setCellValue('E'.$row, $void['void_reason'] ?? 'Sin motivo');
            $sheet5->setCellValue('F'.$row, $void['voided_by_name'] ?? 'N/A');

            $sheet5->getStyle('D'.$row)->getNumberFormat()->setFormatCode('L. #,##0.00');
            $row++;
        }

        // Summary row for voids
        $sheet5->setCellValue('B'.$row, 'Total Anulado');
        $sheet5->setCellValue('D'.$row, '=SUM(D5:D'.($row - 1).')');
        $sheet5->getStyle('D'.$row)->getNumberFormat()->setFormatCode('L. #,##0.00');
        $sheet5->getStyle('B'.$row.':F'.$row)->applyFromArray($boldRowStyle);
        $sheet5->getStyle('B'.$row.':F'.$row)->getBorders()->getTop()->setBorderStyle(Border::BORDER_DOUBLE);

        // Reprints section (below voids table)
        $row += 3;
        $sheet5->setCellValue('B'.$row, 'Historial de Reimpresiones Térmicas');
        $sheet5->getStyle('B'.$row)->applyFromArray($titleStyle);

        $row += 2;
        $sheet5->setCellValue('B'.$row, 'Nº Factura');
        $sheet5->setCellValue('C'.$row, 'Paciente');
        $sheet5->setCellValue('D'.$row, 'Ancho de Papel');
        $sheet5->setCellValue('E'.$row, 'Motivo');
        $sheet5->setCellValue('F'.$row, 'Reimpreso por');
        $sheet5->getStyle("B{$row}:F{$row}")->applyFromArray($headerStyle);
        $sheet5->getStyle("B{$row}:F{$row}")->getFill()->setStartColor(new Color('F59E0B')); // Amber

        $reprintStart = $row + 1;
        $row++;
        foreach ($operations['reprints'] as $reprint) {
            $sheet5->setCellValue('B'.$row, $reprint['invoice_number']);
            $sheet5->setCellValue('C'.$row, $reprint['patient_name'] ?? 'N/A');
            $sheet5->setCellValue('D'.$row, "{$reprint['width']}mm");
            $sheet5->setCellValue('E'.$row, $reprint['reason'] ?? 'Sin motivo');
            $sheet5->setCellValue('F'.$row, $reprint['username'] ?? 'N/A');
            $row++;
        }

        foreach (['B', 'C', 'D', 'E', 'F'] as $col) {
            $sheet5->getColumnDimension($col)->setAutoSize(true);
        }

        return $spreadsheet;
    }
}
