{{--
    Estilos de la familia COMPACTA MONOCROMA (T-RC-01 / C2-B7).

    Un solo origen de estilo para las tres composiciones que comparten contenido
    (una copia por página en carta/A4, media carta nativa, y dos ejemplares
    apilados en una hoja carta). `$density` selecciona la densidad:

    - `full`  : carta/A4 vertical. Detalle 14 px (~10.5 pt), 1-11 líneas por hoja.
    - `half`  : media carta (612 x 396 pt) y cada zona de la hoja de dos
                ejemplares. Condensa cabecera institucional, banda de operación y
                cierre/firma; el detalle conserva 14 px (~10.5 pt) para que el
                papel precortado siga siendo legible.

    Reglas del motor (Dompdf 3.x): solo tablas y bloques, sin flex/grid; anchos
    explícitos; `display: table-header-group` repite la cabecera de detalle si el
    documento fluye a otra página y `page-break-inside: avoid` mantiene cada fila
    indivisible. La página NUNCA es un bloque indivisible: un recibo largo
    continúa en una página legible adicional en vez de recortarse.

    Monocromo: jerarquía por tamaño, peso y grosor de regla. Sin color, sin
    relleno, sin QR, sin código de barras y sin códigos internos.
--}}
@php
    $isHalf = $density === 'half';
    $isPaired = ($composition ?? 'single') === 'paired';
    /*
     * Dos zonas en una hoja: cada zona dispone de media hoja útil. Se conserva
     * el margen superior configurado para que ninguna marca toque el borde físico;
     * solo el margen inferior puede compactarse. Si el contenido ya no cabe, el
     * constructor descarta esta composición y entrega una página por ejemplar.
     */
    $marginTopMm = (float) $profile['margin_top_mm'];
    $marginBottomMm = (float) $profile['margin_bottom_mm'];
    if ($isPaired) {
        $marginBottomMm = min($marginBottomMm, 6.0);
    }
