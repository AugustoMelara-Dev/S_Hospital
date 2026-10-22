{{--
    Cuerpo de UN ejemplar del comprobante institucional (familia compacta).

    Un solo origen para las tres composiciones que comparten contenido financiero:
    la copia única en carta/A4 vertical, el ejemplar de media carta y cada zona de
    la hoja con dos ejemplares. El llamador aporta el contenedor (`.receipt-page`,
    `.receipt-layout`) y, cuando corresponde, `$destination`.

    Orden narrativo: identidad institucional → identidad del documento (título,
    marca de copia/destino, número, fecha) → paciente → operación → detalle →
    pagos → situación/totales → importe en letras → firma/sello → leyenda.

    Contrato de contenido (C2-B7):
    - `Precio unitario` de una línea con ajuste autorizado es el precio REGISTRADO
      (de catálogo antes de la regla), de modo que precio − ajuste = importe.
    - `Ajuste autorizado` imprime solo una magnitud que el expediente realmente
      guardó. Cuando la línea declara `rule_adjustment_persisted = false` el dato es
      DESCONOCIDO y se imprime "No registrado": nunca `L. 0.00`, que afirmaría un
      cero medido que el registro histórico no tiene.
    - La línea beneficiada conserva su lugar, su precio de referencia, su ajuste,
      su importe `L. 0.00` y la marca "Sin cobro por receta". Un servicio cuyo
      precio autorizado ya era cero no se presenta como gratuidad por receta.
    - El importe en letras corresponde al importe al que se refiere (recibido); un
      cero legítimo usa redacción de gratuidad y nunca afirma que se recibió
      efectivo. Sin CAI, RTN, tasas, logos, firmas ni sellos inventados.
--}}
@php
    $invoice = $page['invoice'];
    $payment = $page['payment'];
    $items = $page['items'];
    $isVoid = (string) $page['status'] === 'void';
    $destination = $destination ?? null;

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

    $paymentCount = $displayPayments->count();
    $hasMultiplePayments = $paymentCount > 1;
    $hasMixedMethods = $displayPayments->pluck('method')->filter()->unique()->count() > 1;
    $paymentMethodSummary = $hasMixedMethods
        ? 'Pagos mixtos ('.$paymentCount.')'
        : ($hasMultiplePayments
            ? $paymentCount.' pagos de '.$paymentLabel($displayPayments->first()['method'] ?? null)
            : $paymentLabel($displayPayments->first()['method'] ?? null));

    $discount = (float) ($invoice['discount_amount'] ?? 0);
    $taxBreakdown = is_array($invoice['tax_breakdown'] ?? null) ? $invoice['tax_breakdown'] : [];
    $exemptGroup = null;

    foreach ($taxBreakdown as $group) {
        if (is_array($group) && ($group['rate'] ?? null) === '0.00') {
            $exemptGroup = $group;
            break;
        }
    }

    $exemptAmount = $invoice['exempt_amount'] ?? ($exemptGroup['base'] ?? null);

    $hasFiscal = ! empty($invoice['fiscal_cai'])
        || ! empty($invoice['fiscal_range_from'])
        || ! empty($invoice['fiscal_range_to'])
        || ! empty($invoice['fiscal_valid_until']);

    // Las líneas de contacto institucional solo se imprimen cuando el snapshot
    // realmente las trae; un campo vacío nunca se convierte en marcador. Cuando la
    // dirección configurada ya está contenida en la ubicación del recibo (solape
    // frecuente de configuración) se imprime solo la más completa, para que la
    // cabecera no repita la misma ciudad dos veces.
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

    $copyDestinationLabel = $destination !== null
        ? (string) $page['copy_label'].' · '.$destination
        : (string) $page['copy_label'];

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

    $totalCents = $parseMoneyCents($invoice['total'] ?? null);
    $balanceDueCents = $parseMoneyCents($invoice['balance_due'] ?? null);
    $situation = $totalCents === null || $balanceDueCents === null
        ? 'Estado no disponible'
        : ($totalCents === 0
            ? 'Emitido sin cobro'
            : ($balanceDueCents === 0 ? 'Pagado' : 'Saldo pendiente'));
    $showBalance = $balanceDueCents !== null && $balanceDueCents > 0;
