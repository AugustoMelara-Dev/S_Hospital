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

## Evidencia generada (A-05)

Generador reproducible (omitido por defecto):
`backend/tests/Feature/Evidence/ReceiptFormatsEvidenceTest.php`, ejecutado con
`S_HOSPITAL_RECEIPT_EVIDENCE_DIR=hospital-ai/evidencia/ENTREGA-20261021/recibos`.

Escribe un PDF vectorial por formato con una cuenta de 31 líneas (10 al 15 %,
10 al 18 %, 9 exentas, 1 EPO gratuita), nombre de paciente largo y un importe de
6 cifras:

| Archivo | MediaBox (pt) | Páginas |
|---|---|---|
| `carta.pdf` | 612 × 792 | 2 |
| `media-carta.pdf` | 612 × 396 | 3 |
| `termica-80mm.pdf` | 226.772 × 3163.930 | 1 |
| `termica-58mm.pdf` | 164.409 × 3401.575 | 2 |

80 mm = 226.8 pt y 58 mm = 164.4 pt, con alto de rollo dinámico: confirma la
plantilla térmica dedicada (no la carta encogida).

## No verificado (pendiente, no se declara hecho)

- **PNG a 300/203 dpi**: no hay rasterizador instalado en esta PC (sin
  Ghostscript, ImageMagick ni poppler; `convert.exe` es la utilidad de
  Windows, no ImageMagick). Generar PNG exige instalar una herramienta externa
  (descarga/UAC) o hacerlo en otra máquina. Los PDFs vectoriales sí están
  generados y los tests validan paginación/contenido/geometría.
- **Impresora física** (carta, 2 ejemplares, corte, térmica real): Fase 7, en el
  hospital.
- Logo monocromo ≥ 300 dpi: el código lo convierte si existe; no hay logo real
  cargado en laboratorio para validarlo visualmente.
