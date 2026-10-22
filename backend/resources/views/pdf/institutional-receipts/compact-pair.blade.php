{{--
    Comprobante institucional — DOS EJEMPLARES SOBRE UNA HOJA CARTA (C2-B7).

    Es el MISMO documento dos veces: mismo número de recibo, mismo detalle, mismos
    totales y mismas letras. Lo único que cambia entre las dos zonas es el DESTINO
    del ejemplar (paciente arriba, archivo del hospital abajo), que es lo que las
    distingue. Una línea de corte separa las zonas: es una ayuda de corte, no un
    sello de validez, y no sustituye ninguna firma ni sello.

    Por qué esta vista existe
    -------------------------
    El mandato §9 pide que "dos ejemplares" no signifique dos páginas carta
    separadas cuando la operación es corta. El constructor solo elige esta
    composición después de renderizar esta misma vista con el motor real y
    comprobar que cae en UNA página; si no cabe, el documento conserva una página
    legible por ejemplar (`compact.blade.php`) y ninguna línea se oculta para
    forzar la hoja única.

    Esta vista ya compone el conjunto completo: en el visor se imprime UNA copia y
    UNA página por hoja. El visor no debe volver a duplicar el conjunto (ni
    "2 páginas por hoja" ni dos copias).

    Reglas del motor: solo tablas y bloques; las zonas se apilan en flujo normal
    dentro de `.receipt-page`, que nunca es un bloque indivisible.
--}}
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Recibo institucional</title>
    @include('pdf.institutional-receipts.partials.compact-styles')
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

    $destinationLabel = is_callable($destinationLabel ?? null) ? $destinationLabel : static fn (): ?string => null;
@endphp
@foreach ($sheets as $sheet)
    @php
        $sheetPages = $sheet['pages'];
        $copyTotal = count($sheetPages);
    @endphp
    <section
        class="receipt-page"
        data-receipt-composition="paired"
        data-receipt-sheet="two-zones"
        data-receipt-density="{{ $density }}"
        data-receipt-destinations="{{ $copyTotal }}"
    >
        <div class="receipt-layout profile-{{ $profile['code'] }}" data-receipt-style="compact-monochrome">
            @foreach ($sheetPages as $pageIndex => $page)
                @php($destination = $destinationLabel($sheet, $pageIndex))
                <div class="zone {{ $pageIndex === 0 ? 'zone-patient' : 'zone-archive' }}" data-receipt-zone="{{ $pageIndex + 1 }}">
                    @include('pdf.institutional-receipts.partials.compact-body', ['page' => $page, 'destination' => $destination])
                </div>
                @if ($pageIndex < $copyTotal - 1)
                    <div class="cut-line" data-receipt-cut-line>{{ $cutLineLabel }}</div>
                @endif
            @endforeach
        </div>
    </section>
@endforeach
</body>
</html>
