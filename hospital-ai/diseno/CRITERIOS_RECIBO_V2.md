# CRITERIOS_RECIBO_V2 — Criterios visuales de vista previa y PDF

Autor: hs-ux. Fecha: 2026-09-17. Raíz: `C:\Projects\S_Hospital_AI`. Mandato §11, §12, §13.
Alcance: **criterios visuales**. La plantilla, los perfiles, el motor PDF y la impresión pertenecen a hs-receipts. hs-ux no edita `frontend/src/**` ni `backend/**`.
No hay inspección de PDFs reales en esta entrega: todo lo renderizado queda NOT VERIFIED hasta que hs-receipts/hs-qa generen previews y PDFs con datos sintéticos (§12).

Fuentes de estado actual citadas: `frontend/src/printing/styles/receipt-print.css`, `frontend/src/features/receipt-settings/components/ReceiptSettingsPreview.tsx`, `frontend/src/features/receipts/InstitutionalReceiptPreviewFrame.tsx`, `frontend/src/modules/receipts/paperPolicy.ts`, `backend/app/Support/PaperSize.php`, `backend/database/seeders/ReceiptPrintProfileSeeder.php`.

---

## 0. Precondiciones de dominio (no son decisiones de diseño)

1. **Factura fiscal y recibo institucional son documentos distintos** (§12). No se renombran ni se fusionan por estética. Este contrato aplica al **recibo institucional** (PDF/papel) y a su vista previa.
2. El recibo principal no expone QR, código de barras ni códigos internos (`AGENTS.md`; §12). La compatibilidad 80/58 mm es secundaria.
3. No se inventan RTN, CAI, tasas, sellos, firmas, logos ni numeración. Un espacio sin dato real se deja **vacío y rotulado como espacio**, nunca rellenado.
4. Se preservan correlativos, snapshots, numeración y la semántica de reimpresión. El rediseño no cambia el número del documento.

---

## 1. Tamaños de papel y orientación

| Documento | Tamaño | Puntos | Rol |
|---|---|---|---|
| **Carta vertical (principal propuesto)** | 215.9 × 279.4 mm | **612 × 792 pt** | Diseño principal del recibo institucional en impresora convencional |
| **A4 configurable** | 210 × 297 mm | 595.28 × 841.89 pt | Alternativa configurable, no sinónimo de carta |
| Media carta | 215.9 × 139.7 mm | 612 × 396 pt | Compatibilidad; **no** es A5 |
| A5 | 210 × 148 mm | 595.28 × 419.53 pt | Compatibilidad; **no** es media carta |
| 80 mm / 58 mm | ancho fijo | — | Compatibilidad térmica secundaria |

Reglas:
- El preview debe representar el tamaño **y la orientación reales** que emite el motor. No se muestra vertical si el PDF sale apaisado.
- **Migración detectada:** hoy los cuatro perfiles institucionales son apaisados. `paperPolicy.ts:21-50` declara `letter 11/8.5`, `half_letter 8.5/5.5`, `a5 210/148`, `custom 215.9/139.7`; `receipt-print.css:491-504` declara `@page receipt-letter { size: letter landscape }` y `receipt-a5 { size: A5 landscape }`; `ReceiptPrintProfileSeeder.php:96-101` define `letter_landscape` 279.40 × 215.90 mm. El mandato pide carta vertical como principal. hs-receipts debe decidir perfiles y PDF; mientras no cambie, la UI **no debe rotular "Carta vertical"** ni prometer una orientación que el motor no produce.
- Márgenes iniciales: **12 mm**; texto de detalle **10–11 pt**; verificar contra el área imprimible del perfil real (parámetros de diseño, no prueba de impresora — §12).
- Media carta y A5 conservan su propia geometría y su propio rótulo; nunca se rotulan como sinónimos.

---

## 2. Composición obligatoria del recibo

Orden visual, de arriba hacia abajo:

1. **Encabezado institucional compacto**: líneas reales de gobierno/secretaría si existen, nombre autorizado del hospital, ubicación. Logo autorizado si existe; si no hay logo, **solo texto**. Centrado, sin banda de color ni fondo.
2. **Tipo y número de documento + fecha** claramente destacados. El número va en tamaño superior al cuerpo y con `tabular-nums`; la fecha en formato local `dd/mm/aaaa` (zona `America/Tegucigalpa`).
3. **Paciente y contexto del pago**: nombre del paciente (obligatorio) y contexto autorizado (caja/cajero/fecha operativa) cuando el dominio lo provea.
4. **Tabla** de Descripción / Cantidad / Precio / Importe. Descripciones largas envuelven; cantidades y montos a la derecha.
5. **Resumen monetario** legible: subtotal, exento, ISV cuando corresponda, **Total** con mayor peso. Alineación decimal estricta.
6. **Método de pago y referencia** cuando apliquen; nunca inventar una referencia.
7. **Espacios de firma/sello**: líneas vacías rotuladas ("Firma del enterante", "Sello y firma autorizada"). No se dibuja ninguna firma ni sello.
8. **Etiqueta de copia** (ORIGINAL / PRIMERA COPIA / SEGUNDA COPIA) y **numeración de página** cuando haya más de una.

