# Thermal printer proof

Estado actual: PENDING_HARDWARE_VALIDATION.

Este archivo no declara `PRODUCTION_READY`. La validacion fisica de impresora
termica debe completarse en la computadora de caja real, con la impresora real
del Hospital San Isidro y una factura de prueba autorizada. No se debe llenar
con datos supuestos, fotos inexistentes ni referencias copiadas.

Para completar la validacion, use `qa/THERMAL_PRINTER_PROOF.example.md` como
plantilla y reemplace este archivo solo despues de imprimir y revisar la salida
fisica.

## Bloqueantes actuales

- Falta imprimir recibo 80mm en el equipo real de caja.
- Falta imprimir recibo 58mm si el hospital usara ese ancho.
- Falta validar reimpresion desde historial.
- Falta confirmar escala 100%, margenes minimos y encabezados/pies del navegador desactivados.
- Falta guardar evidencia local real: foto, muestra firmada o referencia fisica verificable.

## Resultado operativo

Mientras este archivo siga en estado pendiente, `scripts/production_readiness_preflight.ps1`
debe fallar y cualquier entrega debe quedar como `PRODUCTION_CANDIDATE`, no como
`PRODUCTION_READY`.
