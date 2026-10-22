# F2C — Recibo nítido en carta, media carta y térmica (H-18/H-08)

Fecha: 2026-10-22 · Rama `release/entrega-20261021`.

## Entregado

- **Plantilla térmica dedicada** `institutional_thermal`
  (`resources/views/pdf/institutional-receipts/thermal.blade.php`):
  - `@page { size: 80mm auto | 58mm auto; margin: 1mm }`; ancho útil 72 mm
    (80 mm) y 48 mm (58 mm).
  - Fuente mono DejaVu ≥ 8 pt (≥ 9 pt en totales), negro puro `#000`, sin
    fondos ni grises de texto, reglas 0.5–0.75 pt.
  - Alto de página dinámico (rollo continuo) medido con el motor real
    (`thermalPaperForPages`, una copia + 3 mm de seguridad).
  - Sin QR, código de barras ni códigos internos.
- **Perfiles térmicos reales**: 80 mm y 58 mm pasan a `institutional_thermal`,
  márgenes 1 mm, `active=true`, nunca predeterminados globales.
- **Carta / A4 / media carta**: texto a negro puro, etiquetas ≥ 8 pt, bordes
  grises permitidos, `@page` por perfil.
- **H-08 «Importe» sin impuesto**: en compacta/térmica y en la plantilla
  clásica el Importe de línea es `line_subtotal` (cantidad × precio − ajuste).
  El ISV deja de imprimirse por línea y pasa solo al bloque de totales,
  desglosado por tasa («Gravado X %» + «ISV X %» + «Exento»).
- **Desglose por tasa** en el bloque de totales (snapshot `tax_breakdown`;
  fallback a totales del recibo para documentos históricos sin desglose).

## Verificación

- PHPUnit `--filter InstitutionalReceipt`: **142 tests, 2.741 aserciones,
  0 fallos, 5 omitidos** (render real de PDF, una página por copia, campos
  institucionales, sin códigos técnicos, etiquetas por tasa).
- PHPStan 0 y pint passed (ver F1-GATES / cierre).
- Medición de altura mínima de carta actualizada a 778.4 pt (antes 790.6): la
  tipografía F2C reduce la altura y sigue cabiendo en una hoja de 792 pt.

## Evidencia generada (A-05 / A-07)

Generador reproducible (omitido por defecto):
`backend/tests/Feature/Evidence/ReceiptFormatsEvidenceTest.php`, ejecutado con
`S_HOSPITAL_RECEIPT_EVIDENCE_DIR=hospital-ai/evidencia/ENTREGA-20261021/recibos`.

Escribe un PDF vectorial por formato con una cuenta de 31 líneas (10 al 15 %,
10 al 18 %, 9 exentas, 1 EPO gratuita), nombre de paciente largo y un importe de
6 cifras:

| Archivo | MediaBox (pt) | Alto | Páginas |
|---|---|---|---|
| `carta.pdf` | 612 × 792 | 279 mm | 2 |
| `media-carta.pdf` | 612 × 396 | 140 mm | 3 |
| `termica-80mm.pdf` | 226.772 × 1738.856 | 613 mm | 1 |
| `termica-58mm.pdf` | 164.409 × 1836.020 | 648 mm | 1 |

80 mm = 226.8 pt y 58 mm = 164.4 pt, con alto de rollo dinámico; el recibo de
31 líneas queda **por debajo de 1 m** en ambas térmicas.

### Rediseño A-07 (ticket)

- **Nombre del concepto a todo el ancho** (línea 1), ajuste por palabras; no se
  corta ninguna palabra (`overflow-wrap: break-word`, sin columnas estrechas).
- **Línea 2**: `cant × precio` a la izquierda e **importe a la derecha** (sin
  repetir el importe bajo el nombre; la cantidad se imprime compacta: `1`, no
  `1.00`).
- **Línea 3** solo si aplica: «Sin cobro por receta» + ajuste autorizado.
- Sin categoría/área (ocupaban dos líneas por concepto y alargaban el rollo).
- Cabecera en **filas de ancho completo** (etiqueta y valor), no en dos columnas.
- **Rango fisca** en su propia línea y salto explícito **solo en « a »**:
  `000-001-01-00000001` / `a 000-001-01-00005000`; el CAI completo no se parte.
- Media carta: totales + firmas + «Gracias» van en un bloque
  `page-break-inside: avoid` (`.keep-together`), sin hoja de firmas huérfanas.

### A-08 (residual 58 mm)

- Espacios no separables (U+00A0) entre `L.` y la cifra, entre número y `%`
  («Gravado 18 %» / «ISV 18 %»), en `Tel.` + número y en `Ajuste - L.`; ninguna
  de esas etiquetas se parte.
- En 58 mm, cuando `cant × precio` y el importe no caben en una fila, el
  **importe baja a la fila siguiente alineado a la derecha**; en 80 mm siguen en
  la misma fila.
- Verificado por extracción de las líneas reales del PDF: `Tel. 2444-0000`,
  `Gravado 18 %`, `ISV 18 %`, `L. 144,640.30` y `1 × L. 100.00` completos.

Verificación textual del PDF (extracción de las líneas reales del content
stream): nombres completos, CAI completo, rango partido solo en « a », importes
de 6 cifras completos. Capturas HTML vía Edge headless en `recibos/*.png`.

## No verificado (pendiente, no se declara hecho)

- **PNG a 300/203 dpi del PDF**: no hay rasterizador instalado en esta PC (sin
  Ghostscript, ImageMagick ni poppler; `convert.exe` es la utilidad de Windows,
  no ImageMagick). Las capturas PNG existentes son del **HTML** renderizado por
  Edge, no del PDF rasterizado. Rasterizar el PDF exige instalar una herramienta
  externa (descarga/UAC) o hacerlo en otra máquina.
- **Impresora física** (carta, 2 ejemplares, corte, térmica real): Fase 7, en el
  hospital.
- **Media carta con 31 líneas**: el bloque de firmas ya va junto a los totales,
  pero la cuenta sigue ocupando 3 hojas (2 de detalle + cierre); reducirlo a 2
  exige una tipografía/márgenes distintos y se valida con la impresora real.
- Logo monocromo ≥ 300 dpi: el código lo convierte si existe; no hay logo real
  cargado en laboratorio para validarlo visualmente.