Prohibido: banda/encabezado con relleno de color, watermark decorativo, gráficos, QR/barras, "monto en letras" inventado, cualquier dato no confirmado por el dominio.

---

## 3. Legibilidad en blanco y negro (prueba principal)

- La prueba principal de legibilidad es **impresión/monocromo**: si al convertir a escala de grises dos elementos dejan de distinguirse, el diseño falla. Ningún estado, total o etiqueta puede depender solo del color.
- Tinta:
  - Texto principal: `#111827` sobre `#FFFFFF` = **17.74:1**; el negro puro `#000000` es preferible en el PDF final (mayor densidad y menos tinta en térmicas por contraste de umbral).
  - Texto secundario: `#374151` sobre `#FFFFFF` = **10.31:1**.
  - Reglas: `#111827` para la línea de cierre del total y las firmas; `#D1D5DB` (1.47:1) **solo** como separador decorativo fino, nunca como único límite de una celda que deba leerse.
- **Sin fondos que consuman tinta.** El sombreado actual de encabezados de tabla (`receipt-print.css:270-276`, `background: var(--color-receipt-panel)` `#F3F4F6`) debe sustituirse por **negrita + tracking + borde inferior**; el gris consume tóner en cada copia sin aportar información.
- **Separadores discretos**: línea de 1 px para filas, 2 px para el cierre del total y el borde inferior del encabezado (ya `receipt-print.css:140,326`). No usar bordes gruesos ni dobles.
- La etiqueta de copia de reimpresión debe distinguirse por **texto y grosor de borde**, no por color (`receipt-copy-label--reprint` ya usa borde 2 px; conservar).

---

## 4. Alineación monetaria y tipografía del documento

- Todo monto: `font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap` (`receipt-print.css:278-283` ya lo aplica por `data-numeric="true"`).
- Columna de importe: ancho mínimo que nunca parta un número; el símbolo `L.` siempre presente y a la izquierda del número, sin espacio que permita confundir cifras.
- Cantidades con la precisión del dominio (hasta dos decimales) y unidad visible.
- Jerarquía por tamaño/peso: total ≈ 1.3–1.5× el cuerpo; subtotal/ISV = cuerpo; metadatos = 0.82× (ya `receipt-copy-label` a 0.82 em).
- Familia: una sola tipografía sans para el documento (Arial/Helvetica es la actual, `receipt-print.css:88`; cualquier cambio lo decide hs-receipts). Cifras tabulares obligatorias.
- Nombres/descripciones largas: `overflow-wrap: anywhere; word-break: break-word` (ya `receipt-print.css:285-291`). No reducir la fuente para encajar; permitir más páginas.

---

## 5. Paginación y casos extremos (§12)

| Caso | Criterio visual |
|---|---|
| Una página | Total y bloque de firmas en la misma página; no dejar el total huérfano. |
| Varias páginas | Repetir encabezado de columnas (`thead { display: table-header-group }`, ya `:250-252`); pie/totales como `tfoot`; identificar continuación ("Continúa en la página siguiente") y la página (`2 de 3`). |
| Descripción larga | Envuelve en varias líneas dentro de la celda; la fila no se parte entre páginas (`break-inside: avoid`, ya `:258-262`). |
| Importe cero | Mostrar `L. 0.00`, no vacío; si es exención/regla especial, rotular por texto ("Gratis - receta diálisis"), no por color. |
| Anulado/reimpreso | Etiqueta textual de estado y de copia; nunca borrar el original. |
| Copias | ORIGINAL / PRIMERA COPIA / SEGUNDA COPIA con el **mismo número**; si la aplicación genera el conjunto, la UI indica "una copia del conjunto" para no multiplicar por accidente (§13). |
| Caracteres | Acentos, montos en letras si el dominio los provee, signos y formato local `L. 1,234.56`. |

---

## 6. Criterios de la vista previa en pantalla

