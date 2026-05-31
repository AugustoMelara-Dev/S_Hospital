<?php

namespace App\Actions\Reports;

use App\Support\HospitalName;
use Barryvdh\DomPDF\Facade\Pdf;

class PdfExportService
{
    public function generateDailyClosurePdf(array $data, array $fiscal): string
    {
        $hospitalName = HospitalName::display($fiscal['hospital_name'] ?? null);
        $rtn = $fiscal['rtn'] ?? 'N/A';
        $date = $data['date'];

        $html = "
<!DOCTYPE html>
<html lang='es'>
<head>
    <meta charset='UTF-8'>
    <title>Cierre Diario - {$date}</title>
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
            <strong>{$hospitalName}</strong><br>
            RTN: {$rtn}<br>
            Fecha de Reporte: {$date}
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
            <div class='summary-card-value'>L. ".number_format((float) $data['total_billed'], 2)."</div>
            <div style='font-size: 10px; color: #64748b; margin-top: 4px;'>Facturas Emitidas: {$data['invoice_count']}</div>
        </div>
        <div class='summary-card summary-card-right'>
            <div class='summary-card-title'>Total Recaudado</div>
            <div class='summary-card-value' style='color: #0d9488;'>L. ".number_format((float) $data['total_collected'], 2)."</div>
            <div style='font-size: 10px; color: #64748b; margin-top: 4px;'>Pagos Procesados: {$data['payment_count']}</div>
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
                <td class='text-right'>L. ".number_format((float) ($data['total_billed'] ?? 0), 2)."</td>
                <td>Facturas no anuladas emitidas en el dia</td>
            </tr>
            <tr>
                <td><strong>Cobrado</strong></td>
                <td class='text-right'>L. ".number_format((float) ($data['total_collected'] ?? 0), 2)."</td>
                <td>Pagos publicados no anulados en el dia</td>
            </tr>
            <tr>
                <td><strong>Pendiente</strong></td>
                <td class='text-right'>L. ".number_format((float) ($data['total_pending'] ?? 0), 2)."</td>
                <td>Saldo actual de facturas emitidas o parciales del dia</td>
            </tr>
            <tr>
                <td><strong>Parcial</strong></td>
                <td class='text-right'>L. ".number_format((float) ($data['total_partial'] ?? 0), 2)."</td>
                <td>Facturas con pago parcial separadas de pagadas</td>
            </tr>
            <tr>
                <td><strong>Anulado</strong></td>
                <td class='text-right'>L. ".number_format((float) ($data['total_voided'] ?? 0), 2)."</td>
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
            $html .= "
            <tr>
                <td><strong>{$methodName}</strong></td>
                <td class='text-right'>L. ".number_format((float) $total, 2).'</td>
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
            $html .= "
            <tr>
                <td><strong>{$statusName}</strong></td>
                <td class='text-center'>{$count}</td>
                <td class='text-right'>L. ".number_format((float) $total, 2).'</td>
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

        $pdf = Pdf::loadHTML($html);

        return $pdf->output();
    }

    public function generateRangeClosurePdf(array $data, array $fiscal): string
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

        $html = "
<!DOCTYPE html>
<html lang='es'>
<head>
    <meta charset='UTF-8'>
    <title>Cierre Consolidado - {$dateFrom} a {$dateTo}</title>
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
            <strong>{$hospitalName}</strong><br>
            RTN: {$rtn}<br>
            Período: {$dateFrom} al {$dateTo}
        </div>
        <div>
            <h1 class='header-title'>REPORTE FINANCIERO CONSOLIDADO</h1>
            <div class='header-subtitle'>Cierre de Operaciones y Facturacion</div>
        </div>
        <div class='clear'></div>
    </div>

