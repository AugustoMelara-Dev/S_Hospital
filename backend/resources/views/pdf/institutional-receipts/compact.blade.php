{{--
    Comprobante institucional — composición COMPACTA MONOCROMA (T-RC-01).

    UNA hoja por ejemplar del conjunto de copias configurado. La densidad la
    resuelve el constructor (`InstitutionalReceiptHtmlBuilder::densityFor`): carta y
    A4 vertical usan la composición holgada (1-11 conceptos por hoja) y media carta
    usa la suya propia, nativa, sin reducir una carta (ver
    `partials/compact-styles.blade.php`).

    El contenido financiero vive en `partials/compact-body.blade.php`, compartido
    con la hoja de dos ejemplares, para que las tres composiciones no puedan
    divergir. La composición de dos ejemplares apilados en una hoja carta tiene su
    propia vista (`compact-pair.blade.php`) y se elige solo cuando el motor prueba
    que ambos caben en una página.

    El conjunto de copias viene del llamador (`copyLabels`), nunca del CSS.
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
@endphp
@foreach ($pages as $page)
    <section class="receipt-page" data-receipt-composition="single" data-receipt-density="{{ $density }}">
        <div class="receipt-layout profile-{{ $profile['code'] }}" data-receipt-style="compact-monochrome">
            @include('pdf.institutional-receipts.partials.compact-body', ['page' => $page])
        </div>
    </section>
@endforeach
</body>
</html>