Archivos: `InstitutionalReceiptPreviewFrame.tsx`, `ReceiptSettingsPreview.tsx`, `PrintPreviewFrame`.

1. **Fidelidad**: el preview renderiza el **mismo HTML/motor** que produce el documento (iframe `srcDoc` con `sandbox=""`), no un mockup paralelo. Rotularlo "Ejemplo del recibo" cuando es sintético y "PRUEBA - SIN VALIDEZ" cuando hay cambios sin guardar (`ReceiptSettingsPreview.tsx:102-106`).
2. **Geometría real**: la relación de aspecto mostrada debe corresponder al tamaño/orientación del perfil activo. El escalado automático (`calculateReceiptPreviewScale`) solo reduce para encajar; nunca estira ni recorta. Al cambiar el formato, la proporción cambia de inmediato.
3. **Fondo del visor**: gris funcional alrededor del papel, papel **blanco puro** dentro del documento; borde de encuadre que no se imprime (`border-operational-border`). Sin sombras decorativas en el papel.
4. **Sin cromo dentro del documento**: el preview no incluye botones, cursores ni etiquetas de la aplicación dentro del área del papel.
5. **Accesibilidad del visor**: `iframe` con `title` descriptivo e identificable (ya `InstitutionalReceiptPreviewFrame.tsx:40`); el foco no queda atrapado dentro; se puede salir con Tab; el estado de carga (`role="status"`) y el error con Reintentar son visibles.
6. **Contenido del preview**: número real o de prueba rotulado, paciente sintético, fecha, tabla, total, método/referencia solo si existen, espacios de firma/sello y etiqueta de copia. Sin QR, sin códigos internos, sin datos personales reales.
7. **Copias**: si el perfil pide 1–3 etiquetas de copia, el preview las muestra todas (una página por copia) para que el operador vea cuántas saldrán (`ReceiptSettingsPreview.tsx:42-46,86-184`).
8. **Indicadores operativos**: antes de imprimir, indicar cuántas páginas/copias generará el PDF (§13). No afirmar que el papel salió por abrir el diálogo del navegador.
9. **Contraste del visor** (medido en los tokens actuales): `receipt-ink #111827` = 17.74:1; `receipt-muted #374151` = 10.31:1; `receipt-border-soft #D1D5DB` = 1.47:1 (solo decorativo); `receipt-ink` sobre `receipt-panel #F3F4F6` = 16.12:1. El visor no debe ser la única forma de leer el documento: siempre hay acciones de descarga/imprimir.
10. **Zoom/navegador**: a 125–200 % el visor mantiene proporción y permite scroll interno sin desbordar el documento.

---

## 7. Criterios de impresión (marco, no control del navegador)

- El PDF es la salida canónica; el diálogo del navegador no garantiza impresora, papel ni bandejas. La UI no promete control universal de Windows (§13).
- Manejar explícitamente: popup bloqueado, descarga alternativa, impresora sin papel, cancelación y fallo del PDF, con mensaje claro y sin declarar éxito.
- Impresión en blanco y negro por defecto en el preview/PDF institucional; el único color permitido es el que ya exista en un logo autorizado, y debe conservar legibilidad en gris.
- Separar emisión, solicitud/generación, descarga y reimpresión; la reimpresión exige autorización, motivo y contador persistente con marca visible en el documento (§13).

---

## 8. Criterios de aceptación medibles (para hs-receipts/hs-qa)

1. PDF de carta vertical mide **612 × 792 pt** (A4: 595.28 × 841.89 pt); media carta 612 × 396 pt y A5 595.28 × 419.53 pt no se confunden.
2. El preview y el PDF coinciden en tamaño, orientación, saltos de página y totales para casos sintéticos cortos, largos, cero, anulados y reimpresos.
3. En escala de grises, todo estado y todo total siguen siendo legibles y diferenciables.
4. Ningún encabezado de tabla con relleno de fondo; separadores de 1 px / cierre de total de 2 px.
5. Nombres y descripciones largas envuelven sin reducir la fuente ni truncar montos.
6. Cero QR/códigos internos; cero RTN/CAI/sellos/firmas inventados.
7. El recibo no cambia de contenido al modificar catálogo o rediseñar plantillas nuevas (versionado, §12).

**NOT VERIFIED**: no se generó ni inspeccionó ningún PDF/preview en esta tarea; los ratios son cálculo WCAG sobre los hex declarados en `receipt-print.css`/`institutional-tokens.css`. La comprobación de dimensiones, paginación y cortes con el motor real queda para hs-receipts/hs-qa.
