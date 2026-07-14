# Matriz de verificación de impresión institucional

Fecha de corte: 2026-07-13
Estado: **automatización en curso; prueba física pendiente**

La vista previa y la impresión usan HTML/CSS local. No se rasteriza el recibo,
no se cargan fuentes remotas y el shell se oculta mediante media print. La
geometría vive exclusivamente en
`frontend/src/printing/styles/receipt-print.css`; `src/styles.css` no contiene
reglas `@page`.

| Perfil | Tamaño | Orientación | Márgenes | Escala | Navegador | Impresora o PDF | Original | Copias | Resultado | Problemas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Carta | letter | horizontal | 0.45 in | automática | Chromium | PDF | sí | 1.ª/2.ª según perfil | CSS/unit automatizado; Playwright pendiente de reejecución | prueba física pendiente |
| Media Carta | 8.5 × 5.5 in | horizontal | 0.35 in | automática | Chromium | PDF | sí | 1.ª/2.ª según perfil | CSS/unit automatizado; Playwright pendiente de reejecución | prueba física pendiente |
| A5 | A5 | horizontal | 0.30 in | automática | Chromium | PDF | sí | 1.ª/2.ª según perfil | CSS/unit automatizado; Playwright pendiente de reejecución | prueba física pendiente |
| Ticket 80 mm | 80 mm × auto | vertical continuo | 4 mm | automática | Chromium | PDF/compatibilidad térmica | sí | según perfil histórico | CSS/unit automatizado | compatibilidad secundaria; prueba física pendiente |
| Ticket 58 mm | 58 mm × auto | vertical continuo | 3 mm | automática | Chromium | PDF/compatibilidad térmica | sí | según perfil histórico | CSS/unit automatizado | compatibilidad secundaria; prueba física pendiente |

## Cobertura automatizada

- `receipt-print-css.test.ts` comprueba que los cinco perfiles conservan su
  regla `@page` y que la geometría no contamina el stylesheet global.
- `paperPolicy.test.ts` comprueba Carta, Media Carta, A5, 80 mm, 58 mm,
  orientación institucional, clases de presentación y fallback seguro a Media
  Carta.
- `ReceiptSettingsPreview.test.tsx` comprueba contenido institucional, tabla,
  firmas, sello, pie, leyendas y proporciones.
- `ReceiptPreview.test.tsx` comprueba recibo institucional y legacy, contenido
  sin controles interactivos dentro del área imprimible y selección de los
  cinco formatos.
- `print-profiles.spec.ts` y `clinical-receipts.spec.ts` cubren el selector real,
  preview responsivo, campos técnicos protegidos y payload de impresión de
  prueba. La matriz de media print, shell oculto y saltos de página se ampliará
  antes de cerrar QA transversal.

## Deuda física explícita

No existe todavía evidencia de salida en impresoras físicas Carta/Media Carta,
A5, 80 mm ni 58 mm. Ningún formato se considera físicamente certificado hasta
registrar modelo de impresora, driver, escala del diálogo, medición de márgenes,
legibilidad de Original/1.ª copia/2.ª copia, firmas, sello y ausencia de cortes.
