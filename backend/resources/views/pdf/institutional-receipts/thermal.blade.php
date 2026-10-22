{{--
    Comprobante institucional — TÉRMICA DEDICADA (F2C / H-18).

    No es una carta encogida: es un rollo de 80 mm (72 mm útiles) o 58 mm
    (48 mm útiles). Márgenes 1 mm, tipo mono/sans ≥ 8 pt (≥ 9 pt en totales),
    negro puro, sin grises de texto ni fondos, líneas ≥ 0.5 pt y alto de página
    medido por el constructor para que el rollo no lleve una cola en blanco ni
    corte una fila por la mitad.

    Contrato de contenido (H-08):
    - El «Importe» de una línea es cantidad × precio − ajuste, SIN impuesto.
      El ISV no se imprime por línea: se desglosa una sola vez en los totales
      por tasa (Exento / Gravado X % / ISV X %).
    - La línea beneficiada por una regla conserva su lugar, su precio de
      referencia, su ajuste y su importe L. 0.00, con la marca «Sin cobro por
      receta»; un precio de catálogo legítimamente cero no se presenta como
      gratuidad.
    - Sin QR, código de barras, códigos internos, auditoría ni identificadores.
    - Una página por ejemplar; el documento nunca es un bloque indivisible.
--}}
@php
    $paperKind = (string) ($profile['paper_kind'] ?? 'thermal_80mm');
    $isNarrow = $paperKind === 'thermal_58mm';
    $widthMm = $isNarrow ? 58 : 80;
    $contentMm = $isNarrow ? 48 : 72;
    $amountWidthMm = $isNarrow ? 22 : 24;
    $pageMarginMm = 1;
    $scale = (float) $profile['font_scale'];
    $basePt = max(8.0, 8.5 * $scale);
    $totalPt = max(9.0, 9.5 * $scale);
    $headingPt = max(10.0, $basePt + 1.5);
