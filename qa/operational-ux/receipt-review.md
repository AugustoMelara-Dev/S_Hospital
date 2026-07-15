# Revisión visual — comprobante institucional

Fecha: 2026-07-14

## Criterio verificado

- Carta horizontal, Media Carta horizontal y A5 horizontal contienen cuatro servicios, totales, monto en letras y firmas en una sola página.
- Los importes usan cifras tabulares y permanecen alineados.
- El encabezado muestra el wordmark provisional, ubicación, RTN y teléfono configurados.
- El cuerpo muestra recibo, factura, fecha, estado, paciente, cajero, caja y método de pago.
- El cierre muestra subtotal, exento, ISV, total, pagado, saldo, monto en letras, firma, sello y leyenda de copia.
- 80 mm y 58 mm usan plantillas térmicas específicas con columnas reducidas; no son una reducción de Carta.
- No aparecen QR, códigos de barras, claves de base de datos ni códigos internos.

## Evidencia

Las muestras PDF y sus renderizados PNG están en `qa/operational-ux/after/receipts/`.

Cada PDF fue generado por la misma ruta Blade/DomPDF usada por producción, con cuatro servicios y un perfil real sembrado. La prueba automatizada confirma una página para los tres formatos principales; la revisión visual se realizó sobre renderizados a 144 DPI.
