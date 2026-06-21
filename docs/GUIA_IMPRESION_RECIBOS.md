# Guia de Impresion de Recibos Institucionales

## Recibo principal

El recibo principal es institucional PDF/papel. Debe mostrar datos del hospital, datos fiscales configurados, numero de factura/recibo, fecha, cajero, nombre del paciente, servicios, totales, metodo de pago y estado.

## Formatos

Usar carta, media carta o A5 cuando esten configurados. Los formatos 80mm/58mm quedan solo como compatibilidad secundaria si existen y no sustituyen el recibo institucional principal.

## Reimpresion

La reimpresion debe conservar datos historicos desde snapshots y registrar motivo/auditoria cuando aplique.

## Restriccion de recibo principal

El recibo principal no debe exponer QR, codigo de barras ni codigos internos salvo decision explicita posterior del hospital.

## Pendiente de campo

La impresora fisica, papel final, margenes y calidad de impresion deben validarse en campo antes de PRODUCTION_READY.

## Impresoras virtuales

`Microsoft Print to PDF`, `OneNote`, vista previa del navegador y descargas PDF solo validan layout, datos historicos y generacion del archivo. No validan alimentacion de papel, escala real, margenes del driver, legibilidad de tinta/toner ni comportamiento de la impresora del hospital. Por eso no cierran el gate fisico.

## Checklist fisico obligatorio

1. Abrir un recibo institucional historico desde Historial o Recibos.
2. Imprimir en una impresora fisica real conectada al servidor o a una PC cliente autorizada.
3. Usar escala 100%, sin encabezados/pies del navegador y con margenes minimos.
4. Validar al menos media carta. Carta o A5 tambien son aceptables si ese sera el papel final del hospital.
5. Confirmar visualmente que el recibo no expone QR, codigo de barras ni codigos internos.
6. Tomar foto clara del papel impreso o levantar acta local con responsable, fecha, impresora, papel y resultado.
7. Completar `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` con resultado real para media carta/carta/A5 y referencia de la evidencia.

Sin papel fisico validado, el estado correcto es `PDF_RECEIPT_VALIDATED_PHYSICAL_PRINT_PENDING`, no `PRODUCTION_READY`.
