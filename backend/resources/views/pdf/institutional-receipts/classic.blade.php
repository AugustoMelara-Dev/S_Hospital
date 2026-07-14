<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Recibo institucional</title>
    <style>
        @page {
            margin: {{ $profile['margin_top_mm'] }}mm {{ $profile['margin_right_mm'] }}mm {{ $profile['margin_bottom_mm'] }}mm {{ $profile['margin_left_mm'] }}mm;
        }

        * {
            box-sizing: border-box;
        }

        body {
            background: #fff;
            color: #111827;
            font-family: {{ $profile['font_family'] }};
            font-size: {{ 10.5 * $profile['font_scale'] }}px;
            line-height: 1.32;
            margin: 0;
        }

        table {
            border-collapse: collapse;
            width: 100%;
        }

        thead {
            display: table-header-group;
        }

        tfoot {
            display: table-footer-group;
        }

        tr {
            page-break-inside: avoid;
        }

        .receipt-page {
            page-break-after: always;
            position: relative;
            width: 100%;
        }

        .receipt-page:last-child {
            page-break-after: auto;
        }

        .thermal {
            font-size: {{ 9.2 * $profile['font_scale'] }}px;
        }

        .draft-watermark {
            border: 1.5px solid #111827;
            font-size: 18px;
            font-weight: bold;
            letter-spacing: 0.6px;
            margin-bottom: 7px;
            padding: 4px 8px;
            text-align: center;
            text-transform: uppercase;
        }

        .document-header {
            border-bottom: 1px solid #374151;
            padding-bottom: 7px;
            text-align: center;
        }

        .logo {
            display: block;
            height: 42px;
            margin: 0 auto 4px;
            max-width: 92px;
            object-fit: contain;
        }

        .institution-line {
            color: #374151;
            font-size: 0.92em;
            text-transform: uppercase;
        }

        .hospital {
            color: #111827;
            font-size: 1.35em;
            font-weight: 700;
            text-transform: uppercase;
        }

        .document-band {
            border-bottom: 1px solid #d1d5db;
            margin: 8px 0;
            padding-bottom: 6px;
        }

        .document-title {
            font-size: 1.28em;
            font-weight: 700;
            letter-spacing: 0.02em;
            text-transform: uppercase;
        }

        .copy-label {
            border: 1px solid #9ca3af;
            color: #374151;
            display: inline-block;
            font-size: 0.86em;
            font-weight: 700;
            margin-top: 2px;
            padding: 2px 6px;
            text-transform: uppercase;
        }

        .meta-table td {
            padding: 2px 5px 2px 0;
            vertical-align: top;
        }

        .label {
            color: #374151;
            font-size: 0.86em;
            font-weight: 700;
            text-transform: uppercase;
            white-space: nowrap;
        }

        .receipt-number {
            font-size: 1.2em;
            font-weight: 700;
        }

        .section-title {
            border-bottom: 1px solid #d1d5db;
            color: #111827;
            font-size: 0.94em;
            font-weight: 700;
            margin: 9px 0 5px;
            padding-bottom: 3px;
            text-transform: uppercase;
        }

        .items-table th,
        .items-table td {
            border-bottom: 1px solid #e5e7eb;
            padding: 4px 4px;
            vertical-align: top;
        }

        .items-table th {
            color: #374151;
            font-size: 0.82em;
            font-weight: 700;
            text-align: left;
            text-transform: uppercase;
        }

        .items-table .qty,
        .items-table .money,
        .totals-table .money {
            font-variant-numeric: tabular-nums;
            text-align: right;
            white-space: nowrap;
        }

        .item-meta {
            color: #4b5563;
            display: block;
            font-size: 0.86em;
            margin-top: 1px;
        }

        .receipt-closing-block {
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .totals-table {
            margin-left: auto;
            margin-top: 8px;
            width: 45%;
        }

        .thermal .totals-table {
            width: 100%;
        }

        .totals-table td {
            padding: 2px 0 2px 6px;
        }

        .totals-table .grand-total td {
            border-top: 1px solid #111827;
            font-size: 1.08em;
            font-weight: 700;
            padding-top: 4px;
        }

        .amount-words {
            border: 1px solid #d1d5db;
            margin-top: 8px;
            padding: 6px;
        }

        .signature-grid {
            margin-top: 22px;
            width: 100%;
        }

        .signature-grid td {
            text-align: center;
            width: 50%;
        }

        .signature-line {
            border-top: 1px solid #111827;
            display: inline-block;
            padding-top: 4px;
            width: 78%;
        }

        .blank-area {
            border: 1px solid #9ca3af;
            display: inline-block;
            height: 38px;
            margin-bottom: 4px;
            width: 78%;
        }

        .copy-legend {
            border-top: 1px solid #d1d5db;
            color: #374151;
            font-size: 0.82em;
            margin-top: 12px;
            padding-top: 5px;
            text-align: center;
            text-transform: uppercase;
        }
    </style>
</head>
<body>
@php
    $formatDate = static function (mixed $value): string {
        if (empty($value)) {
            return '';
        }

        return $value instanceof \Illuminate\Support\Carbon
            ? $value->format('d/m/Y H:i')
            : \Illuminate\Support\Carbon::parse($value)->format('d/m/Y H:i');
    };

    $statusLabel = static fn (string $status): string => match ($status) {
        'issued' => 'Emitido',
        'void' => 'Anulado',
        default => $status,
    };

    $paymentLabel = static fn (?string $method): string => match ($method) {
        'cash' => 'Efectivo',
        'transfer' => 'Transferencia',
        'card' => 'Tarjeta',
        'other' => 'Otro',
        default => $method ?: 'No registrado',
    };
@endphp
@foreach ($pages as $page)
    @php
        $isThermal = in_array($profile['paper_kind'] ?? '', ['thermal_80mm', 'thermal_58mm'], true);
        $invoice = $page['invoice'];
        $payment = $page['payment'];
        $items = $page['items'];
        $taxLabel = trim(($invoice['tax_label'] ?? 'ISV').' '.($invoice['tax_rate_snapshot'] ? $invoice['tax_rate_snapshot'].'%' : ''));
        $cashier = $payment['selected_payment']['cashier_name'] ?? $payment['issued_by']['name'] ?? $payment['cash_context']['cashier_name'] ?? null;
    @endphp
    <section class="receipt-page {{ $isThermal ? 'thermal' : '' }}">
        @if ($page['draft'])
            <div class="draft-watermark">{{ $page['watermark'] }}</div>
        @endif

        <header class="document-header">
            @if (! empty($page['institution']['logo_data_uri']))
                <img class="logo" src="{{ $page['institution']['logo_data_uri'] }}" alt="">
            @endif
            @if (! empty($page['institution']['government_line']))
                <div class="institution-line">{{ $page['institution']['government_line'] }}</div>
            @endif
            @if (! empty($page['institution']['secretariat_line']))
                <div class="institution-line">{{ $page['institution']['secretariat_line'] }}</div>
            @endif
            <div class="hospital">{{ $page['institution']['hospital_name'] }}</div>
            @if (! empty($page['institution']['address']))
                <div>{{ $page['institution']['address'] }}</div>
            @endif
            @if (! empty($page['institution']['receipt_location']))
                <div>{{ $page['institution']['receipt_location'] }}</div>
            @endif
        </header>

        <div class="document-band">
            <table>
                <tr>
                    <td style="width: 58%;">
                        <div class="document-title">Recibo institucional</div>
                        <span class="copy-label">{{ $page['copy_label'] }}</span>
                    </td>
                    <td style="text-align: right;">
                        <span class="label">Recibo No.</span><br>
                        <span class="receipt-number" style="color: {{ $page['series']['receipt_number_color'] }};">
                            {{ $page['series']['receipt_number_full'] }}
                        </span>
                    </td>
                </tr>
            </table>
        </div>

        <table class="meta-table">
            <tr>
                <td><span class="label">Factura</span><br>{{ $invoice['invoice_number'] ?: 'No registrada' }}</td>
                <td><span class="label">Serie</span><br>{{ $page['series']['series'] ?: 'No registrada' }}</td>
                <td><span class="label">Estado</span><br>{{ $statusLabel((string) $page['status']) }}</td>
                <td><span class="label">Fecha recibo</span><br>{{ $formatDate($page['issued_at']) }}</td>
            </tr>
            @if (! empty($page['series']['range_authorization']))
                <tr>
                    <td colspan="4"><span class="label">Rango autorizado</span><br>{{ $page['series']['range_authorization'] }}</td>
                </tr>
            @endif
        </table>

        <div class="section-title">Paciente y operación</div>
        <table class="meta-table">
            <tr>
                <td style="width: 34%;"><span class="label">Paciente / enterante</span><br>{{ $page['payer_name'] }}</td>
                <td><span class="label">Cajero</span><br>{{ $cashier ?: 'No registrado' }}</td>
                <td><span class="label">Método</span><br>{{ $paymentLabel($payment['selected_payment']['method'] ?? ($payment['posted_payments'][0]['method'] ?? null)) }}</td>
            </tr>
            @if (! empty($payment['selected_payment']['reference']))
                <tr>
                    <td colspan="3"><span class="label">Referencia</span><br>{{ $payment['selected_payment']['reference'] }}</td>
                </tr>
            @endif
        </table>

        <div class="section-title">Detalle de servicios</div>
        <table class="items-table">
            <thead>
                <tr>
                    <th style="width: 43%;">Descripción</th>
                    <th style="width: 11%;" class="qty">Cantidad</th>
                    @if (! $isThermal)
                        <th style="width: 14%;" class="money">Precio</th>
                        <th style="width: 13%;" class="money">{{ $taxLabel ?: 'Impuesto' }}</th>
                    @endif
                    <th style="width: 19%;" class="money">Importe</th>
                </tr>
            </thead>
            <tbody>
                @forelse ($items as $item)
                    <tr>
                        <td>
                            {{ $item['service_name'] ?: 'Servicio hospitalario' }}
                            @if (! empty($item['category_name']) || ! empty($item['area_name']))
                                <span class="item-meta">
                                    {{ collect([$item['category_name'] ?? null, $item['area_name'] ?? null])->filter()->implode(' / ') }}
                                </span>
                            @endif
                            @if (! empty($item['notes']))
                                <span class="item-meta">{{ $item['notes'] }}</span>
                            @endif
                        </td>
                        <td class="qty">{{ $item['quantity'] }}</td>
                        @if (! $isThermal)
                            <td class="money">L. {{ $item['unit_price'] }}</td>
                            <td class="money">L. {{ $item['tax_amount'] }}</td>
                        @endif
                        <td class="money">L. {{ $item['line_total'] }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="{{ $isThermal ? 3 : 5 }}">Servicios hospitalarios</td>
                    </tr>
                @endforelse
            </tbody>
        </table>

        <div class="receipt-closing-block">
            <table class="totals-table">
                <tr>
                    <td>Subtotal</td>
                    <td class="money">L. {{ $invoice['subtotal'] }}</td>
                </tr>
                @if (($invoice['discount_amount'] ?? '0.00') !== '0.00')
                    <tr>
                        <td>Descuento</td>
                        <td class="money">L. {{ $invoice['discount_amount'] }}</td>
                    </tr>
                @endif
                <tr>
                    <td>{{ $taxLabel ?: 'Impuesto' }}</td>
                    <td class="money">L. {{ $invoice['tax_amount'] }}</td>
                </tr>
                <tr class="grand-total">
                    <td>Total</td>
                    <td class="money">L. {{ $invoice['total'] }}</td>
                </tr>
                <tr>
                    <td>Pagado</td>
                    <td class="money">L. {{ $invoice['paid_amount'] }}</td>
                </tr>
                <tr>
                    <td>Saldo</td>
                    <td class="money">L. {{ $invoice['balance_due'] }}</td>
                </tr>
            </table>

            @if (! empty($page['amount_statement']))
                <div class="amount-words">
                    <span class="label">Monto en letras</span><br>
                    {{ $page['amount_statement'] }}
                </div>
            @endif

            <table class="signature-grid">
                <tr>
                    <td>
                        <span class="signature-line">Firma del enterante</span>
                    </td>
                    <td>
                        @if ($profile['show_physical_seal_space'])
                            <span class="blank-area"></span><br>
                        @endif
                        <span class="signature-line">Sello y firma autorizada</span>
                    </td>
                </tr>
            </table>
        </div>

        @if ($profile['show_copy_legend'])
            <div class="copy-legend">{{ $page['copy_label'] }}@if (! empty($page['institution']['receipt_footer_text'])) - {{ $page['institution']['receipt_footer_text'] }}@endif</div>
        @endif
    </section>
@endforeach
</body>
</html>