    <div class='summary-cards'>
        <div class='summary-card'>
            <div class='summary-card-title'>Total Facturado</div>
            <div class='summary-card-value'>L. ".number_format((float) $income['total_billed'], 2)."</div>
            <div style='font-size: 9px; color: #64748b; margin-top: 3px;'>Facturas Emitidas: {$income['invoice_count']}</div>
        </div>
        <div class='summary-card summary-card-right'>
            <div class='summary-card-title'>Total Recaudado</div>
            <div class='summary-card-value' style='color: #0d9488;'>L. ".number_format((float) $income['total_collected'], 2)."</div>
            <div style='font-size: 9px; color: #64748b; margin-top: 3px;'>Pagos Procesados: {$income['payment_count']}</div>
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
                <td class='text-right'>L. ".number_format((float) ($income['total_billed'] ?? 0), 2)."</td>
                <td>Facturas no anuladas emitidas en el rango</td>
            </tr>
            <tr>
                <td><strong>Cobrado</strong></td>
                <td class='text-right'>L. ".number_format((float) ($income['total_collected'] ?? 0), 2)."</td>
                <td>Pagos publicados no anulados en el rango</td>
            </tr>
            <tr>
                <td><strong>Pendiente</strong></td>
                <td class='text-right'>L. ".number_format((float) ($income['total_pending'] ?? 0), 2)."</td>
                <td>Saldo actual de facturas emitidas o parciales</td>
            </tr>
            <tr>
                <td><strong>Parcial</strong></td>
                <td class='text-right'>L. ".number_format((float) ($income['total_partial'] ?? 0), 2)."</td>
                <td>Facturas con pago parcial separadas de pagadas</td>
            </tr>
            <tr>
                <td><strong>Anulado</strong></td>
                <td class='text-right'>L. ".number_format((float) ($income['total_voided'] ?? 0), 2)."</td>
                <td>Facturas anuladas reportadas fuera de ingresos</td>
            </tr>
        </tbody>
    </table>

    <div class='section-title'>Facturación por Categoría de Servicio</div>
    <table>
        <thead>
            <tr>
                <th>Categoría</th>
                <th class='text-center'>Items Facturados</th>
                <th class='text-right'>Subtotal (LPS)</th>
                <th class='text-right'>Impuesto ISV (LPS)</th>
                <th class='text-right'>Monto Facturado (LPS)</th>
            </tr>
        </thead>
        <tbody>";
        if (empty($categories)) {
            $html .= "<tr><td colspan='5' class='text-center'>No hay datos disponibles en este rango.</td></tr>";
        } else {
            foreach ($categories as $cat) {
                $html .= '
                <tr>
                    <td><strong>'.htmlspecialchars($cat['category'])."</strong></td>
                    <td class='text-center'>{$cat['item_count']}</td>
                    <td class='text-right'>L. ".number_format((float) $cat['subtotal'], 2)."</td>
                    <td class='text-right'>L. ".number_format((float) $cat['tax_amount'], 2)."</td>
                    <td class='text-right'><strong>L. ".number_format((float) $cat['total'], 2).'</strong></td>
                </tr>';
            }
        }
        $html .= "
        </tbody>
    </table>

