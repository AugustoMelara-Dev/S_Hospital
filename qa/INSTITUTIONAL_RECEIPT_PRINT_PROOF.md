# Institutional receipt print proof

Estado actual: `PARCIALMENTE VALIDADO`
Fase: `G - prueba fisica LAN/offline real`
Decision actual: `PDF_RECEIPT_VALIDATED_PHYSICAL_PRINT_PENDING`

Este archivo documenta evidencia del recibo institucional generado desde la segunda PC. La vista previa/PDF esta validada; la impresion fisica en papel aun requiere foto o acta de muestra impresa.

## Environment

- Date/time: 2026-06-17 23:23-23:27
- Responsible person: usuario en segunda PC
- Printer brand/model: BLOQUEADO - esta PC no tiene impresora fisica instalada; solo `Microsoft Print to PDF` y `OneNote (Desktop)`
- Printer driver: Microsoft Edge PDF viewer / descarga PDF validada; inventario Windows en `qa/evidence/printer-2026-06-17/server-printer-inventory-20260618.txt`
- Connection type: LAN para la app; impresion fisica pendiente hasta instalar/conectar una impresora real
- Browser/version: Microsoft Edge en Windows
- Cashier computer: ESTHER-MELARA
- Invoice used: 000-001-01-00000067 / recibo REC-A-00000049
- Evidence/photo reference: qa/evidence/printer-2026-06-17
- Final conclusion: Recibo institucional PDF validado visualmente y descargado; falta evidencia fisica de impresion en papel media carta/carta/A5 porque el servidor no tiene impresora fisica instalada.

## Media carta, carta, A5 and thermal physical print result

- Media carta result: PENDIENTE DE IMPRESION FISICA
- Media carta evidence/reference: qa/evidence/printer-2026-06-17 contiene preview PDF, no foto de papel impreso
- Media carta observations: PDF muestra recibo en una pagina con fondo blanco, sin QR, sin codigo de barras y sin codigos internos visibles
- Carta result: PENDIENTE DE IMPRESION FISICA
- Carta evidence/reference: qa/evidence/printer-2026-06-17 contiene preview PDF
- Carta observations: PDF institucional visible y descargado
- A5 result: PENDIENTE DE IMPRESION FISICA
- A5 evidence/reference: qa/evidence/printer-2026-06-17 contiene preview PDF
- A5 observations: PDF institucional visible y descargado
- 80mm result: NO APLICA hasta que el hospital configure impresora termica secundaria
- 80mm evidence/reference: NO APLICA - compatibilidad secundaria no probada en esta validacion
- 80mm observations: El recibo principal validado es PDF/papel institucional, no termico
- 58mm result: NO APLICA hasta que el hospital configure impresora termica secundaria
- 58mm evidence/reference: NO APLICA - compatibilidad secundaria no probada en esta validacion
- 58mm observations: El recibo principal validado es PDF/papel institucional, no termico

## Reprint and browser print settings

- Reprint result: VALIDADO EN UI; el sistema exige motivo antes de registrar reimpresion
- Margins result: PENDIENTE DE IMPRESION FISICA
- Browser headers/footers result: PENDIENTE DE IMPRESION FISICA
- Problems found: Falta foto o acta de muestra fisica impresa en papel real media carta/carta/A5; inventario del servidor confirma que solo hay impresoras virtuales.

## Required checks

- [ ] Media carta receipt prints at 100 percent scale. Result/evidence: PENDIENTE DE FOTO/ACTA DE PAPEL IMPRESO
- [ ] Carta receipt prints at 100 percent scale. Result/evidence: PENDIENTE DE FOTO/ACTA DE PAPEL IMPRESO
- [ ] A5 receipt prints at 100 percent scale. Result/evidence: PENDIENTE DE FOTO/ACTA DE PAPEL IMPRESO
- [x] 80mm receipt prints at 100 percent scale or is explicitly out of scope. Result/evidence: NO APLICA; impresora termica secundaria no configurada en esta validacion.
- [x] 58mm receipt prints at 100 percent scale or is explicitly out of scope. Result/evidence: NO APLICA; impresora termica secundaria no configurada en esta validacion.
- [x] Institutional receipt includes hospital name, RTN/CAI when configured, invoice number, patient, cashier, services and totals. Result/evidence: PDF `REC-A-00000049` muestra Hospital San Isidro, recibo, paciente Augusto, concepto y monto L 103.50.
- [x] Institutional receipt has white background and no QR, barcode, internal codes or technical fields. Result/evidence: capturas `01-receipt-preview.jpg` y `02-receipt-pdf-download.jpg`.
- [x] Reprint from invoice history prints with historical snapshots. Result/evidence: historial muestra factura pagada y dialogo de reimpresion exige motivo auditado.
- [ ] Margins are minimal and no browser headers/footers appear. Result/evidence: PENDIENTE DE FOTO/ACTA DE PAPEL IMPRESO

## Evidence

- Photo path, printed-sample reference, or signed local note: qa/evidence/printer-2026-06-17
- Notes: PDF institucional listo. Para cerrar este gate hay que instalar/conectar una impresora fisica en Windows o validar desde una PC cliente con impresora real, imprimir media carta/carta/A5 y adjuntar foto o acta de papel impreso.
