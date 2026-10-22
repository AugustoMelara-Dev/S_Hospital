/**
 * Lectura del documento institucional ya generado.
 *
 * El preview y la descarga consumen el mismo documento que produce el servidor
 * (`GET /institutional-receipts/{id}/pdf?preview=1`, misma vista Blade que el
 * PDF). Este módulo NO compone ni estima el comprobante: sólo cuenta lo que el
 * documento realmente trae, para informar cuántos ejemplares contiene sin
 * confundir una hoja de dos zonas con dos páginas físicas.
 *
 * Contrato de composición (verificado en las plantillas vigentes
 * `pdf.institutional-receipts.compact` y `...classic`):
 *  - cada ejemplar suelto es un `<section class="receipt-page …">`; una hoja
 *    carta pareada contiene dos `data-receipt-zone` dentro de una sola sección;
 *  - la leyenda del ejemplar viaja en `data-receipt-copy-label`,
 *    `class="chip"` (compacto histórico) o
 *    `class="copy-label"` (classic): ORIGINAL / PRIMERA COPIA / SEGUNDA COPIA;
 *  - la leyenda de reimpresión, cuando el contador durable lo exige, es
 *    literalmente `REIMPRESIÓN #n` (nunca se deriva aquí).
 */

export type ReceiptDocumentSummary = {
  /** Ejemplares que el documento generado realmente define. */
  exemplarCount: number;
  /** Leyendas de ejemplar realmente impresas, en orden de aparición. */
  copyLabels: string[];
  /** Leyenda `REIMPRESIÓN #n` realmente presente en el documento, o `null`. */
  reprintLabel: string | null;
};

const COPY_LEGENDS = ['ORIGINAL', 'PRIMERA COPIA', 'SEGUNDA COPIA'] as const;

const CLASS_ATTRIBUTE_RE = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const COPY_LEGEND_ELEMENT_RE =
  /<(?:span|div|strong)[^>]*class\s*=\s*(?:"[^"]*\b(?:chip|copy-label)\b[^"]*"|'[^']*\b(?:chip|copy-label)\b[^']*')[^>]*>([^<]*)</gi;
const COPY_LEGEND_ATTRIBUTE_RE = /\bdata-receipt-copy-label\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const RECEIPT_ZONE_ATTRIBUTE_RE = /\bdata-receipt-zone\s*=\s*(?:"[^"]*"|'[^']*')/gi;
const REPRINT_RE = /REIMPRESI[ÓO]N\s*#\s*(\d+)/i;

export const EMPTY_RECEIPT_DOCUMENT: ReceiptDocumentSummary = {
  exemplarCount: 0,
  copyLabels: [],
  reprintLabel: null,
};

/** Sin `style`/`script`: comentarios y reglas CSS no cuentan como contenido. */
function stripStyleAndScript(html: string): string {
  return html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
}

/** Cuenta elementos cuya lista de clases incluye exactamente `receipt-page`. */
function countExemplarBlocks(markup: string): number {
  let pageCount = 0;

  for (const match of markup.matchAll(CLASS_ATTRIBUTE_RE)) {
    const value = match[1] ?? match[2] ?? '';
    if (/(^|\s)receipt-page(\s|$)/.test(value)) pageCount += 1;
  }

  const zoneCount = Array.from(markup.matchAll(RECEIPT_ZONE_ATTRIBUTE_RE)).length;

  return Math.max(pageCount, zoneCount);
}

function readCopyLabels(markup: string): string[] {
  const labels: string[] = [];

  for (const match of markup.matchAll(COPY_LEGEND_ATTRIBUTE_RE)) {
    const text = (match[1] ?? match[2] ?? '').trim().toUpperCase();
    if (COPY_LEGENDS.includes(text as (typeof COPY_LEGENDS)[number])) labels.push(text);
  }

  if (labels.length > 0) return labels;

  for (const match of markup.matchAll(COPY_LEGEND_ELEMENT_RE)) {
    const text = (match[1] ?? '').trim().toUpperCase();
    if (COPY_LEGENDS.includes(text as (typeof COPY_LEGENDS)[number])) labels.push(text);
  }

  return labels;
}

function readReprintLabel(markup: string): string | null {
  const match = REPRINT_RE.exec(markup);

  return match ? `REIMPRESIÓN #${Number(match[1])}` : null;
}

/**
 * Resumen verificable del documento recibido. `exemplarCount === 0` significa que
 * lo recibido no es un comprobante completo: la superficie debe decirlo, nunca
 * presentar un marco en blanco como si fuera el documento.
 */
export function summarizeReceiptDocument(html: string): ReceiptDocumentSummary {
  if (!html.trim()) return EMPTY_RECEIPT_DOCUMENT;

  const markup = stripStyleAndScript(html);

  return {
    exemplarCount: countExemplarBlocks(markup),
    copyLabels: readCopyLabels(markup),
    reprintLabel: readReprintLabel(markup),
  };
}

/**
 * «1 ejemplar» / «3 ejemplares», con las leyendas reales del conjunto.
 *
 * C2-R2 (MEDIUM): el conteo de bloques `.receipt-page` es el número de
 * **ejemplares** del conjunto, no el de páginas físicas. Con la hoja de dos zonas
 * un mismo ejemplar puede compartir página, y con una operación larga un ejemplar
 * puede ocupar más de una. El número real de páginas PDF lo publica el generador
 * en su plan medido (`page_count`); etiquetar estos bloques como «páginas» era
 * una subcuenta.
 */
export function documentExemplarsLabel(summary: ReceiptDocumentSummary): string {
  const exemplars = `${summary.exemplarCount} ${summary.exemplarCount === 1 ? 'ejemplar' : 'ejemplares'}`;

  return summary.copyLabels.length > 0 ? `${exemplars} (${summary.copyLabels.join(' · ')})` : exemplars;
}

/** Aviso de reimpresión con el número que el propio documento imprime. */
export function reprintNoticeLabel(reprintLabel: string): string {
  return `Reimpresión registrada · ${reprintLabel}`;
}
