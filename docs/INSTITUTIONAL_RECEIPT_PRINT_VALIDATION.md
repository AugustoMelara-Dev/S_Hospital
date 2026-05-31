# Validacion de impresion del recibo institucional

Estado actual: PENDING_HARDWARE_VALIDATION hasta probar en impresora fisica media carta/carta/A5.

El CSS de impresion debe permanecer aislado al recibo. Solo se activa cuando
`body[data-printing-receipt="true"]` esta presente; imprimir otra vista del
sistema no debe ocultar sidebar/topbar/app completa ni dejar paginas en blanco.

## Equipo

- PC de caja identificada.
- Navegador que usara el cajero identificado.
- Impresora instalada o compartida en la PC de caja.
- Formatos habilitados en el driver: media carta, carta y A5 segun decision del hospital.
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
7. Confirmar fondo blanco, lectura clara y una sola factura por impresion.
8. Confirmar que muestra Gobierno, Secretaria, Hospital San Isidro, numero/serie, fecha, paciente, cajero, servicios, metodo de pago, total, pagado, saldo, firma y sello.
9. Confirmar que no imprime QR, codigo de barras, codigos internos ni datos tecnicos.

## Prueba carta y A5

1. Abrir la misma factura o reimpresion.
2. Cambiar formato a carta.
3. Imprimir y confirmar margenes, escala 100% y legibilidad.
4. Cambiar formato a A5 si el hospital usara ese tamano.
5. Imprimir y confirmar que no hay cortes de texto critico.

## Reimpresion

1. Ir a historial.
2. Buscar factura pagada.
3. Reimprimir con motivo.
4. Confirmar auditoria en backend.
5. Confirmar que los datos historicos coinciden con la factura original.

## Resultado

Registrar:

- Fecha.
- Operador.
- PC de caja.
- Modelo de impresora.
- Formato probado: media carta, carta, A5 o combinacion aprobada.
- Resultado: VALIDATED o FAILED.
- Observaciones de margenes, escala o driver.
