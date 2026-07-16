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

        .items-table thead {
            display: table-header-group;
        }

        tfoot {
            display: table-footer-group;
        }

        .items-table tbody tr {
            page-break-inside: avoid;
            break-inside: avoid;
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

        .thermal-58mm {
            font-size: {{ 8.6 * $profile['font_scale'] }}px;
            line-height: 1.2;
        }

        .thermal-80mm .document-header,
        .thermal-58mm .document-header {
            padding-bottom: 4px;
        }

        .thermal-80mm .document-band,
        .thermal-58mm .document-band {
            margin: 5px 0;
            padding-bottom: 4px;
        }

        .thermal-80mm .section-title,
        .thermal-58mm .section-title {
            margin: 6px 0 3px;
        }

        .thermal-meta-list,
        .thermal-payment-list {
            width: 100%;
        }

        .thermal-meta-field,
        .thermal-payment-field {
            border-bottom: 1px solid #e5e7eb;
            padding: 2px 0;
            word-break: break-word;
            word-wrap: break-word;
        }

        .thermal-meta-value,
        .thermal-payment-value {
            display: block;
            margin-top: 1px;
        }

        .thermal-payment-card {
            border: 1px solid #d1d5db;
            margin-bottom: 4px;
            padding: 3px 4px;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .thermal-payment-card:last-child {
            margin-bottom: 0;
        }

        .thermal-payment-index {
            border-bottom: 1px solid #9ca3af;
            font-weight: 700;
            margin-bottom: 1px;
            padding-bottom: 2px;
            text-transform: uppercase;
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

        .receipt-summary {
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .primary-paper {
            font-size: {{ 9.2 * $profile['font_scale'] }}px;
            line-height: 1.18;
        }

        .primary-paper .document-header {
            padding-bottom: 4px;
        }

        .primary-paper .institution-line,
        .primary-paper .hospital ~ div {
            display: inline-block;
            margin-right: 6px;
        }

        .primary-paper .hospital {
            font-size: 1.22em;
        }

        .primary-paper .logo {
            height: 32px;
            margin-bottom: 2px;
        }

        .primary-paper .document-band {
            margin: 4px 0;
            padding-bottom: 3px;
        }

        .primary-paper .meta-table td {
            padding-bottom: 1px;
            padding-top: 1px;
        }

        .primary-paper .meta-table br {
            display: none;
        }

        .primary-paper .meta-table .label {
            margin-right: 3px;
        }

        .primary-paper .section-title {
            margin: 5px 0 3px;
            padding-bottom: 2px;
        }

        .primary-paper .items-table th,
        .primary-paper .items-table td {
            padding-bottom: 2px;
            padding-top: 2px;
        }

        .totals-table {
            margin-left: auto;
            margin-top: 8px;
            width: 45%;
        }

        .primary-paper .totals-table {
            font-size: 0.9em;
            line-height: 1.05;
            margin-top: 3px;
        }

        .primary-paper .totals-table td {
            padding-bottom: 0;
            padding-top: 0;
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

        .primary-paper .amount-words {
            font-size: 0.9em;
            line-height: 1.1;
            margin-top: 3px;
            padding: 3px;
        }

        .signature-grid {
            margin-top: 22px;
            page-break-inside: avoid;
            break-inside: avoid;
            width: 100%;
        }

        .primary-paper .signature-grid {
            margin-top: 4px;
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

        .primary-paper .blank-area {
            height: 14px;
            margin-bottom: 2px;
        }

        .primary-paper .signature-line {
            padding-top: 2px;
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

        .primary-paper .copy-legend {
            margin-top: 5px;
            padding-top: 3px;
        }

        .custom-small {
            font-size: {{ 8.2 * $profile['font_scale'] }}px;
            line-height: 1.06;
        }

        .custom-small .document-header {
            padding-bottom: 2px;
        }

        .custom-small .hospital {
            font-size: 1.12em;
        }

        .custom-small .document-band {
            margin: 2px 0;
            padding-bottom: 1px;
        }

        .custom-small .copy-label {
            padding: 1px 4px;
        }

        .custom-small .section-title {
            margin: 2px 0 1px;
            padding-bottom: 1px;
        }

        .custom-small .items-table th,
        .custom-small .items-table td {
            padding-bottom: 1px;
            padding-top: 1px;
        }

        .custom-small .totals-table,
        .custom-small .amount-words,
        .custom-small .signature-grid,
        .custom-small .copy-legend {
            margin-top: 2px;
        }

        .custom-small .amount-words {
            padding: 2px;
        }

        .custom-small .blank-area {
            height: 7px;
            margin-bottom: 1px;
        }

        .custom-small .signature-line,
        .custom-small .copy-legend {
            padding-top: 1px;
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

    $formatDateOnly = static function (mixed $value): string {
        if (empty($value)) {
            return '';
        }

        return $value instanceof \Illuminate\Support\Carbon
            ? $value->format('d/m/Y')
            : \Illuminate\Support\Carbon::parse($value)->format('d/m/Y');
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
        $paperClass = $isThermal ? str_replace('_', '-', (string) $profile['paper_kind']) : 'primary-paper';
        $isCustomSmall = ($profile['code'] ?? '') === \App\Models\ReceiptPrintProfile::CODE_CUSTOM_SMALL;
        $invoice = $page['invoice'];
        $payment = $page['payment'];
        $items = $page['items'];
        $taxLabel = trim(($invoice['tax_label'] ?? 'ISV').' '.($invoice['tax_rate_snapshot'] ? $invoice['tax_rate_snapshot'].'%' : ''));
        $cashier = $payment['selected_payment']['cashier_name'] ?? $payment['issued_by']['name'] ?? $payment['cash_context']['cashier_name'] ?? null;
        $postedPayments = collect($payment['posted_payments'] ?? [])->filter(fn (mixed $item): bool => is_array($item))->values();
        $displayPayments = $postedPayments->isNotEmpty()
            ? $postedPayments
            : collect(is_array($payment['selected_payment'] ?? null) ? [$payment['selected_payment']] : []);
        $hasMultiplePayments = $displayPayments->count() > 1;
        $hasMixedMethods = $displayPayments->pluck('method')->filter()->unique()->count() > 1;
        $paymentMethodSummary = $hasMixedMethods
            ? 'Pagos mixtos ('.$displayPayments->count().')'
            : ($hasMultiplePayments
                ? $displayPayments->count().' pagos de '.$paymentLabel($displayPayments->first()['method'] ?? null)
                : $paymentLabel($displayPayments->first()['method'] ?? null));
    @endphp
    <section class="receipt-page {{ $isThermal ? 'thermal '.$paperClass : $paperClass }}{{ $isCustomSmall ? ' custom-small' : '' }}">
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
            @if (! empty($page['institution']['rtn']) || ! empty($page['institution']['phone']))
                <div class="institution-contact">
                    @if (! empty($page['institution']['rtn']))RTN {{ $page['institution']['rtn'] }}@endif
                    @if (! empty($page['institution']['rtn']) && ! empty($page['institution']['phone'])) · @endif
                    @if (! empty($page['institution']['phone']))Tel. {{ $page['institution']['phone'] }}@endif
                </div>
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

        @if ($isThermal)
            <div class="thermal-meta-list thermal-document-meta">
                <div class="thermal-meta-field">
                    <span class="label">Factura</span>
                    <span class="thermal-meta-value">{{ $invoice['invoice_number'] ?: 'No registrada' }}</span>
                </div>
                <div class="thermal-meta-field">
                    <span class="label">Serie</span>
                    <span class="thermal-meta-value">{{ $page['series']['series'] ?: 'No registrada' }}</span>
                </div>
                <div class="thermal-meta-field">
                    <span class="label">Estado</span>
                    <span class="thermal-meta-value">{{ $statusLabel((string) $page['status']) }}</span>
                </div>
                <div class="thermal-meta-field">
                    <span class="label">Fecha recibo</span>
                    <span class="thermal-meta-value">{{ $formatDate($page['issued_at']) }}</span>
                </div>
                @if (! empty($page['series']['range_authorization']))
                    <div class="thermal-meta-field">
                        <span class="label">Rango autorizado</span>
                        <span class="thermal-meta-value">{{ $page['series']['range_authorization'] }}</span>
                    </div>
                @endif
                @if (! empty($invoice['fiscal_cai']))
                    <div class="thermal-meta-field">
                        <span class="label">CAI fiscal</span>
                        <span class="thermal-meta-value">{{ $invoice['fiscal_cai'] }}</span>
                    </div>
                @endif
                @if (! empty($invoice['fiscal_range_from']) || ! empty($invoice['fiscal_range_to']))
                    <div class="thermal-meta-field">
                        <span class="label">Rango fiscal autorizado</span>
                        <span class="thermal-meta-value">
                            @if (! empty($invoice['fiscal_range_from']) && ! empty($invoice['fiscal_range_to']))
                                {{ $invoice['fiscal_range_from'] }} a {{ $invoice['fiscal_range_to'] }}
                            @else
                                {{ $invoice['fiscal_range_from'] ?: $invoice['fiscal_range_to'] }}
                            @endif
                        </span>
                    </div>
                @endif
                @if (! empty($invoice['fiscal_valid_until']))
                    <div class="thermal-meta-field">
                        <span class="label">Fecha límite de emisión</span>
                        <span class="thermal-meta-value">{{ $formatDateOnly($invoice['fiscal_valid_until']) }}</span>
                    </div>
                @endif
            </div>
        @else
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
                @if (! empty($invoice['fiscal_cai']) || ! empty($invoice['fiscal_range_from']) || ! empty($invoice['fiscal_range_to']) || ! empty($invoice['fiscal_valid_until']))
                    <tr>
                        @if (! empty($invoice['fiscal_cai']))
                            <td colspan="{{ ! empty($invoice['fiscal_range_from']) || ! empty($invoice['fiscal_range_to']) || ! empty($invoice['fiscal_valid_until']) ? 2 : 4 }}">
                                <span class="label">CAI fiscal</span><br>{{ $invoice['fiscal_cai'] }}
                            </td>
                        @endif
                        @if (! empty($invoice['fiscal_range_from']) || ! empty($invoice['fiscal_range_to']) || ! empty($invoice['fiscal_valid_until']))
                            <td colspan="{{ ! empty($invoice['fiscal_cai']) ? 2 : 4 }}">
                                @if (! empty($invoice['fiscal_range_from']) || ! empty($invoice['fiscal_range_to']))
                                    <span class="label">Rango fiscal autorizado</span><br>
                                    @if (! empty($invoice['fiscal_range_from']) && ! empty($invoice['fiscal_range_to']))
                                        {{ $invoice['fiscal_range_from'] }} a {{ $invoice['fiscal_range_to'] }}
                                    @else
                                        {{ $invoice['fiscal_range_from'] ?: $invoice['fiscal_range_to'] }}
                                    @endif
                                @endif
                                @if (! empty($invoice['fiscal_valid_until']))
                                    @if (! empty($invoice['fiscal_range_from']) || ! empty($invoice['fiscal_range_to']))<br>@endif
                                    <span class="label">Fecha límite de emisión</span><br>{{ $formatDateOnly($invoice['fiscal_valid_until']) }}
                                @endif
                            </td>
                        @endif
                    </tr>
                @endif
            </table>
        @endif

        <div class="section-title">Paciente y operación</div>
        @if ($isThermal)
            <div class="thermal-meta-list thermal-operation-meta">
                <div class="thermal-meta-field">
                    <span class="label">Paciente / enterante</span>
                    <span class="thermal-meta-value">{{ $page['payer_name'] }}</span>
                </div>
                <div class="thermal-meta-field">
                    <span class="label">Cajero</span>
                    <span class="thermal-meta-value">{{ $cashier ?: 'No registrado' }}</span>
                </div>
                <div class="thermal-meta-field">
                    <span class="label">Caja</span>
                    <span class="thermal-meta-value">{{ $payment['cash_context']['cash_register_label'] ?? 'No registrada' }}</span>
                </div>
                <div class="thermal-meta-field">
                    <span class="label">Método</span>
                    <span class="thermal-meta-value">{{ $paymentMethodSummary }}</span>
                </div>
                @if (! $hasMultiplePayments && ! empty($payment['selected_payment']['reference']))
                    <div class="thermal-meta-field">
                        <span class="label">Referencia</span>
                        <span class="thermal-meta-value">{{ $payment['selected_payment']['reference'] }}</span>
                    </div>
                @endif
            </div>
        @else
            <table class="meta-table">
                <tr>
                    <td style="width: 34%;"><span class="label">Paciente / enterante</span><br>{{ $page['payer_name'] }}</td>
                    <td><span class="label">Cajero</span><br>{{ $cashier ?: 'No registrado' }}</td>
                    <td><span class="label">Caja</span><br>{{ $payment['cash_context']['cash_register_label'] ?? 'No registrada' }}</td>
                    <td><span class="label">Método</span><br>{{ $paymentMethodSummary }}</td>
                </tr>
                @if (! $hasMultiplePayments && ! empty($payment['selected_payment']['reference']))
                    <tr>
                        <td colspan="3"><span class="label">Referencia</span><br>{{ $payment['selected_payment']['reference'] }}</td>
                    </tr>
                @endif
            </table>
        @endif

        @if ($hasMultiplePayments)
            <div class="section-title">Detalle de pagos</div>
            @if ($isThermal)
                <div class="thermal-payment-list">
                    @foreach ($displayPayments as $paymentIndex => $postedPayment)
                        <div class="thermal-payment-card">
                            <div class="thermal-payment-index">Pago {{ $paymentIndex + 1 }}</div>
                            <div class="thermal-payment-field">
                                <span class="label">Fecha</span>
                                <span class="thermal-payment-value">{{ $formatDate($postedPayment['paid_at'] ?? null) ?: 'No registrada' }}</span>
                            </div>
                            <div class="thermal-payment-field">
                                <span class="label">Método</span>
                                <span class="thermal-payment-value">{{ $paymentLabel($postedPayment['method'] ?? null) }}</span>
                            </div>
                            <div class="thermal-payment-field">
                                <span class="label">Monto</span>
                                <span class="thermal-payment-value">L. {{ $postedPayment['amount'] ?? '0.00' }}</span>
                            </div>
                            <div class="thermal-payment-field">
                                <span class="label">Referencia</span>
                                <span class="thermal-payment-value">{{ $postedPayment['reference'] ?? 'Sin referencia' }}</span>
                            </div>
                            <div class="thermal-payment-field">
                                <span class="label">Cajero</span>
                                <span class="thermal-payment-value">{{ $postedPayment['cashier_name'] ?? 'No registrado' }}</span>
                            </div>
                        </div>
                    @endforeach
                </div>
            @else
                <table class="items-table payment-table">
                    <thead>
                        <tr>
                            <th style="width: 22%;">Fecha</th>
                            <th style="width: 18%;">Método</th>
                            <th style="width: 15%;" class="money">Monto</th>
                            <th style="width: 22%;">Referencia</th>
                            <th style="width: 23%;">Cajero</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($displayPayments as $postedPayment)
                            <tr>
                                <td>{{ $formatDate($postedPayment['paid_at'] ?? null) ?: 'No registrada' }}</td>
                                <td>{{ $paymentLabel($postedPayment['method'] ?? null) }}</td>
                                <td class="money">L. {{ $postedPayment['amount'] ?? '0.00' }}</td>
                                <td>{{ $postedPayment['reference'] ?? 'Sin referencia' }}</td>
                                <td>{{ $postedPayment['cashier_name'] ?? 'No registrado' }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            @endif
        @endif

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

        <div class="receipt-summary">
            <table class="totals-table">
                <tr>
                    <td>Subtotal</td>
                    <td class="money">L. {{ $invoice['subtotal'] }}</td>
                </tr>
                <tr>
                    <td>Exento</td>
                    <td class="money">L. {{ $invoice['exempt_amount'] }}</td>
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

        </div>

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

        @if ($profile['show_copy_legend'])
            <div class="copy-legend">{{ $page['copy_label'] }}@if (! empty($page['institution']['receipt_footer_text'])) - {{ $page['institution']['receipt_footer_text'] }}@endif</div>
        @endif
    </section>
@endforeach
</body>
</html>