@endphp
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Recibo institucional</title>
    <style>
        @page {
            size: {{ $widthMm }}mm auto;
            margin: {{ $pageMarginMm }}mm;
        }

        * {
            box-sizing: border-box;
        }

        body {
            background: #fff;
            color: #000;
            font-family: 'DejaVu Sans Mono', monospace;
            font-size: {{ $basePt }}pt;
            line-height: 1.25;
            margin: 0;
            padding: 0;
        }

        .receipt-page {
            page-break-after: always;
        }

        .receipt-page:last-child {
            page-break-after: auto;
        }

        .ticket {
            margin: 0 auto;
            width: {{ $contentMm }}mm;
        }

        table {
            border-collapse: collapse;
            table-layout: fixed;
            width: 100%;
        }

        th,
        td {
            vertical-align: top;
        }

        .center {
            text-align: center;
        }

        .right {
            text-align: right;
        }

        .label {
            font-weight: 700;
            text-transform: uppercase;
        }

        .masthead {
            border-bottom: 0.75pt solid #000;
            padding-bottom: 1.2mm;
            text-align: center;
        }

        .logo {
            display: block;
            height: 8mm;
            margin: 0 auto 1mm;
        }

        .gov-line {
            font-size: {{ $basePt }}pt;
            line-height: 1.15;
            text-transform: uppercase;
            word-wrap: break-word;
        }

        .hospital {
            font-size: {{ $headingPt }}pt;
            font-weight: 700;
            line-height: 1.15;
            margin: 0.5mm 0;
            text-transform: uppercase;
            word-wrap: break-word;
        }

        .contact {
            font-size: {{ $basePt }}pt;
            line-height: 1.2;
            word-wrap: break-word;
        }

        .notice {
            border: 0.75pt solid #000;
            font-size: {{ $basePt }}pt;
            font-weight: 700;
            margin-bottom: 1.5mm;
            padding: 1mm;
            text-align: center;
            text-transform: uppercase;
        }

        .doc-title {
            font-size: {{ $basePt }}pt;
            font-weight: 700;
            letter-spacing: 0.04em;
            margin-top: 1.2mm;
            text-transform: uppercase;
        }

        .doc-flags {
            font-size: {{ $basePt }}pt;
            font-weight: 700;
            margin-top: 0.4mm;
            text-transform: uppercase;
        }

        .doc-band {
            margin-top: 0.6mm;
            width: 100%;
        }

        .doc-band td {
            padding: 0.3mm 0;
        }

        .doc-band .key {
            font-weight: 700;
            text-transform: uppercase;
            width: 22mm;
        }

        .doc-number {
            font-size: {{ max(9.5, $basePt + 1.0) }}pt;
            font-weight: 700;
        }

        .patient {
            border-bottom: 0.5pt solid #000;
            border-top: 0.5pt solid #000;
            margin-top: 1.2mm;
            padding: 1mm 0;
        }

        .patient-name {
            font-size: {{ max(9.0, $basePt + 0.5) }}pt;
            font-weight: 700;
            line-height: 1.2;
            word-wrap: break-word;
        }

        .meta {
            margin-top: 0.8mm;
            width: 100%;
        }

        .meta td {
            padding: 0.3mm 0;
        }

        .meta .key {
            font-weight: 700;
            text-transform: uppercase;
            width: 22mm;
        }

        .meta .value {
            word-wrap: break-word;
        }

        .section-title {
            border-bottom: 0.5pt solid #000;
            font-size: {{ $basePt }}pt;
            font-weight: 700;
            letter-spacing: 0.04em;
            margin-top: 2mm;
            padding-bottom: 0.5mm;
            text-transform: uppercase;
        }

        .items {
            margin-top: 0.6mm;
        }

        .items thead {
            display: table-header-group;
        }

        .items th {
            border-bottom: 0.5pt solid #000;
            border-top: 0.5pt solid #000;
            font-size: {{ $basePt }}pt;
            font-weight: 700;
            padding: 0.8mm 0;
            text-align: left;
            text-transform: uppercase;
        }

        .items th.qty {
            text-align: right;
            width: 8mm;
        }

        .items th.amount {
            text-align: right;
            width: {{ $amountWidthMm }}mm;
        }

        .items td {
            border-bottom: 0.5pt solid #000;
            font-size: {{ $basePt }}pt;
            padding: 0.8mm 0;
        }

        .items tr {
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .items td.desc {
            word-wrap: break-word;
        }

        .items td.qty {
            text-align: right;
            white-space: nowrap;
        }

        .items td.amount {
            font-weight: 700;
            text-align: right;
            white-space: nowrap;
        }

        .item-name {
            font-weight: 700;
            word-wrap: break-word;
        }

        .item-sub {
            font-size: {{ $basePt }}pt;
            line-height: 1.15;
            word-wrap: break-word;
        }

        .tag-free {
            border: 0.5pt solid #000;
            display: inline-block;
            font-size: {{ $basePt }}pt;
            font-weight: 700;
            margin-top: 0.3mm;
            padding: 0 0.6mm;
            text-transform: uppercase;
        }

        .payments {
            margin-top: 1mm;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .payment {
            border-bottom: 0.5pt solid #000;
            font-size: {{ $basePt }}pt;
            padding: 0.6mm 0;
            word-wrap: break-word;
        }

        .totals {
            font-size: {{ $totalPt }}pt;
            margin-top: 1.2mm;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .totals td {
            padding: 0.35mm 0;
        }

        .totals .amount {
            text-align: right;
            white-space: nowrap;
            width: 50%;
        }

        .totals .grand td {
            border-bottom: 0.75pt solid #000;
            border-top: 0.75pt solid #000;
            font-weight: 700;
            padding: 0.6mm 0;
            text-transform: uppercase;
        }

        .amount-words {
            border-top: 0.5pt solid #000;
            font-size: {{ $basePt }}pt;
            line-height: 1.2;
            margin-top: 1mm;
            padding-top: 0.8mm;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .amount-scope {
            display: block;
            margin-top: 0.5mm;
        }

        .signatures {
            margin-top: 3mm;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .signature {
            margin-top: 4mm;
            text-align: center;
        }

        .signature-space {
            height: 8mm;
        }

        .signature-rule {
            border-top: 0.5pt solid #000;
            margin: 0 auto;
            width: 82%;
        }

        .signature-caption {
            font-size: {{ $basePt }}pt;
            font-weight: 700;
            padding-top: 0.8mm;
            text-transform: uppercase;
        }

        .legend {
            border-top: 0.5pt solid #000;
            font-size: {{ $basePt }}pt;
            line-height: 1.15;
            margin-top: 2mm;
            padding-top: 0.8mm;
            text-align: center;
            text-transform: uppercase;
            word-wrap: break-word;
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

    $paymentLabel = static fn (?string $method): string => match ($method) {
        'cash' => 'Efectivo',
        'transfer' => 'Transferencia',
        'card' => 'Tarjeta',
        'other' => 'Otro',
        default => $method ?: 'No registrado',
    };

    $parseMoneyCents = static function (mixed $value): ?int {
        try {
            if (! is_int($value) && ! is_string($value)) {
                return null;
            }

            return \App\Support\Money::parseCents((string) $value, 'receipt_amount');
        } catch (\Throwable) {
            return null;
        }
    };

    $formatMoney = static function (mixed $value) use ($parseMoneyCents): ?string {
        $cents = $parseMoneyCents($value);

        if ($cents === null) {
            return null;
        }

        $absolute = abs($cents);
        $whole = number_format(intdiv($absolute, 100), 0, '.', ',');
        $decimal = str_pad((string) ($absolute % 100), 2, '0', STR_PAD_LEFT);

        return ($cents < 0 ? '-' : '').$whole.'.'.$decimal;
    };

    $moneyLabel = static function (mixed $value) use ($formatMoney): string {
        $formatted = $formatMoney($value);

        return $formatted === null ? '—' : 'L. '.$formatted;
    };

    $negativeMoneyLabel = static function (mixed $value) use ($formatMoney): string {
        $formatted = $formatMoney($value);

        return $formatted === null ? '—' : '- L. '.$formatted;
    };
@endphp
@foreach ($pages as $page)
    @php
        $invoice = $page['invoice'];
        $payment = $page['payment'];
        $items = $page['items'];
        $isVoid = (string) $page['status'] === 'void';
        $taxBreakdown = is_array($invoice['tax_breakdown'] ?? null) ? $invoice['tax_breakdown'] : [];

        $exemptGroup = null;

        foreach ($taxBreakdown as $group) {
            if (is_array($group) && ($group['rate'] ?? null) === '0.00') {
                $exemptGroup = $group;
                break;
            }
        }

        $exemptAmount = $invoice['exempt_amount'] ?? ($exemptGroup['base'] ?? null);

        $cashier = $payment['selected_payment']['cashier_name']
            ?? $payment['issued_by']['name']
            ?? $payment['cash_context']['cashier_name']
            ?? null;

        $postedPayments = collect($payment['posted_payments'] ?? [])
            ->filter(fn (mixed $item): bool => is_array($item))
            ->values();
        $displayPayments = $postedPayments->isNotEmpty()
            ? $postedPayments
            : collect(is_array($payment['selected_payment'] ?? null) ? [$payment['selected_payment']] : []);
        $hasMultiplePayments = $displayPayments->count() > 1;

        $hasFiscal = ! empty($invoice['fiscal_cai'])
            || ! empty($invoice['fiscal_range_from'])
            || ! empty($invoice['fiscal_range_to'])
            || ! empty($invoice['fiscal_valid_until']);

        $contactParts = collect([
            $page['institution']['address'] ?? null,
            $page['institution']['receipt_location'] ?? null,
        ])->filter(fn (mixed $value): bool => is_string($value) && trim($value) !== '')->values();

        if ($contactParts->count() === 2) {
            $first = (string) $contactParts[0];
            $second = (string) $contactParts[1];

            if (str_contains($second, $first)) {
                $contactParts = collect([$second]);
            } elseif (str_contains($first, $second)) {
                $contactParts = collect([$first]);
            }
        }

        $contactLine = $contactParts->implode(' · ');

        $totalCents = $parseMoneyCents($invoice['total'] ?? null);
        $balanceDueCents = $parseMoneyCents($invoice['balance_due'] ?? null);
        $situation = $totalCents === null || $balanceDueCents === null
            ? 'Estado no disponible'
            : ($totalCents === 0
                ? 'Emitido sin cobro'
                : ($balanceDueCents === 0 ? 'Pagado' : 'Saldo pendiente'));
        $discount = (float) ($invoice['discount_amount'] ?? 0);
    @endphp
    <section
        class="receipt-page"
        data-receipt-composition="single"
        data-receipt-style="thermal-monochrome"
        data-receipt-thermal="{{ $isNarrow ? '58' : '80' }}"
    >
        <div class="ticket" data-receipt-width-mm="{{ $contentMm }}">
            @if ($page['draft'])
                <div class="notice">{{ $page['watermark'] }}</div>
            @endif
            @if (! empty($page['test_notice']))
                <div class="notice" data-receipt-test-notice>{{ $page['test_notice'] }}</div>
            @endif

            <header class="masthead">
                @if (! empty($page['institution']['logo_data_uri']))
                    <img class="logo" src="{{ $page['institution']['logo_data_uri'] }}" alt="">
                @endif
                @if (! empty($page['institution']['government_line']))
                    <div class="gov-line">{{ $page['institution']['government_line'] }}</div>
                @endif
                @if (! empty($page['institution']['secretariat_line']))
                    <div class="gov-line">{{ $page['institution']['secretariat_line'] }}</div>
                @endif
                <div class="hospital">{{ $page['institution']['hospital_name'] }}</div>
                @if ($contactLine !== '')
                    <div class="contact">{{ $contactLine }}</div>
                @endif
                @if (! empty($page['institution']['rtn']) || ! empty($page['institution']['phone']))
                    <div class="contact">
                        @if (! empty($page['institution']['rtn']))RTN {{ $page['institution']['rtn'] }}@endif
                        @if (! empty($page['institution']['rtn']) && ! empty($page['institution']['phone'])) · @endif
                        @if (! empty($page['institution']['phone']))Tel. {{ $page['institution']['phone'] }}@endif
                    </div>
                @endif
            </header>

            <div class="doc-title">Recibo institucional</div>
            <div class="doc-flags">
                <span data-receipt-copy-label="{{ $page['copy_label'] }}">{{ $page['copy_label'] }}</span>
                @if (! empty($page['reprint_label']))
                    · {{ $page['reprint_label'] }}
                @endif
                @if ($isVoid)
                    · Anulado
                @endif
            </div>

            <table class="doc-band">
                <tr>
                    <td class="key">Recibo No.</td>
                    <td class="doc-number">{{ $page['series']['receipt_number_full'] }}</td>
                </tr>
                <tr>
                    <td class="key">Fecha y hora</td>
                    <td>{{ $formatDate($page['issued_at']) }}</td>
                </tr>
            </table>

            <div class="patient">
                <div class="label">Paciente</div>
                <div class="patient-name">{{ $page['payer_name'] }}</div>
            </div>

            <table class="meta">
                <tr>
                    <td class="key">Factura</td>
                    <td class="value">{{ $invoice['invoice_number'] ?: 'No registrada' }}</td>
                </tr>
                <tr>
                    <td class="key">Cajero</td>
                    <td class="value">{{ $cashier ?: 'No registrado' }}</td>
                </tr>
                <tr>
                    <td class="key">Caja</td>
                    <td class="value">{{ $payment['cash_context']['cash_register_label'] ?? 'No registrada' }}</td>
                </tr>
                @if ($hasFiscal)
                    @if (! empty($invoice['fiscal_cai']))
                        <tr>
                            <td class="key">CAI</td>
                            <td class="value">{{ $invoice['fiscal_cai'] }}</td>
                        </tr>
                    @endif
                    @if (! empty($invoice['fiscal_range_from']) || ! empty($invoice['fiscal_range_to']))
                        <tr>
                            <td class="key">Rango</td>
                            <td class="value">{{ $invoice['fiscal_range_from'] ?: '—' }} a {{ $invoice['fiscal_range_to'] ?: '—' }}</td>
                        </tr>
                    @endif
                    @if (! empty($invoice['fiscal_valid_until']))
                        <tr>
                            <td class="key">Límite</td>
                            <td class="value">{{ $formatDateOnly($invoice['fiscal_valid_until']) }}</td>
                        </tr>
                    @endif
                @endif
            </table>

            <div class="section-title">Detalle de servicios</div>
            <table class="items">
                <thead>
                    <tr>
                        <th class="desc">Descripción</th>
                        @if (! $isNarrow)
                            <th class="qty">Cant.</th>
                        @endif
                        <th class="amount">Importe</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($items as $item)
                        @php
                            $isFreeLine = ! empty($item['rule_adjusted']);
                            $lineAdjustment = $item['adjustment'] ?? null;
                            $adjustmentUnknown = (bool) ($item['adjustment_unknown'] ?? false);
                            $itemDescriptors = collect([$item['category_name'] ?? null, $item['area_name'] ?? null])
                                ->filter(fn ($value) => is_string($value) && trim($value) !== '')
                                ->map(fn (string $value) => trim($value))
                                ->unique()
                                ->values();
                            $priceLabel = $moneyLabel($item['reference_unit_price'] ?? $item['unit_price'] ?? null);
                        @endphp
                        <tr>
                            <td class="desc">
                                <span class="item-name">{{ $item['service_name'] ?: 'Servicio hospitalario' }}</span>
                                @if ($isFreeLine)
                                    <span class="tag-free">Sin cobro por receta</span>
                                @endif
                                <div class="item-sub">
                                    @if ($isNarrow){{ $item['quantity'] }} · @endif
                                    {{ $priceLabel }}
                                    @if ($lineAdjustment !== null)
                                        · Ajuste {{ $negativeMoneyLabel($lineAdjustment) }}
                                    @elseif ($adjustmentUnknown)
                                        · Ajuste {{ $unknownAdjustmentLabel }}
                                    @endif
                                </div>
                                @if ($itemDescriptors->isNotEmpty())
                                    <div class="item-sub">{{ $itemDescriptors->implode(' / ') }}</div>
                                @endif
                                @if (! empty($item['notes']))
                                    <div class="item-sub">{{ $item['notes'] }}</div>
                                @endif
                            </td>
                            @if (! $isNarrow)
                                <td class="qty">{{ $item['quantity'] }}</td>
                            @endif
                            <td class="amount">{{ $moneyLabel($item['line_subtotal'] ?? null) }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td class="desc" colspan="{{ $isNarrow ? 2 : 3 }}">Servicios hospitalarios</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>

            @if ($hasMultiplePayments)
                <div class="section-title">Pagos aplicados</div>
                <div class="payments">
                    @foreach ($displayPayments as $index => $postedPayment)
                        <div class="payment">
                            Pago {{ $index + 1 }} · {{ $paymentLabel($postedPayment['method'] ?? null) }}
                            · {{ $moneyLabel($postedPayment['amount'] ?? null) }}
                            @if (! empty($postedPayment['reference']))
                                · Ref. {{ $postedPayment['reference'] }}
                            @endif
                            @if (! empty($postedPayment['cashier_name']))
                                · {{ $postedPayment['cashier_name'] }}
                            @endif
                        </div>
                    @endforeach
                </div>
            @endif

            <div class="label" style="margin-top: 1.5mm;">Situación del pago</div>
            <div>{{ $situation }}@if ($balanceDueCents !== null && $balanceDueCents > 0) · Saldo {{ $moneyLabel($invoice['balance_due']) }}@endif</div>

            <table class="totals" data-receipt-thermal-totals>
                <tr>
                    <td>Subtotal</td>
                    <td class="amount">{{ $moneyLabel($invoice['subtotal']) }}</td>
                </tr>
                <tr>
                    <td>Exento</td>
                    <td class="amount">{{ $moneyLabel($exemptAmount) }}</td>
                </tr>
                @foreach ($taxBreakdown as $group)
                    @continue(is_array($group) && ($group['rate'] ?? null) === '0.00')
                    <tr>
                        <td>{{ $group['base_label'] }}</td>
                        <td class="amount">{{ $moneyLabel($group['base']) }}</td>
                    </tr>
                    <tr>
                        <td>{{ $group['tax_label'] }}</td>
                        <td class="amount">{{ $moneyLabel($group['tax']) }}</td>
                    </tr>
                @endforeach
                @if ($discount != 0.0)
                    <tr>
                        <td>Ajustes autorizados</td>
                        <td class="amount">{{ $negativeMoneyLabel($invoice['discount_amount']) }}</td>
                    </tr>
                @endif
                <tr class="grand">
                    <td>Total</td>
                    <td class="amount">{{ $moneyLabel($invoice['total']) }}</td>
                </tr>
                <tr>
                    <td>Pagado</td>
                    <td class="amount">{{ $moneyLabel($invoice['paid_amount']) }}</td>
                </tr>
                <tr>
                    <td>Saldo</td>
                    <td class="amount">{{ $moneyLabel($invoice['balance_due']) }}</td>
                </tr>
            </table>

            @if (! empty($page['amount_statement']))
                <div class="amount-words">
                    <span class="label">Monto en letras</span><br>
                    {{ $page['amount_statement'] }}
                    @if (! empty($page['amount_total_note']))
                        <span class="amount-scope">{{ $page['amount_total_note'] }}</span>
                    @endif
                </div>
            @endif

            <div class="signatures">
                <div class="signature">
                    <div class="signature-space"></div>
                    <div class="signature-rule"></div>
                    <div class="signature-caption">Firma del enterante</div>
                </div>
                <div class="signature">
                    <div class="signature-space"></div>
                    <div class="signature-rule"></div>
                    <div class="signature-caption">Sello y firma autorizada</div>
                </div>
            </div>

            @if ($profile['show_copy_legend'] && ! empty($page['institution']['receipt_footer_text']))
                <div class="legend">{{ $page['institution']['receipt_footer_text'] }}</div>
            @endif
        </div>
    </section>
@endforeach
</body>
</html>
