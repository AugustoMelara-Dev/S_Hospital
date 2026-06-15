# Institutional printer validation checklist

Estado actual: PENDING_HARDWARE_VALIDATION hasta probar en impresora fisica media carta/carta/A5.

El CSS de impresion debe permanecer aislado al recibo. Solo se activa cuando
`body[data-printing-receipt="true"]` esta presente; imprimir otra vista del
sistema no debe ocultar sidebar/topbar/app completa ni dejar paginas en blanco.

## Equipo

- PC de caja identificada.
- Navegador que usara el cajero identificado.
- Impresora institucional instalada o compartida.
- Formatos de papel disponibles confirmados: media carta, carta y A5.
- Impresora correcta seleccionada como predeterminada o elegida manualmente.

## Configuracion del navegador

- Escala 100%.
- Margenes minimos o ninguno.
- Encabezados y pies desactivados cuando el navegador lo permita.
- Tamano de papel del driver configurado como media carta, carta o A5.
- Prueba realizada desde la PC real de caja, no solo desde desarrollo.

## Prueba media carta

1. Iniciar sesion como cajero.
2. Abrir caja.
3. Crear factura con paciente y al menos un servicio.
4. Cobrar factura.
5. Abrir recibo institucional en media carta.
6. Imprimir.
7. Confirmar que no salen encabezados ni pies del navegador.
8. Confirmar que muestra hospital, RTN, CAI si esta configurado, rango, fecha limite, paciente, cajero, items, pagos y total.

## Prueba carta

1. Abrir la misma factura o una reimpresion autorizada.
2. Seleccionar papel carta en el dialogo del navegador o driver.
3. Imprimir.
4. Confirmar que el recibo queda centrado, legible y con espacio para firma y sello.

## Prueba A5

1. Abrir la misma factura o una reimpresion autorizada.
2. Seleccionar papel A5 en el dialogo del navegador o driver.
3. Imprimir.
4. Confirmar que no hay cortes de texto critico y que paciente, numero fiscal, CAI si existe y total son legibles.

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
- Formatos probados: media carta, carta, A5.
- Resultado: VALIDATED o FAILED.
- Observaciones de margenes, escala o driver.
