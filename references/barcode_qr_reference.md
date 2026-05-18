# Referencia Técnica Barcode / QR

## Scanner USB
La mayoría de scanners USB funcionan como teclado. El navegador recibe caracteres y Enter.

Implementar:

- Input dedicado.
- onKeyDown Enter.
- Buscar código exacto.
- Agregar item si match.

## Cámara QR
Usar `@zxing/browser`.

Consideraciones:

- Requiere permisos de cámara.
- No depender de cámara para operación principal.
- Scanner USB debe ser el modo recomendado para caja.

## Backend
Endpoint recomendado:

`GET /api/services/lookup?code=...`

Buscar en:

- scan_code
- barcode
- qr_code
- sku

## Seguridad

No permitir que el código determine precio. Solo identifica el servicio.