    <div class='section-title'>Facturación por Área Institucional</div>
    <table>
        <thead>
            <tr>
                <th>Area</th>
                <th class='text-center'>Items</th>
                <th class='text-center'>Cantidad</th>
                <th class='text-right'>Monto Facturado (LPS)</th>
            </tr>
        </thead>
        <tbody>";
        if (empty($areas)) {
            $html .= "<tr><td colspan='4' class='text-center'>No hay facturación por área en este rango.</td></tr>";
        } else {
            foreach ($areas as $area) {
                $html .= '
                <tr>
                    <td><strong>'.htmlspecialchars($area['area'])."</strong></td>
                    <td class='text-center'>{$area['item_count']}</td>
                    <td class='text-center'>".number_format((float) $area['quantity'], 2)."</td>
                    <td class='text-right'><strong>L. ".number_format((float) $area['total'], 2).'</strong></td>
                </tr>';
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
            $html .= "
            <tr>
                <td><strong>{$methodName}</strong></td>
                <td class='text-right'>L. ".number_format((float) $total, 2).'</td>
            </tr>';
        }
        $html .= "
        </tbody>
    </table>

    <div class='page-break'></div>

    <div class='header'>
        <div class='hospital-info'>
            <strong>{$hospitalName}</strong><br>
            Período: {$dateFrom} al {$dateTo}
        </div>
        <div>
            <h1 class='header-title'>DETALLE OPERATIVO Y SERVICIOS</h1>
            <div class='header-subtitle'>Auditoría y Desempeño</div>
        </div>
        <div class='clear'></div>
    </div>

    <div class='section-title'>Servicios Más Facturados</div>
    <table>
        <thead>
            <tr>
                <th>Nombre del Servicio</th>
                <th class='text-center'>Cantidad Facturada</th>
                <th class='text-right'>Monto Facturado (LPS)</th>
            </tr>
        </thead>
        <tbody>";
        if (empty($services)) {
            $html .= "<tr><td colspan='3' class='text-center'>No hay datos de servicios en este rango.</td></tr>";
        } else {
            foreach (array_slice($services, 0, 10) as $srv) {
                $html .= '
                <tr>
                    <td>'.htmlspecialchars($srv['service'])."</td>
                    <td class='text-center'>{$srv['item_count']}</td>
                    <td class='text-right'>L. ".number_format((float) $srv['total'], 2).'</td>
                </tr>';
            }
        }
        $html .= "
        </tbody>
    </table>

    <div class='section-title'>Resumen de Auditoría Operativa</div>
    <div style='margin-bottom: 15px;'>
        <table style='width: 100%; border: 1px solid #e2e8f0;'>
            <tr>
                <td style='width: 25%; font-weight: bold; background-color: #f8fafc;'>Facturas Anuladas:</td>
                <td style='width: 25%;'>{$operations['summary']['void_count']}</td>
                <td style='width: 25%; font-weight: bold; background-color: #f8fafc;'>Reimpresiones de Recibo:</td>
                <td style='width: 25%;'>{$operations['summary']['reprint_count']}</td>
            </tr>
            <tr>
                <td style='font-weight: bold; background-color: #f8fafc;'>Cajeros Activos:</td>
                <td>{$operations['summary']['cashier_count']}</td>
                <td style='font-weight: bold; background-color: #f8fafc;'>Respaldos:</td>
                <td>".($operations['summary']['backup_count'] ?? 0).'</td>
            </tr>
            <tr>
                <td style="font-weight: bold; background-color: #f8fafc;">Reversos de Pago:</td>
                <td>'.($operations['summary']['payment_void_count'] ?? 0)."</td>
                <td style='font-weight: bold; background-color: #f8fafc;'>Respaldos Fallidos:</td>
                <td>".($operations['summary']['failed_backup_count'] ?? 0).'</td>
            </tr>
        </table>
    </div>';

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
                        <td>'.htmlspecialchars((string) ($void['invoice_number'] ?? 'N/A')).'</td>
                        <td>'.htmlspecialchars((string) ($void['voided_at'] ?? 'N/A')).'</td>
                        <td>'.htmlspecialchars((string) ($void['user'] ?? $void['voided_by_name'] ?? 'N/A')).'</td>
                        <td>'.htmlspecialchars((string) ($void['reason'] ?? $void['void_reason'] ?? 'Sin motivo')).'</td>
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
                        <td>'.htmlspecialchars((string) ($paymentVoid['invoice_number'] ?? 'N/A')).'</td>
                        <td>'.htmlspecialchars($this->translateMethod((string) ($paymentVoid['method'] ?? '')))."</td>
                        <td class='text-right'>L. ".number_format((float) ($paymentVoid['amount'] ?? 0), 2).'</td>
                        <td>'.htmlspecialchars((string) ($paymentVoid['reason'] ?? 'Sin motivo')).'</td>
                        <td>'.htmlspecialchars((string) ($paymentVoid['voided_by'] ?? 'N/A')).'</td>
                    </tr>';
            }
            $html .= '
                </tbody>
            </table>';
        }

        $html .= "
    <div class='footer'>
        Reporte consolidado generado automáticamente por el sistema hospitalario local - ".now()->format('Y-m-d H:i:s').'
    </div>

</body>
</html>
';

        $pdf = Pdf::loadHTML($html);

        return $pdf->output();
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
}