@endphp
@if ($page['draft'])
    <div class="draft-watermark">{{ $page['watermark'] }}</div>
@endif
@if (! empty($page['test_notice']))
    <div class="draft-watermark" data-receipt-test-notice>{{ $page['test_notice'] }}</div>
@endif

<header class="masthead">
    @if (! empty($page['institution']['logo_data_uri']))
        <img class="logo" src="{{ $page['institution']['logo_data_uri'] }}" alt="">
    @endif
    <div class="masthead-lines">
        @if (! empty($page['institution']['government_line']))
            <span class="masthead-line">{{ $page['institution']['government_line'] }}</span>
        @endif
        @if (! empty($page['institution']['government_line']) && ! empty($page['institution']['secretariat_line']))
            <span class="masthead-sep" aria-hidden="true"> · </span>
        @endif
        @if (! empty($page['institution']['secretariat_line']))
            <span class="masthead-line">{{ $page['institution']['secretariat_line'] }}</span>
        @endif
    </div>
    <div class="hospital-name">{{ $page['institution']['hospital_name'] }}</div>
    <div class="masthead-contact-line">
        @if ($contactLine !== '')
            <span class="masthead-contact">{{ $contactLine }}</span>
        @endif
        @if (! empty($page['institution']['rtn']) || ! empty($page['institution']['phone']))
            @if ($contactLine !== '')<span class="masthead-sep" aria-hidden="true"> · </span>@endif
            <span class="masthead-contact">
                @if (! empty($page['institution']['rtn']))RTN {{ $page['institution']['rtn'] }}@endif
                @if (! empty($page['institution']['rtn']) && ! empty($page['institution']['phone'])) · @endif
                @if (! empty($page['institution']['phone']))Tel. {{ $page['institution']['phone'] }}@endif
            </span>
        @endif
    </div>
</header>

<table class="doc-band">
    <tr>
        <td style="width: 55%;">
            <div class="doc-title">Recibo institucional</div>
            <div class="doc-flags">
                <span
                    class="chip{{ $destination !== null ? ' chip-destination' : '' }}"
                    data-receipt-copy-label="{{ $page['copy_label'] }}"
                >{{ $copyDestinationLabel }}</span>
                @if (! empty($page['reprint_label']))
                    <span class="chip">{{ $page['reprint_label'] }}</span>
                @endif
                @if ($isVoid)
                    <span class="chip chip-void">Anulado</span>
                @endif
            </div>
        </td>
        <td style="text-align: right; width: 45%;">
            <div class="label">Recibo No.</div>
            <div class="doc-number">{{ $page['series']['receipt_number_full'] }}</div>
            <div class="doc-issued">
                <span class="label">Fecha y hora</span> {{ $formatDate($page['issued_at']) }}
            </div>
        </td>
    </tr>
</table>

<table class="patient-block">
    <tr>
        <td>
            <span class="label label-block">Paciente</span>
            <span class="patient-name">{{ $page['payer_name'] }}</span>
        </td>
    </tr>
</table>

<table class="meta">
    <tr>
        <td style="width: 40%;">
            <span class="label">Factura</span>
            <span class="meta-value">{{ $invoice['invoice_number'] ?: 'No registrada' }}</span>
        </td>
        <td style="width: 33%;">
            <span class="label">Cajero</span>
            <span class="meta-value">{{ $cashier ?: 'No registrado' }}</span>
        </td>
        <td>
            <span class="label">Caja</span>
            <span class="meta-value">{{ $payment['cash_context']['cash_register_label'] ?? 'No registrada' }}</span>
        </td>
    </tr>
    @if ($hasFiscal)
        <tr>
            <td colspan="2">
                {{--
                    Metadatos fiscales en UNA línea compartida (encargo §4:
                    «metadatos en líneas compartidas»). Antes el rango y el límite
                    se apilaban con un `<br>`, y ese renglón extra era suficiente
                    para empujar a una segunda página un comprobante de 11
                    conceptos con el bloque fiscal presente — el caso real.
                --}}
                @if (! empty($invoice['fiscal_cai']))
                    <span class="label">CAI</span>
                    <span class="meta-value">{{ $invoice['fiscal_cai'] }}</span>
                @endif
                @if (! empty($invoice['fiscal_range_from']) || ! empty($invoice['fiscal_range_to']))
                    <span class="label label-inline">Rango</span>
                    <span class="meta-value">{{ $invoice['fiscal_range_from'] ?: '—' }} a {{ $invoice['fiscal_range_to'] ?: '—' }}</span>
                @endif
                @if (! empty($invoice['fiscal_valid_until']))
                    <span class="label label-inline">Límite</span>
                    <span class="meta-value">{{ $formatDateOnly($invoice['fiscal_valid_until']) }}</span>
                @endif
            </td>
        </tr>
    @endif
