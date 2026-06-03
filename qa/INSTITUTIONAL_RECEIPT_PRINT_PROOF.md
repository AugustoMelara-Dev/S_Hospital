# Institutional receipt print proof

Estado actual: PENDING_HARDWARE_VALIDATION.

Este archivo no declara `PRODUCTION_READY`. La validacion fisica del recibo
institucional debe completarse en la computadora de caja real, con la impresora
real del Hospital San Isidro y una factura de prueba autorizada. No se debe
llenar con datos supuestos, fotos inexistentes ni referencias copiadas.

Para completar la validacion, use `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.example.md`
como plantilla y reemplace este archivo solo despues de imprimir y revisar la
salida fisica.

## Bloqueantes actuales

- Falta imprimir recibo media carta en el equipo real de caja.
- Falta imprimir recibo carta en el equipo real de caja.
- Falta imprimir recibo A5 en el equipo real de caja.
- Falta imprimir recibo 80mm en el equipo real de caja.
- Falta imprimir recibo 58mm en el equipo real de caja.
- Falta validar reimpresion desde historial.
- Falta confirmar escala 100%, margenes minimos y encabezados/pies del navegador desactivados.
- Falta guardar evidencia local real: foto, muestra firmada o referencia fisica verificable.

## Resultado operativo

Mientras este archivo siga en estado pendiente, `scripts/production_readiness_preflight.ps1`
debe fallar y cualquier entrega debe quedar como `PRODUCTION_CANDIDATE`, no como
`PRODUCTION_READY`.