@endphp
<style>
    @page {
        margin: {{ $marginTopMm }}mm {{ $profile['margin_right_mm'] }}mm {{ $marginBottomMm }}mm {{ $profile['margin_left_mm'] }}mm;
    }

    * {
        box-sizing: border-box;
    }

    body {
        background: #fff;
        color: #111827;
        font-family: {{ $profile['font_family'] }};
        font-size: {{ 14 * $profile['font_scale'] }}px;
        line-height: {{ $isHalf ? '1.2' : '1.35' }};
        margin: 0;
    }

    table {
        border-collapse: collapse;
        width: 100%;
    }

    .receipt-page {
        page-break-after: always;
    }

    .receipt-page:last-child {
        page-break-after: auto;
    }

    .receipt-layout {
        background: transparent;
        color: #111827;
    }

    /*
     * Zonas apiladas de la hoja de dos ejemplares. Cada zona es un ejemplar del
     * MISMO documento; no son bloques indivisibles, así que una operación larga
     * continúa en la página siguiente en vez de recortarse.
     */
    .zone {
        page-break-inside: auto;
        break-inside: auto;
    }

    .zone-archive {
        page-break-before: auto;
        break-before: auto;
    }

    /* Línea de corte: ayuda física de corte, nunca un sello de validez. */
    .cut-line {
        margin: {{ $isHalf ? '4px 0' : '8px 0' }};
        padding-top: 2px;
        border-top: 1px dashed #9ca3af;
        text-align: center;
        font-size: 8px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #6b7280;
    }

    /* Etiqueta en versalitas usada en toda la banda. */
    .label {
        color: #4b5563;
        font-size: 0.72em;
        font-weight: 700;
        letter-spacing: 0.07em;
        text-transform: uppercase;
    }

    .label-block {
        display: block;
    }

    /* ---------------------------------------------------------------
       Cabecera institucional: gobierno / secretaría / hospital.
       --------------------------------------------------------------- */

    .masthead {
        border-bottom: 2px solid #111827;
        padding-bottom: {{ $isHalf ? '4px' : '7px' }};
        text-align: center;
    }

    .logo {
        display: block;
        height: {{ $isHalf ? '18px' : '30px' }};
        margin: 0 auto {{ $isHalf ? '2px' : '4px' }};
        max-width: 72px;
    }

    .masthead-line {
        color: #4b5563;
        display: block;
        font-size: 0.74em;
        letter-spacing: 0.08em;
        line-height: {{ $isHalf ? '1.25' : '1.45' }};
        text-transform: uppercase;
    }

    .hospital-name {
        font-size: {{ $isHalf ? '1.3em' : '1.55em' }};
        font-weight: 700;
        letter-spacing: 0.005em;
        line-height: 1.2;
        margin: 1px 0;
        text-transform: uppercase;
    }

    .masthead-contact {
        color: #4b5563;
        display: block;
        font-size: 0.78em;
        line-height: {{ $isHalf ? '1.25' : '1.4' }};
    }

    /* Separador de los metadatos de contacto. Solo se muestra cuando la densidad
       compacta los une en una línea compartida (encargo §4). En carta, cada dato
       conserva su propio renglón. */
    .masthead-sep {
        display: none;
    }

    /* ---------------------------------------------------------------
       Identidad del documento: título + marcas de copia (izquierda),
       número y fecha (derecha).
       --------------------------------------------------------------- */

    .doc-band {
        border-bottom: 1px solid #111827;
        padding: {{ $isHalf ? '4px 0 3px' : '8px 0 7px' }};
    }

    .doc-band td {
        vertical-align: {{ $isHalf ? 'top' : 'bottom' }};
    }

    .doc-title {
        font-size: 1em;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
    }

    .doc-flags {
        margin-top: {{ $isHalf ? '2px' : '4px' }};
    }

    .chip {
        border: 1px solid #6b7280;
        color: #374151;
        display: inline-block;
        font-size: 0.72em;
        font-weight: 700;
        letter-spacing: 0.06em;
        padding: 1px 5px;
        text-transform: uppercase;
    }

    .chip + .chip {
        margin-left: 4px;
    }

    .chip-void {
        border-color: #111827;
        color: #111827;
    }

    /* Destino del ejemplar (paciente / archivo). Solo aparece cuando la hoja
       lleva dos ejemplares distintos; una copia suelta conserva su leyenda. */
    .chip-destination {
        border-color: #111827;
        color: #111827;
    }

    .doc-number {
        font-size: {{ $isHalf ? '1.25em' : '1.45em' }};
        font-weight: 700;
        letter-spacing: 0.01em;
        line-height: 1.15;
        white-space: nowrap;
    }

    .doc-issued {
        color: #374151;
        font-size: 0.82em;
        margin-top: 2px;
    }

    .doc-series {
        color: #4b5563;
        font-size: 0.82em;
    }

    .draft-watermark {
        border: 1.5px solid #111827;
        font-size: {{ $isHalf ? '12px' : '15px' }};
        font-weight: 700;
        letter-spacing: 0.05em;
        margin-bottom: {{ $isHalf ? '4px' : '6px' }};
        padding: 3px 6px;
        text-align: center;
        text-transform: uppercase;
    }

    /* ---------------------------------------------------------------
       Paciente: el único dato personal, con su propia banda.
       --------------------------------------------------------------- */

    .patient-block {
        border-bottom: 1px solid #e5e7eb;
        padding: {{ $isHalf ? '3px 0 3px' : '6px 0 5px' }};
    }

    .patient-name {
        font-size: {{ $isHalf ? '1.1em' : '1.15em' }};
        font-weight: 700;
        line-height: 1.25;
    }

    /* ---------------------------------------------------------------
       Banda de operación: factura / cajero / caja (+ fila fiscal si existe).
       --------------------------------------------------------------- */

    .meta td {
        border-bottom: 1px solid #e5e7eb;
        padding: {{ $isHalf ? '3px 12px 3px 0' : '5px 14px 5px 0' }};
        vertical-align: top;
    }

    .meta .label {
        margin-right: 5px;
    }

    .meta tr:last-child td {
        border-bottom: 0;
    }

    .meta-value {
        font-size: 0.94em;
    }

    /* ---------------------------------------------------------------
       Título de sección.
       --------------------------------------------------------------- */

    .section-title {
        border-bottom: 1px solid #111827;
        font-size: 0.78em;
        font-weight: 700;
        letter-spacing: 0.09em;
        margin-top: {{ $isHalf ? '5px' : '9px' }};
        padding-bottom: 3px;
        text-transform: uppercase;
        page-break-after: avoid;
    }

    /* ---------------------------------------------------------------
       Tabla de detalle: cabecera repetida, filas indivisibles.
       --------------------------------------------------------------- */

    .items-table {
        margin-top: 2px;
    }

    .items-table thead {
        display: table-header-group;
    }

    .items-table th {
        border-bottom: 1px solid #111827;
        color: #111827;
        font-size: 0.74em;
        font-weight: 700;
        letter-spacing: 0.05em;
        padding: {{ $isHalf ? '3px 5px' : '4px 5px' }};
        text-align: left;
        text-transform: uppercase;
        vertical-align: bottom;
    }

    .items-table th.money + th.money,
    .items-table td.money + td.money {
        padding-left: {{ $isHalf ? '9px' : '11px' }};
    }

    .items-table td {
        border-bottom: 1px solid #e5e7eb;
        padding: {{ $isHalf ? '3px 5px' : '5px' }};
        vertical-align: top;
    }

    .items-table tbody tr {
        page-break-inside: avoid;
        break-inside: avoid;
    }

    .items-table tbody tr:last-child td {
        border-bottom: 1px solid #9ca3af;
    }

    .qty,
    .money {
        font-variant-numeric: tabular-nums;
        text-align: right;
        white-space: nowrap;
    }

    /* Categoría/área viajan EN LÍNEA tras el nombre del servicio: una segunda
       línea por fila es lo que antes empujaba un recibo de 11 líneas a otra
       página. */
    .item-meta {
        color: #6b7280;
        font-size: 0.78em;
    }

    .item-notes {
        color: #6b7280;
        display: block;
        font-size: 0.78em;
    }

    .tag-free {
        border: 1px solid #111827;
        display: inline-block;
        font-size: 0.7em;
        font-weight: 700;
        letter-spacing: 0.06em;
        margin-left: 5px;
        padding: 0 4px;
        text-transform: uppercase;
    }

    .items-table .money-strong {
        font-weight: 700;
    }

    /* Dato ausente: se DECLARA que no está registrado en vez de imprimir un
       0 que el expediente nunca midió. */
    .cell-unknown {
        color: #4b5563;
        font-size: 0.82em;
        font-style: italic;
    }

    /* ---------------------------------------------------------------
       Pagos aplicados (solo en recibos con varios pagos).
       --------------------------------------------------------------- */

    .payments-table {
        margin-top: 3px;
    }

    .payments-table th {
        border-bottom: 1px solid #9ca3af;
        color: #374151;
        font-size: 0.74em;
        font-weight: 700;
        padding: 3px 5px;
        text-align: left;
        text-transform: uppercase;
    }

    .payments-table td {
        border-bottom: 1px solid #e5e7eb;
        padding: 3px 5px;
        vertical-align: top;
    }

    .payments-table tbody tr {
        page-break-inside: avoid;
        break-inside: avoid;
    }

    /* ---------------------------------------------------------------
       Cierre: situación + método (izquierda), totales (derecha).
       --------------------------------------------------------------- */

    .receipt-summary {
        page-break-inside: avoid;
        break-inside: avoid;
    }

    .closing-block {
        margin-top: {{ $isHalf ? '5px' : '10px' }};
        page-break-inside: avoid;
        break-inside: avoid;
    }

    .closing-block > tbody > tr > td {
        vertical-align: top;
    }

    .closing-left {
        padding-right: {{ $isHalf ? '12px' : '18px' }};
        width: 54%;
    }

    .closing-right {
        width: 46%;
    }

    .situation-value,
    .situation-pending {
        font-size: {{ $isHalf ? '1em' : '1.08em' }};
        font-weight: 700;
        line-height: 1.25;
    }

    .method-line {
        color: #374151;
        font-size: 0.86em;
        margin-top: {{ $isHalf ? '3px' : '6px' }};
    }

    .amount-words {
        border-top: 1px solid #e5e7eb;
        color: #374151;
        font-size: 0.8em;
        margin-top: {{ $isHalf ? '3px' : '6px' }};
        padding-top: 4px;
    }

    .amount-scope {
        color: #6b7280;
        display: block;
        font-size: 0.92em;
    }

    .totals-table td {
        padding: {{ $isHalf ? '1px 0 1px 10px' : '2px 0 2px 10px' }};
    }

    .totals-table .money {
        width: 44%;
    }

    .totals-table .grand-total td {
        border-top: 1.5px solid #111827;
        font-size: {{ $isHalf ? '1.08em' : '1.15em' }};
        font-weight: 700;
        padding-top: {{ $isHalf ? '3px' : '5px' }};
    }

    /* ---------------------------------------------------------------
       Firmas y espacio para sello físico.
       --------------------------------------------------------------- */

    .signature-grid {
        margin-top: {{ $isHalf ? '4px' : '34px' }};
        page-break-inside: avoid;
        break-inside: avoid;
    }

    .signature-grid td {
        padding: 0 12px;
        text-align: center;
        vertical-align: bottom;
        width: 50%;
    }

    .signature-space {
        height: {{ $isHalf ? '18px' : '34px' }};
    }

    .seal-space {
        border: 1px solid #9ca3af;
        height: {{ $isHalf ? '15px' : '31px' }};
        margin: 0 auto 3px;
        width: 76%;
    }

    .signature-rule {
        border-top: 1px solid #111827;
        margin: 0 auto;
        width: 76%;
    }

    .signature-caption {
        color: #4b5563;
        font-size: 0.74em;
        letter-spacing: 0.04em;
        padding-top: 3px;
        text-transform: uppercase;
    }

    .copy-legend {
        border-top: 1px solid #d1d5db;
        color: #6b7280;
        font-size: 0.72em;
        margin-top: {{ $isHalf ? '6px' : '12px' }};
        padding-top: 4px;
        text-align: center;
        text-transform: uppercase;
    }

    /* ---------------------------------------------------------------
       Hoja con dos ejemplares: zona superior (paciente) y zona inferior
       (archivo del hospital), separadas por una línea de corte.

       La línea es una ayuda de corte, no un sello de validez. Las zonas se
       apilan en flujo normal: si el conjunto no cabe en una hoja, el motor
       empuja la segunda zona a otra página y `compositionFor()` devuelve la
       composición de una página por ejemplar. Ninguna línea se oculta para
       forzar una sola hoja.
       --------------------------------------------------------------- */

    .zone {
        page-break-inside: avoid;
        break-inside: avoid;
    }

    .zone-archive {
        padding-top: 4px;
    }

    .cut-line {
        border-top: 1px dashed #9ca3af;
        color: #6b7280;
        font-size: 0.7em;
        letter-spacing: 0.1em;
        margin: 6px 0 4px;
        padding-top: 2px;
        text-align: center;
        text-transform: uppercase;
    }

