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
            color: #000;
            font-family: {{ $profile['font_family'] }};
            font-size: {{ 11 * $profile['font_scale'] }}px;
            line-height: 1.35;
            margin: 0;
        }

        .receipt-page {
            page-break-after: always;
            position: relative;
            width: 100%;
        }

        .receipt-page:last-child {
            page-break-after: auto;
        }

        .draft-watermark {
            border: 2px solid #000;
            font-size: 22px;
            font-weight: bold;
            letter-spacing: 1px;
            margin-bottom: 8px;
            padding: 4px 8px;
            text-align: center;
        }

        .header {
            text-align: center;
            text-transform: uppercase;
        }

        .header div {
            margin: 0;
        }

        .hospital {
            font-size: {{ 15 * $profile['font_scale'] }}px;
            font-weight: bold;
        }

        .meta {
            margin-top: 12px;
            width: 100%;
        }

        .meta td {
            padding: 2px 0;
            vertical-align: top;
        }

        .receipt-number {
            font-size: {{ 18 * $profile['font_scale'] }}px;
            font-weight: bold;
        }

        .label {
            font-weight: bold;
            white-space: nowrap;
        }

        .field-row {
            margin-top: 9px;
        }

        .field-label {
            display: inline-block;
            font-weight: bold;
            width: 36px;
        }

        .field-value {
            border-bottom: 1px solid #000;
            display: inline-block;
            min-height: 18px;
            padding-left: 4px;
            vertical-align: bottom;
            width: calc(100% - 42px);
        }

        .concept {
            min-height: 42px;
        }

        .signatures {
            margin-top: 36px;
            width: 100%;
        }

        .signatures td {
            text-align: center;
            width: 50%;
        }

        .signature-line {
            border-top: 1px solid #000;
            display: inline-block;
            padding-top: 4px;
            width: 70%;
        }

        .blank-area {
            border: 1px solid #000;
            display: inline-block;
            height: 48px;
            margin-bottom: 4px;
            width: 70%;
        }

        .copy-legend {
            border-top: 1px solid #000;
            font-size: {{ 10 * $profile['font_scale'] }}px;
            margin-top: 18px;
            padding-top: 5px;
            text-align: center;
            text-transform: uppercase;
        }
    </style>
</head>
<body>
@foreach ($pages as $page)
    <section class="receipt-page">
        @if ($page['draft'])
            <div class="draft-watermark">{{ $page['watermark'] }}</div>
        @endif

        <div class="header">
            <div><strong>Gobierno:</strong> {{ $page['institution']['government_line'] }}</div>
            <div><strong>Dependencia:</strong> {{ $page['institution']['secretariat_line'] }}</div>
            <div class="hospital">Hospital: {{ $page['institution']['hospital_name'] }}</div>
            <div>{{ $page['institution']['address'] }}</div>
            <div><strong>Localidad:</strong> {{ $page['institution']['receipt_location'] }}</div>
        </div>

        <table class="meta">
            <tr>
                <td style="width: 55%;">
                    <span class="label">Recibo No.</span>
                    <span class="receipt-number" style="color: {{ $page['series']['receipt_number_color'] }};">
                        {{ $page['series']['receipt_number_full'] }}
                    </span>
                </td>
                <td>
                    <span class="label">Serie:</span> {{ $page['series']['series'] }}
                </td>
            </tr>
            <tr>
                <td>
                    <span class="label">Monto:</span> L. {{ $page['amount'] }}
                </td>
                <td>
                    <span class="label">Fecha:</span>
                    {{ $page['issued_at'] instanceof \Illuminate\Support\Carbon ? $page['issued_at']->format('d/m/Y H:i') : \Illuminate\Support\Carbon::parse($page['issued_at'])->format('d/m/Y H:i') }}
                </td>
            </tr>
        </table>

        <div class="field-row">
            <span class="field-label">El</span>
            <span class="field-value">{{ $page['payer_name'] }}</span>
        </div>
        <div class="field-row">
            <span class="field-label">Que</span>
            <span class="field-value">{{ $page['amount_words'] }}</span>
        </div>
        <div class="field-row">
            <span class="field-label">Por</span>
            <span class="field-value concept">{{ $page['concept'] }}</span>
        </div>

        <table class="signatures">
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
            <div class="copy-legend">{{ $page['copy_label'] }} - {{ $page['institution']['receipt_footer_text'] }}</div>
        @endif
    </section>
@endforeach
</body>
</html>