</table>

<div class="section-title">Detalle de servicios</div>
<table class="items-table">
    <thead>
        <tr>
            <th style="width: 39%;">Descripción</th>
            <th style="width: 9%;" class="qty">Cantidad</th>
            <th style="width: 17%;" class="money">Precio unitario</th>
            <th style="width: 18%;" class="money">Ajuste autorizado</th>
            <th style="width: 17%;" class="money">Importe</th>
        </tr>
    </thead>
    <tbody>
        @forelse ($items as $item)
            @php
                // La gratuidad por receta procede del snapshot autorizado de la
                // línea. Un importe cero, por sí solo, también puede ser el precio
                // legítimo del catálogo y no demuestra aplicación de la regla.
                $isFreeLine = ! empty($item['rule_adjusted']);
                $lineAdjustment = $item['adjustment'] ?? null;
                $adjustmentUnknown = (bool) ($item['adjustment_unknown'] ?? false);
                $itemDescriptors = collect([$item['category_name'] ?? null, $item['area_name'] ?? null])
                    ->filter(fn ($value) => is_string($value) && trim($value) !== '')
                    ->map(fn (string $value) => trim($value))
                    ->unique()
                    ->values();
            @endphp
            <tr>
                <td>
                    <span class="item-name">{{ $item['service_name'] ?: 'Servicio hospitalario' }}</span>
                    @if ($isFreeLine)
                        <span class="tag-free">Sin cobro por receta</span>
                    @endif
                    @if ($itemDescriptors->isNotEmpty())
                        <span class="item-meta">· {{ $itemDescriptors->implode(' / ') }}</span>
                    @endif
                    @if (! empty($item['notes']))
                        <span class="item-notes">{{ $item['notes'] }}</span>
                    @endif
                </td>
                <td class="qty">{{ $item['quantity'] }}</td>
                <td class="money">{{ $moneyLabel($item['reference_unit_price'] ?? $item['unit_price']) }}</td>
                <td class="money">
                    @if ($lineAdjustment !== null)
                        {{ $negativeMoneyLabel($lineAdjustment) }}
                    @elseif ($adjustmentUnknown)
                        <span class="cell-unknown">{{ $unknownAdjustmentLabel }}</span>
                    @endif
                </td>
                {{--
                    Importe de línea SIN impuesto (H-08): cantidad × precio −
                    ajuste. El ISV se desglosa una sola vez en los totales por
                    tasa, nunca dentro de la línea.
                --}}
                <td class="money money-strong">{{ $moneyLabel($item['line_subtotal'] ?? null) }}</td>
            </tr>
        @empty
            <tr>
                <td colspan="5">Servicios hospitalarios</td>
            </tr>
        @endforelse
    </tbody>
</table>

