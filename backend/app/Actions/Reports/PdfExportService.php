<?php

namespace App\Actions\Reports;

use App\Models\Area;
use App\Models\CashRegisterSession;
use App\Models\Category;
use App\Models\User;
use App\Support\HospitalName;
use App\Support\Money;
use Barryvdh\DomPDF\Facade\Pdf;

class PdfExportService
{
    public function e(mixed $value): string
    {
        if ($value === null) {
            return '';
        }

        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    private function money(mixed $value): string
    {
        return Money::formatLempiras(Money::parseCents((string) ($value ?? 0), 'amount'));
    }

    public function buildDailyClosureHtml(array $data, array $fiscal): string
    {
        $hospitalName = HospitalName::display($fiscal['hospital_name'] ?? null);
        $rtn = $fiscal['rtn'] ?? 'N/A';
        $date = $data['date'];
        $hospitalNameEsc = $this->e($hospitalName);
        $rtnEsc = $this->e($rtn);
        $dateEsc = $this->e($date);

        $html = "
<!DOCTYPE html>
<html lang='es'>
<head>
    <meta charset='UTF-8'>
    <title>Cierre Diario - {$dateEsc}</title>
    <style>
        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #334155;
            margin: 0;
            padding: 0;
            font-size: 12px;
            line-height: 1.5;
        }
        .header {
            border-bottom: 2px solid #0d9488;
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        .header-title {
            font-size: 20px;
            font-weight: bold;
            color: #0f172a;
            margin: 0;
        }
        .header-subtitle {
            font-size: 14px;
            color: #0d9488;
            margin: 5px 0 0 0;
            font-weight: bold;
            text-transform: uppercase;
        }
        .hospital-info {
            float: right;
            text-align: right;
            font-size: 11px;
            color: #64748b;
        }
        .clear {
            clear: both;
        }
        .summary-cards {
            margin-bottom: 25px;
            width: 100%;
        }
        .summary-card {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 12px;
            width: 45%;
            display: inline-block;
            vertical-align: top;
        }
        .summary-card-right {
            float: right;
        }
        .summary-card-title {
            font-size: 11px;
            color: #64748b;
            text-transform: uppercase;
            margin-bottom: 5px;
            font-weight: bold;
        }
        .summary-card-value {
            font-size: 18px;
            font-weight: bold;
            color: #0f172a;
        }
        .section-title {
            font-size: 13px;
            font-weight: bold;
            color: #0f172a;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 5px;
            margin-top: 25px;
            margin-bottom: 10px;
            text-transform: uppercase;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        th {
            background-color: #0f172a;
            color: #ffffff;
            font-weight: bold;
            text-align: left;
            padding: 8px;
            font-size: 11px;
            text-transform: uppercase;
        }
        td {
            padding: 8px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 11px;
        }
        tr:nth-child(even) td {
            background-color: #f8fafc;
        }
        .text-right {
            text-align: right;
        }
        .text-center {
            text-align: center;
        }
        .footer {
            margin-top: 50px;
            border-top: 1px solid #e2e8f0;
            padding-top: 15px;
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
        }
        .signature-section {
            margin-top: 60px;
            width: 100%;
        }
        .signature-line {
            width: 40%;
            border-top: 1px solid #94a3b8;
            display: inline-block;
            text-align: center;
            padding-top: 5px;
            font-size: 11px;
            color: #475569;
        }
        .signature-line-right {
            float: right;
        }
    </style>
</head>
<body>

    <div class='header'>
        <div class='hospital-info'>
            <strong>{$hospitalNameEsc}</strong><br>
            RTN: {$rtnEsc}<br>
            Fecha de Reporte: {$dateEsc}
        </div>
        <div>
            <h1 class='header-title'>CIERRE DE CAJA DIARIO</h1>
            <div class='header-subtitle'>Control de Operaciones</div>
        </div>
        <div class='clear'></div>
    </div>

    <div class='summary-cards'>
        <div class='summary-card'>
            <div class='summary-card-title'>Total Facturado</div>
            <div class='summary-card-value'>".$this->money($data['total_billed'])."</div>
            <div style='font-size: 10px; color: #64748b; margin-top: 4px;'>Facturas Emitidas: ".$this->e($data['invoice_count'] ?? 0)."</div>
        </div>
        <div class='summary-card summary-card-right'>
            <div class='summary-card-title'>Total Recaudado</div>
            <div class='summary-card-value' style='color: #0d9488;'>".$this->money($data['total_collected'])."</div>
            <div style='font-size: 10px; color: #64748b; margin-top: 4px;'>Pagos Procesados: ".$this->e($data['payment_count'] ?? 0)."</div>
        </div>
        <div class='clear'></div>
    </div>

    <div class='section-title'>Lectura Financiera del Dia</div>
    <table>
        <thead>
            <tr>
                <th>Concepto</th>
                <th class='text-right'>Monto (LPS)</th>
                <th>Fuente</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><strong>Facturado</strong></td>
                <td class='text-right'>".$this->money($data['total_billed'] ?? 0)."</td>
                <td>Facturas no anuladas emitidas en el dia</td>
            </tr>
            <tr>
                <td><strong>Cobrado</strong></td>
                <td class='text-right'>".$this->money($data['total_collected'] ?? 0)."</td>
                <td>Pagos publicados no anulados en el dia</td>
            </tr>
            <tr>
                <td><strong>Pendiente</strong></td>
                <td class='text-right'>".$this->money($data['total_pending'] ?? 0)."</td>
                <td>Saldo actual de facturas emitidas o parciales del dia</td>
            </tr>
            <tr>
                <td><strong>Parcial</strong></td>
                <td class='text-right'>".$this->money($data['total_partial'] ?? 0)."</td>
                <td>Facturas con pago parcial separadas de pagadas</td>
            </tr>
            <tr>
                <td><strong>Anulado</strong></td>
                <td class='text-right'>".$this->money($data['total_voided'] ?? 0)."</td>
                <td>Facturas anuladas reportadas fuera de ingresos</td>
            </tr>
        </tbody>
    </table>

    <div class='section-title'>Recaudación por Método de Pago</div>
    <table>
        <thead>
            <tr>
                <th>Método de Pago</th>
                <th class='text-right'>Total Recaudado (LPS)</th>
            </tr>
        </thead>
        <tbody>";
        foreach ($data['payments_by_method'] as $method => $total) {
            $methodName = $this->translateMethod($method);
            $html .= '
            <tr>
                <td><strong>'.$this->e($methodName)."</strong></td>
                <td class='text-right'>".$this->money($total).'</td>
            </tr>';
        }
        $html .= "
        </tbody>
    </table>

    <div class='section-title'>Resumen de Facturación por Estado</div>
    <table>
        <thead>
            <tr>
                <th>Estado</th>
                <th class='text-center'>Cantidad</th>
                <th class='text-right'>Total Facturado (LPS)</th>
            </tr>
        </thead>
        <tbody>";
        foreach ($data['invoices_by_status'] as $status => $statusData) {
            $statusName = $this->translateStatus($status);
            $count = $statusData['count'] ?? 0;
            $total = $statusData['total'] ?? 0.00;
            $html .= '
            <tr>
                <td><strong>'.$this->e($statusName)."</strong></td>
                <td class='text-center'>".$this->e($count)."</td>
                <td class='text-right'>".$this->money($total).'</td>
            </tr>';
        }
        $html .= "
        </tbody>
    </table>

    <div class='signature-section'>
        <div class='signature-line'>
            Firma del Cajero
        </div>
        <div class='signature-line signature-line-right'>
            Firma del Supervisor
        </div>
        <div class='clear'></div>
    </div>

    <div class='footer'>
        Reporte generado automáticamente por el sistema hospitalario local - ".now()->format('Y-m-d H:i:s').'
    </div>

</body>
</html>
';

        return $html;
    }

    public function generateDailyClosurePdf(array $data, array $fiscal): string
    {
        return Pdf::loadHTML($this->buildDailyClosureHtml($data, $fiscal))->output();
    }

    public function buildRangeClosureHtml(array $data, array $fiscal): string
    {
        $hospitalName = HospitalName::display($fiscal['hospital_name'] ?? null);
        $rtn = $fiscal['rtn'] ?? 'N/A';
        $dateFrom = $data['date_from'];
        $dateTo = $data['date_to'];
        $income = $data['income'];
        $categories = $data['categories']['categories'] ?? [];
        $areas = $data['areas']['areas'] ?? [];
        $services = $data['services']['services'] ?? [];
        $operations = $data['operations'];
        $canViewAudit = ($operations['can_view_audit'] ?? true) === true;
        $categoryAmountBasis = $data['categories']['amount_basis'] ?? ReportAmountBasis::BILLED;
        $areaAmountBasis = $data['areas']['amount_basis'] ?? ReportAmountBasis::BILLED;
        $serviceAmountBasis = $data['services']['amount_basis'] ?? ReportAmountBasis::BILLED;
        $categoryTitle = $categoryAmountBasis === ReportAmountBasis::COLLECTED_PRORATED
            ? 'Cobros asignados por Categoria de Servicio'
            : 'Facturación por Categoría de Servicio';
        $areaTitle = $areaAmountBasis === ReportAmountBasis::COLLECTED_PRORATED
            ? 'Cobros asignados por Area Institucional'
            : 'Facturación por Área Institucional';
        $serviceTitle = $serviceAmountBasis === ReportAmountBasis::COLLECTED_PRORATED
            ? 'Servicios con cobro asignado'
            : 'Servicios Más Facturados';
        $categoryAmountHeader = $categoryAmountBasis === ReportAmountBasis::COLLECTED_PRORATED
            ? 'Cobrado asignado proporcionalmente (LPS)'
            : 'Monto Facturado (LPS)';
        $areaAmountHeader = $areaAmountBasis === ReportAmountBasis::COLLECTED_PRORATED
            ? 'Cobrado asignado proporcionalmente (LPS)'
            : 'Monto Facturado (LPS)';
        $serviceAmountHeader = $serviceAmountBasis === ReportAmountBasis::COLLECTED_PRORATED
            ? 'Cobrado asignado proporcionalmente (LPS)'
            : 'Monto Facturado (LPS)';
        $categorySource = $data['categories']['amount_source'] ?? '';
        $areaSource = $data['areas']['amount_source'] ?? '';
        $serviceSource = $data['services']['amount_source'] ?? '';
        $hospitalNameEsc = $this->e($hospitalName);
        $rtnEsc = $this->e($rtn);
        $dateFromEsc = $this->e($dateFrom);
        $dateToEsc = $this->e($dateTo);
        $operationalSubtitle = $canViewAudit ? 'Auditoria y Desempeno' : 'Desempeno operativo';
        $appliedFiltersHtml = $this->buildAppliedFiltersHtml($this->appliedFilterRows($data['filters'] ?? []));

        $html = "
<!DOCTYPE html>
<html lang='es'>
<head>
    <meta charset='UTF-8'>
    <title>Cierre Consolidado - {$dateFromEsc} a {$dateToEsc}</title>
    <style>
        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #334155;
            margin: 0;
            padding: 0;
            font-size: 11px;
            line-height: 1.4;
        }
        .header {
            border-bottom: 2px solid #0d9488;
            padding-bottom: 12px;
            margin-bottom: 15px;
        }
        .header-title {
            font-size: 18px;
            font-weight: bold;
            color: #0f172a;
            margin: 0;
        }
        .header-subtitle {
            font-size: 12px;
            color: #0d9488;
            margin: 4px 0 0 0;
            font-weight: bold;
            text-transform: uppercase;
        }
        .hospital-info {
            float: right;
            text-align: right;
            font-size: 10px;
            color: #64748b;
        }
        .clear {
            clear: both;
        }
        .summary-cards {
            margin-bottom: 20px;
            width: 100%;
        }
        .summary-card {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 10px;
            width: 46%;
            display: inline-block;
            vertical-align: top;
        }
        .summary-card-right {
            float: right;
        }
        .summary-card-title {
            font-size: 10px;
            color: #64748b;
            text-transform: uppercase;
            margin-bottom: 4px;
            font-weight: bold;
        }
        .summary-card-value {
            font-size: 16px;
            font-weight: bold;
            color: #0f172a;
        }
        .section-title {
            font-size: 12px;
            font-weight: bold;
            color: #0f172a;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 4px;
            margin-top: 15px;
            margin-bottom: 8px;
            text-transform: uppercase;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
        }
        th {
            background-color: #0f172a;
            color: #ffffff;
            font-weight: bold;
            text-align: left;
            padding: 6px;
            font-size: 10px;
            text-transform: uppercase;
        }
        td {
            padding: 6px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 10px;
        }
        tr:nth-child(even) td {
            background-color: #f8fafc;
        }
        .text-right {
            text-align: right;
        }
        .text-center {
            text-align: center;
        }
        .footer {
            margin-top: 30px;
            border-top: 1px solid #e2e8f0;
            padding-top: 10px;
            text-align: center;
            font-size: 9px;
            color: #94a3b8;
        }
        .page-break {
            page-break-before: always;
        }
    </style>
</head>
<body>

    <div class='header'>
        <div class='hospital-info'>
            <strong>{$hospitalNameEsc}</strong><br>
            RTN: {$rtnEsc}<br>
            Período: {$dateFromEsc} al {$dateToEsc}
        </div>
        <div>
            <h1 class='header-title'>REPORTE FINANCIERO CONSOLIDADO</h1>
            <div class='header-subtitle'>Cierre de Operaciones y Facturacion</div>
        </div>
        <div class='clear'></div>
    </div>

    {$appliedFiltersHtml}

    <div class='summary-cards'>
        <div class='summary-card'>
            <div class='summary-card-title'>Total Facturado</div>
            <div class='summary-card-value'>".$this->money($income['total_billed'])."</div>
            <div style='font-size: 9px; color: #64748b; margin-top: 3px;'>Facturas Emitidas: ".$this->e($income['invoice_count'] ?? 0)."</div>
        </div>
        <div class='summary-card summary-card-right'>
            <div class='summary-card-title'>Total Recaudado</div>
            <div class='summary-card-value' style='color: #0d9488;'>".$this->money($income['total_collected'])."</div>
            <div style='font-size: 9px; color: #64748b; margin-top: 3px;'>Pagos Procesados: ".$this->e($income['payment_count'] ?? 0)."</div>
        </div>
        <div class='clear'></div>
    </div>


    <div class='section-title'>Lectura Financiera del Periodo</div>
    <table>
        <thead>
            <tr>
                <th>Concepto</th>
                <th class='text-right'>Monto (LPS)</th>
                <th>Fuente</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><strong>Facturado</strong></td>
                <td class='text-right'>".$this->money($income['total_billed'] ?? 0)."</td>
                <td>Facturas no anuladas emitidas en el rango</td>
            </tr>
            <tr>
                <td><strong>Cobrado</strong></td>
                <td class='text-right'>".$this->money($income['total_collected'] ?? 0)."</td>
                <td>Pagos publicados no anulados en el rango</td>
            </tr>
            <tr>
                <td><strong>Pendiente</strong></td>
                <td class='text-right'>".$this->money($income['total_pending'] ?? 0)."</td>
                <td>Saldo actual de facturas emitidas o parciales</td>
            </tr>
            <tr>
                <td><strong>Parcial</strong></td>
                <td class='text-right'>".$this->money($income['total_partial'] ?? 0)."</td>
                <td>Facturas con pago parcial separadas de pagadas</td>
            </tr>
            <tr>
                <td><strong>Anulado</strong></td>
                <td class='text-right'>".$this->money($income['total_voided'] ?? 0)."</td>
                <td>Facturas anuladas reportadas fuera de ingresos</td>
            </tr>
        </tbody>
    </table>

    <div class='section-title'>".$this->e($categoryTitle)."</div>
    <div style='font-size: 9px; color: #64748b; margin-bottom: 6px;'>".$this->e($categorySource)."</div>
    <table>
        <thead>
            <tr>
                <th>Categoría</th>
                <th class='text-center'>Items Facturados</th>
                <th class='text-right'>Subtotal (LPS)</th>
                <th class='text-right'>Impuesto ISV (LPS)</th>
                <th class='text-right'>".$this->e($categoryAmountHeader).'</th>
            </tr>
        </thead>
        <tbody>';
        if (empty($categories)) {
            $html .= "<tr><td colspan='5' class='text-center'>No hay datos disponibles en este rango.</td></tr>";
        } else {
            foreach ($categories as $cat) {
                $categoryName = $this->e($cat['category'] ?? 'Sin categoria');
                $itemCount = $this->e($cat['item_count'] ?? 0);
                $subtotal = $this->money($cat['subtotal'] ?? 0);
                $taxAmount = $this->money($cat['tax_amount'] ?? 0);
                $total = $this->money($cat['total'] ?? 0);
                $html .= "
                <tr>
                    <td><strong>{$categoryName}</strong></td>
                    <td class='text-center'>{$itemCount}</td>
                    <td class='text-right'>L. {$subtotal}</td>
                    <td class='text-right'>L. {$taxAmount}</td>
                    <td class='text-right'><strong>L. {$total}</strong></td>
                </tr>";
            }
        }
        $summary = $operations['summary'] ?? [];
        $voidCount = $this->e($summary['void_count'] ?? 0);
        $reprintCount = $this->e($summary['reprint_count'] ?? 0);
        $cashierCount = $this->e($summary['cashier_count'] ?? 0);
        $backupCount = $this->e($summary['backup_count'] ?? 0);
        $paymentVoidCount = $this->e($summary['payment_void_count'] ?? 0);
        $failedBackupCount = $this->e($summary['failed_backup_count'] ?? 0);

        $html .= "
        </tbody>
    </table>

    <div class='section-title'>".$this->e($areaTitle)."</div>
    <div style='font-size: 9px; color: #64748b; margin-bottom: 6px;'>".$this->e($areaSource)."</div>
    <table>
        <thead>
            <tr>
                <th>Area</th>
                <th class='text-center'>Items</th>
                <th class='text-center'>Cantidad</th>
                <th class='text-right'>".$this->e($areaAmountHeader).'</th>
            </tr>
        </thead>
        <tbody>';
        if (empty($areas)) {
            $html .= "<tr><td colspan='4' class='text-center'>No hay facturación por área en este rango.</td></tr>";
        } else {
            foreach ($areas as $area) {
                $areaName = $this->e($area['area'] ?? 'Sin area');
                $itemCount = $this->e($area['item_count'] ?? 0);
                $quantity = $this->money($area['quantity'] ?? 0);
                $total = $this->money($area['total'] ?? 0);
                $html .= "
                <tr>
                    <td><strong>{$areaName}</strong></td>
                    <td class='text-center'>{$itemCount}</td>
                    <td class='text-center'>{$quantity}</td>
                    <td class='text-right'><strong>L. {$total}</strong></td>
                </tr>";
            }
        }
        $html .= "
        </tbody>
    </table>

    <div class='section-title'>Recaudación por Método de Pago</div>
    <table>
        <thead>
            <tr>
                <th>Método de Pago</th>
                <th class='text-right'>Total Recaudado (LPS)</th>
            </tr>
        </thead>
        <tbody>";
        foreach ($income['payments_by_method'] as $method => $total) {
            $methodName = $this->translateMethod($method);
            $html .= '
            <tr>
                <td><strong>'.$this->e($methodName)."</strong></td>
                <td class='text-right'>".$this->money($total).'</td>
            </tr>';
        }
        $html .= "
        </tbody>
    </table>

    <div class='page-break'></div>

    <div class='header'>
        <div class='hospital-info'>
            <strong>{$hospitalNameEsc}</strong><br>
            Período: {$dateFromEsc} al {$dateToEsc}
        </div>
        <div>
            <h1 class='header-title'>DETALLE OPERATIVO Y SERVICIOS</h1>
            <div class='header-subtitle'>".$this->e($operationalSubtitle)."</div>
        </div>
        <div class='clear'></div>
    </div>

    <div class='section-title'>".$this->e($serviceTitle)."</div>
    <div style='font-size: 9px; color: #64748b; margin-bottom: 6px;'>".$this->e($serviceSource)."</div>
    <table>
        <thead>
            <tr>
                <th>Nombre del Servicio</th>
                <th class='text-center'>Cantidad Facturada</th>
                <th class='text-right'>".$this->e($serviceAmountHeader).'</th>
            </tr>
        </thead>
        <tbody>';
        if (empty($services)) {
            $html .= "<tr><td colspan='3' class='text-center'>No hay datos de servicios en este rango.</td></tr>";
        } else {
            foreach (array_slice($services, 0, 10) as $srv) {
                $serviceName = $this->e($srv['service'] ?? 'Servicio sin nombre');
                $itemCount = $this->e($srv['item_count'] ?? 0);
                $total = $this->money($srv['total'] ?? 0);
                $html .= "
                <tr>
                    <td>{$serviceName}</td>
                    <td class='text-center'>{$itemCount}</td>
                    <td class='text-right'>L. {$total}</td>
                </tr>";
            }
        }
        $html .= '
        </tbody>
    </table>';

        if ($canViewAudit) {
            $html .= "
    <div class='section-title'>Resumen de Auditoría Operativa</div>
    <div style='margin-bottom: 15px;'>
        <table style='width: 100%; border: 1px solid #e2e8f0;'>
            <tr>
                <td style='width: 25%; font-weight: bold; background-color: #f8fafc;'>Facturas Anuladas:</td>
                <td style='width: 25%;'>{$voidCount}</td>
                <td style='width: 25%; font-weight: bold; background-color: #f8fafc;'>Reimpresiones de Recibo:</td>
                <td style='width: 25%;'>{$reprintCount}</td>
            </tr>
            <tr>
                <td style='font-weight: bold; background-color: #f8fafc;'>Cajeros Activos:</td>
                <td>{$cashierCount}</td>
                <td style='font-weight: bold; background-color: #f8fafc;'>Respaldos:</td>
                <td>{$backupCount}</td>
            </tr>
            <tr>
                <td style='font-weight: bold; background-color: #f8fafc;'>Reversos de Pago:</td>
                <td>{$paymentVoidCount}</td>
                <td style='font-weight: bold; background-color: #f8fafc;'>Respaldos Fallidos:</td>
                <td>{$failedBackupCount}</td>
            </tr>
        </table>
    </div>";

            if (! empty($operations['voids'])) {
                $html .= "
            <div class='section-title'>Detalle de Anulaciones</div>
            <table>
                <thead>
                    <tr>
                        <th>Factura</th>
                        <th>Fecha</th>
                        <th>Cajero</th>
                        <th>Razón de Anulación</th>
                    </tr>
                </thead>
                <tbody>";
                foreach (array_slice($operations['voids'], 0, 5) as $void) {
                    $html .= '
                    <tr>
                        <td>'.$this->e($void['invoice_number'] ?? 'N/A').'</td>
                        <td>'.$this->e($void['voided_at'] ?? 'N/A').'</td>
                        <td>'.$this->e($void['user'] ?? $void['voided_by_name'] ?? 'N/A').'</td>
                        <td>'.$this->e($void['reason'] ?? $void['void_reason'] ?? 'Sin motivo').'</td>
                    </tr>';
                }
                $html .= '
                </tbody>
            </table>';
            }

            if (! empty($operations['payment_voids'])) {
                $html .= "
            <div class='section-title'>Detalle de Reversos de Pago</div>
            <table>
                <thead>
                    <tr>
                        <th>Factura</th>
                        <th>Método</th>
                        <th class='text-right'>Monto</th>
                        <th>Motivo</th>
                        <th>Reversado por</th>
                    </tr>
                </thead>
                <tbody>";
                foreach (array_slice($operations['payment_voids'], 0, 5) as $paymentVoid) {
                    $html .= '
                    <tr>
                        <td>'.$this->e($paymentVoid['invoice_number'] ?? 'N/A').'</td>
                        <td>'.$this->e($this->translateMethod((string) ($paymentVoid['method'] ?? '')))."</td>
                        <td class='text-right'>".$this->money($paymentVoid['amount'] ?? 0).'</td>
                        <td>'.$this->e($paymentVoid['reason'] ?? 'Sin motivo').'</td>
                        <td>'.$this->e($paymentVoid['voided_by'] ?? 'N/A').'</td>
                    </tr>';
                }
                $html .= '
                </tbody>
            </table>';
            }
        }

        $html .= "
    <div class='footer'>
        Reporte consolidado generado automáticamente por el sistema hospitalario local - ".now()->format('Y-m-d H:i:s').'
    </div>

</body>
</html>
';

        return $html;
    }

    public function generateRangeClosurePdf(array $data, array $fiscal): string
    {
        return Pdf::loadHTML($this->buildRangeClosureHtml($data, $fiscal))->output();
    }

    private function translateMethod(string $method): string
    {
        return match ($method) {
            'cash' => 'Efectivo',
            'card' => 'Tarjeta de Crédito/Débito',
            'transfer' => 'Transferencia Bancaria',
            'other' => 'Otro Método',
            default => ucfirst($method),
        };
    }

    private function translateStatus(string $status): string
    {
        return match ($status) {
            'issued' => 'Emitida',
            'partial' => 'Parcialmente Pagada',
            'paid' => 'Completamente Pagada',
            'void' => 'Anulada',
            default => ucfirst($status),
        };
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
            $rows[] = ['Metodo de pago', $this->translateMethod((string) $filters['method'])];
        }

        if (! empty($filters['status'])) {
            $rows[] = ['Estado de factura', $this->translateStatus((string) $filters['status'])];
        }

        if (! empty($filters['user_id'])) {
            $rows[] = [
                'Cajero',
                User::query()->whereKey($filters['user_id'])->value('name') ?? 'Usuario no disponible',
            ];
        }

        if (! empty($filters['area_id'])) {
            $rows[] = [
                'Area',
                Area::query()->whereKey($filters['area_id'])->value('name') ?? 'Area no disponible',
            ];
        }

        if (! empty($filters['category_id'])) {
            $rows[] = [
                'Categoria',
                Category::query()->whereKey($filters['category_id'])->value('name') ?? 'Categoria no disponible',
            ];
        }

        return $rows;
    }

    /**
     * @param  list<array{0: string, 1: string}>  $rows
     */
    private function buildAppliedFiltersHtml(array $rows): string
    {
        if ($rows === []) {
            return '';
        }

        $html = "
    <div class='section-title'>Filtros aplicados</div>
    <table>
        <tbody>";

        foreach ($rows as [$label, $value]) {
            $html .= "
            <tr>
                <td style='width: 30%; font-weight: bold; background-color: #f8fafc;'>".$this->e($label).'</td>
                <td>'.$this->e($value).'</td>
            </tr>';
        }

        return $html.'
        </tbody>
    </table>';
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
        $openedAt = $cashSession->opened_at->format('d/m/Y H:i');
        $status = match ($cashSession->status) {
            CashRegisterSession::STATUS_OPEN => 'Abierta',
            CashRegisterSession::STATUS_CLOSED => 'Cerrada',
            default => ucfirst((string) $cashSession->status),
        };

        return "{$cashier} - Apertura {$openedAt} - {$status}";
    }
}
