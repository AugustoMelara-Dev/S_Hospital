# Thermal printer validation checklist

Estado actual: PENDING_HARDWARE_VALIDATION hasta probar en impresora fisica 80mm/58mm.

El CSS de impresion debe permanecer aislado al recibo. Solo se activa cuando
`body[data-printing-receipt="true"]` esta presente; imprimir otra vista del
sistema no debe ocultar sidebar/topbar/app completa ni dejar paginas en blanco.

## Equipo

- PC de caja identificada.
- Navegador que usara el cajero identificado.
- Impresora 80mm instalada o compartida.
- Impresora 58mm instalada o compartida, si aplica.
- Impresora correcta seleccionada como predeterminada o elegida manualmente.

## Configuracion del navegador

- Escala 100%.
- Margenes minimos o ninguno.
- Encabezados y pies desactivados cuando el navegador lo permita.
- Tamano de papel del driver configurado como 80mm o 58mm, no carta.
- Prueba realizada desde la PC real de caja, no solo desde desarrollo.

## Prueba 80mm

1. Iniciar sesion como cajero.
2. Abrir caja.
3. Crear factura con paciente y al menos un servicio.
4. Cobrar factura.
5. Abrir recibo 80mm.
6. Imprimir.
7. Confirmar que no sale en formato carta.
8. Confirmar que muestra hospital, RTN, CAI, rango, fecha limite, paciente, cajero, items, pagos y total.

## Prueba 58mm

1. Abrir la misma factura o reimpresion.
2. Cambiar ancho a 58mm.
3. Imprimir.
4. Confirmar que no hay cortes de texto critico.
5. Confirmar que paciente, numero fiscal, CAI y total son legibles.

## Reimpresion

1. Ir a historial.
2. Buscar factura pagada.
3. Reimprimir con motivo.
4. Confirmar auditoria en backend.
5. Confirmar que los datos fiscales historicos coinciden con la factura original.

## Resultado

Registrar:

- Fecha.
- Operador.
- PC de caja.
- Modelo de impresora.
- Ancho probado: 80mm, 58mm o ambos.
- Resultado: VALIDATED o FAILED.
- Observaciones de margenes, escala o driver.
