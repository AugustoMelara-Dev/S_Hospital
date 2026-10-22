import { describe, expect, it } from 'vitest';
import {
  documentExemplarsLabel,
  reprintNoticeLabel,
  summarizeReceiptDocument,
} from './receiptDocumentSummary';

/**
 * Contrato de composición de las plantillas institucionales vigentes:
 * `pdf.institutional-receipts.compact` (una página por ejemplar),
 * `...compact-pair` (dos zonas en una hoja) y `...classic`.
 */

function compactPage(copyLabel: string, receiptNumber = 'REC-A-00000070'): string {
  return `<section class="receipt-page">
    <div class="receipt-layout profile-carta_vertical" data-receipt-style="compact-monochrome">
      <span class="chip">${copyLabel}</span>
      <div class="doc-number">${receiptNumber}</div>
      <div class="patient-block">
        <span class="label label-block">Paciente</span>
        <span class="patient-name">Maria Lopez</span>
      </div>
      <div class="items-table"><div class="item-row">
        <span class="item-name">Hemograma completo</span>
        <span class="qty">2.00</span>
        <span class="money">L. 40.00</span>
        <span class="money money-strong">L. 92.00</span>
      </div></div>
      <div class="totals-table"><div class="grand-total">
        <span>Total</span><span class="money">L. 92.00</span>
      </div></div>
    </div>
  </section>`;
}

const COMPACT_STYLE = `<style>
  .receipt-page { page-break-after: always; }
  .receipt-page:last-child { page-break-after: auto; }
  .chip { border: 1px solid; }
</style>`;

describe('summarizeReceiptDocument', () => {
  it('cuenta las dos zonas de una hoja carta pareada como dos ejemplares', () => {
    const html = `<!DOCTYPE html><html><body>
      <section class="receipt-page" data-receipt-composition="paired">
        <div data-receipt-zone="1"><span class="chip" data-receipt-copy-label="ORIGINAL">ORIGINAL · Ejemplar del paciente</span></div>
        <div data-receipt-cut-line>Línea de corte</div>
        <div data-receipt-zone="2"><span class="chip" data-receipt-copy-label="PRIMERA COPIA">PRIMERA COPIA · Ejemplar para archivo del hospital</span></div>
      </section>
    </body></html>`;

    const summary = summarizeReceiptDocument(html);

    expect(summary.exemplarCount).toBe(2);
    expect(summary.copyLabels).toEqual(['ORIGINAL', 'PRIMERA COPIA']);
    expect(documentExemplarsLabel(summary)).toBe('2 ejemplares (ORIGINAL · PRIMERA COPIA)');
  });

  it('cuenta las páginas/ejemplares del documento generado, no las reglas CSS', () => {
    const html = `<!DOCTYPE html><html lang="es"><head>${COMPACT_STYLE}</head><body>
      ${compactPage('ORIGINAL')}
      ${compactPage('PRIMERA COPIA')}
    </body></html>`;

    const summary = summarizeReceiptDocument(html);

    expect(summary.exemplarCount).toBe(2);
    expect(summary.copyLabels).toEqual(['ORIGINAL', 'PRIMERA COPIA']);
    expect(summary.reprintLabel).toBeNull();
    expect(documentExemplarsLabel(summary)).toBe('2 ejemplares (ORIGINAL · PRIMERA COPIA)');
  });

  it('lee la leyenda de reimpresión con el número que el documento imprime', () => {
    const html = `<html><body>${compactPage('ORIGINAL').replace(
      '<span class="chip">ORIGINAL</span>',
      '<span class="chip">ORIGINAL</span><span class="chip">REIMPRESIÓN #3</span>',
    )}</body></html>`;

    const summary = summarizeReceiptDocument(html);

    expect(summary.reprintLabel).toBe('REIMPRESIÓN #3');
    expect(reprintNoticeLabel(summary.reprintLabel!)).toBe('Reimpresión registrada · REIMPRESIÓN #3');
  });

  it('acepta la plantilla clásica (leyenda copy-label) y una sola página', () => {
    const html = `<html><head>${COMPACT_STYLE}</head><body>
      <section class="receipt-page primary-paper">
        <div class="receipt-layout">
          <span class="copy-label">ORIGINAL</span>
          <div class="document-title">Recibo institucional</div>
        </div>
      </section>
    </body></html>`;

    const summary = summarizeReceiptDocument(html);

    expect(summary.exemplarCount).toBe(1);
    expect(summary.copyLabels).toEqual(['ORIGINAL']);
    expect(documentExemplarsLabel(summary)).toBe('1 ejemplar (ORIGINAL)');
  });

  it('no cuenta clases que sólo se parecen al bloque de página', () => {
    const html = `<html><body>
      <div class="receipt-page-number">REC-A-00000070</div>
      <section class="no-receipt-page">x</section>
    </body></html>`;

    expect(summarizeReceiptDocument(html).exemplarCount).toBe(0);
  });

  it('declara el documento vacío como no utilizable en lugar de inventar páginas', () => {
    expect(summarizeReceiptDocument('')).toEqual({ exemplarCount: 0, copyLabels: [], reprintLabel: null });
    expect(summarizeReceiptDocument('<html><body><p>recibo</p></body></html>')).toEqual({
      exemplarCount: 0,
      copyLabels: [],
      reprintLabel: null,
    });
  });

  it('normaliza el número de reimpresión sin letras ni símbolos de más', () => {
    const html = `<html><body><section class="receipt-page">
      <span class="chip">ORIGINAL</span><span class="chip">Reimpresión   # 12</span>
    </section></body></html>`;

    expect(summarizeReceiptDocument(html).reprintLabel).toBe('REIMPRESIÓN #12');
  });
});