@if ($isHalf)
    /* =================================================================
       Densidad `half` — composición medida para 612 x 396 pt (C3-P1).

       Medición real con el motor instalado (Dompdf 3.1.6), antes de este
       bloque: la hoja media carta necesitaba 401.7 pt para 2 conceptos y
       456.0 pt para 5 (hoja = 396 pt), es decir **no cabía** ni con dos
       líneas. La atribución por bloque mostró que el encabezado institucional
       se llevaba ~111 pt de los ~362 pt útiles: no eran las filas de detalle.

       Este bloque agrupa la composición compacta: encabezado breve, metadatos
       y bandas al mínimo vertical y filas de totales sin relleno vertical.
       Medición DESPUÉS: 1 concepto 325.8 pt · 2 conceptos 340.9 pt ·
       5 conceptos 386.2 pt → **una sola página** en los tres casos, con 10 pt
       de margen en el peor caso.

       Lo que este bloque NO hace, a propósito:
       - no cambia el tamaño de la letra de detalle (sigue en 14 px = 10.5 pt);
       - no toca `.signature-space` (18 px) ni `.seal-space` (15 px), que son
         área de ESCRITURA de firma y sello, no relleno;
       - no usa `overflow: hidden`, ni escala global, ni oculta líneas,
         conceptos, totales ni el ajuste autorizado;
       - no elimina campos institucionales: solo reduce el aire entre ellos.

       Regla de mantenimiento: si se añade contenido obligatorio al ejemplar,
       vuelve a medir con `evidencia/C3-P1/probe` antes de recortar aquí.
       ================================================================= */
    .masthead {
        border-bottom-width: 1px;
        padding-bottom: 1px;
    }

    .masthead-line {
        display: inline;
        font-size: 0.64em;
        line-height: 1;
    }

    /* Cabecera institucional en UNA línea compartida: el renglón que se ahorra es
       parte de los 14.3 pt que faltaban para la operación de 5 conceptos con el
       bloque fiscal presente. */
    .masthead-lines {
        line-height: 1;
    }

    .hospital-name {
        font-size: 1em;
        line-height: 1.08;
        margin: 0;
    }

    .masthead-contact {
        font-size: 0.68em;
        line-height: 1.05;
        display: inline;
    }

    /* Los metadatos de contacto comparten UNA línea en la densidad compacta: el
       renglón que se ahorra es el que empujaba a segunda página la operación de 5
       conceptos con el bloque fiscal presente. */
    .masthead-sep {
        display: inline;
    }

    .doc-band {
        padding: 1px 0 1px;
    }

    .doc-title {
        font-size: 0.95em;
    }

    .meta td {
        padding: 0 10px 0 0;
    }

    .patient-block {
        padding: 1px 0 1px;
    }

    .patient-name {
        font-size: 1.05em;
        line-height: 1.15;
    }

    .section-title {
        margin-top: 1px;
        padding-bottom: 0;
    }

    .items-table {
        margin-top: 1px;
    }

    .items-table th,
    .items-table td {
        padding: 0 4px;
    }

    .closing-block {
        margin-top: 1px;
    }

    .method-line,
    .amount-words {
        margin-top: 0;
    }

    .totals-table td {
        padding: 0 4px;
    }

    .signature-grid {
        margin-top: 1px;
    }

    .copy-legend {
        padding-top: 0;
    }

    .patient-block {
        padding: 0;
    }

    .doc-band {
        padding: 0;
    }
@endif
</style>