@if ($hasMultiplePayments)
    <div class="section-title">Pagos aplicados</div>
    <table class="payments-table">
        <thead>
            <tr>
                <th style="width: 22%;">Fecha</th>
                <th style="width: 20%;">Método</th>
                <th style="width: 16%;" class="money">Monto</th>
                <th style="width: 24%;">Referencia</th>
                <th style="width: 18%;">Cajero</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($displayPayments as $postedPayment)
                <tr>
                    <td>{{ $formatDate($postedPayment['paid_at'] ?? null) ?: 'No registrada' }}</td>
                    <td>{{ $paymentLabel($postedPayment['method'] ?? null) }}</td>
                    <td class="money">{{ $moneyLabel($postedPayment['amount'] ?? null) }}</td>
                    <td>{{ $postedPayment['reference'] ?? 'Sin referencia' }}</td>
                    <td>{{ $postedPayment['cashier_name'] ?? 'No registrado' }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
@endif

<div class="receipt-summary">
    <table class="closing-block">
        <tr>
            <td class="closing-left">
                <span class="label label-block">Situación del pago</span>
                <div class="{{ $showBalance ? 'situation-pending' : 'situation-value' }}">
                    {{ $situation }}@if ($showBalance) · Saldo {{ $moneyLabel($invoice['balance_due']) }}@endif
                </div>

                <div class="method-line">
                    <span class="label label-block">Método aplicable</span>
                    @if ($hasMultiplePayments)
                        {{ $paymentMethodSummary }} · Total pagado {{ $moneyLabel($invoice['paid_amount']) }}
                    @elseif ($paymentCount === 0)
                        {{ $totalCents === 0 ? 'Sin cobro' : 'No registrado' }}
                    @else
                        {{ $paymentMethodSummary }} · {{ $moneyLabel($displayPayments->first()['amount'] ?? null) }}
                        @if (! empty($displayPayments->first()['reference']))
                            · Ref. {{ $displayPayments->first()['reference'] }}
                        @endif
                    @endif
                </div>

                @if (! empty($page['amount_statement']))
                    <div class="amount-words">
                        <span class="label label-block">Monto en letras</span>
                        {{ $page['amount_statement'] }}
                        @if (! empty($page['amount_total_note']))
                            <span class="amount-scope">{{ $page['amount_total_note'] }}</span>
                        @endif
                    </div>
                @endif
            </td>
            <td class="closing-right">
                <table class="totals-table">
                    <tr>
                        <td>Subtotal</td>
                        <td class="money">{{ $moneyLabel($invoice['subtotal']) }}</td>
                    </tr>
                    <tr>
                        <td>Exento</td>
                        <td class="money">{{ $moneyLabel($exemptAmount) }}</td>
                    </tr>
                    {{--
                        Desglose por tasa (H-08/F2C): una fila de base gravada y
                        una de impuesto por cada tasa. La tasa 0 % ya se muestra
                        arriba como «Exento» y no se duplica.
                    --}}
                    @foreach ($taxBreakdown as $group)
                        @continue(is_array($group) && ($group['rate'] ?? null) === '0.00')
                        <tr>
                            <td>{{ $group['base_label'] }}</td>
                            <td class="money">{{ $moneyLabel($group['base']) }}</td>
                        </tr>
                        <tr>
                            <td>{{ $group['tax_label'] }}</td>
                            <td class="money">{{ $moneyLabel($group['tax']) }}</td>
                        </tr>
                    @endforeach
                    @if ($discount != 0.0)
                        <tr>
                            <td>Ajustes autorizados</td>
                            <td class="money">{{ $negativeMoneyLabel($invoice['discount_amount']) }}</td>
                        </tr>
                    @endif
                    <tr class="grand-total">
                        <td>Total</td>
                        <td class="money">{{ $moneyLabel($invoice['total']) }}</td>
                    </tr>
                    <tr>
                        <td>Pagado</td>
                        <td class="money">{{ $moneyLabel($invoice['paid_amount']) }}</td>
                    </tr>
                    <tr>
                        <td>Saldo</td>
                        <td class="money">{{ $moneyLabel($invoice['balance_due']) }}</td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</div>

<table class="signature-grid">
    <tr>
        <td>
            <div class="signature-space"></div>
            <div class="signature-rule"></div>
            <div class="signature-caption">Firma del enterante</div>
        </td>
        <td>
            @if ($profile['show_physical_seal_space'])
                <div class="seal-space"></div>
            @else
                <div class="signature-space"></div>
            @endif
            <div class="signature-rule"></div>
            <div class="signature-caption">Sello y firma autorizada</div>
        </td>
    </tr>
</table>

@if ($profile['show_copy_legend'] && ! empty($page['institution']['receipt_footer_text']))
    <div class="copy-legend">{{ $page['institution']['receipt_footer_text'] }}</div>
@endif
