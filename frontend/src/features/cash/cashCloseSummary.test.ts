import { describe, expect, it, vi } from 'vitest';
import { buildCloseSummaryCsv, downloadCloseSummaryCsv } from './cashCloseSummary';

const closeSummary = {
  cashSessionId: 12,
  closedAt: '2026-07-06T17:30:00-06:00',
  openingAmountCents: 10000,
  expectedAmountCents: 12500,
  methodsCents: { cash: 2500, transfer: 1000, card: 500, other: 0 },
  pendingAmountCents: 0,
  pendingInvoiceCount: 0,
  closingAmountCents: 12400,
  differenceCents: -100,
  closingNotes: 'Faltante "revisado"',
  closingBreakdown: {
    bills: { '500': 0, '200': 0, '100': 1, '50': 0, '20': 1, '10': 0, '5': 0, '2': 2, '1': 0 },
    other_amount: '0.50',
  },
};

describe('cashCloseSummary', () => {
  it('builds an auditable close summary CSV with BOM and escaped values', () => {
    const csv = buildCloseSummaryCsv(closeSummary);

    expect([...new TextEncoder().encode(csv).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(csv.startsWith('\uFEFF"Campo","Valor"')).toBe(true);
    expect(csv).toContain('"Sesión de caja","#12"');
    expect(csv).toContain('"Billetes L 100","1"');
    expect(csv).toContain('"Billetes L 2","2"');
    expect(csv).toContain('"Monedas y otros","L. 0.50"');
    expect(csv).toContain('"Nota","Faltante ""revisado"""');
  });

  it('writes the missing-value label instead of a false L 0.00 when an amount is absent', () => {
    const csv = buildCloseSummaryCsv({
      ...closeSummary,
      openingAmountCents: null,
      closingAmountCents: null,
      differenceCents: null,
    });

    expect(csv).toContain('"Monto apertura","No disponible"');
    expect(csv).toContain('"Monto contado","No disponible"');
    expect(csv).toContain('"Diferencia","No disponible"');

    // Ningún campo ausente se disfraza de cero...
    for (const field of ['Monto apertura', 'Monto contado', 'Diferencia']) {
      expect(csv).not.toContain(`"${field}","L. 0.00"`);
    }

    // ...pero un cero presente sigue siendo un cero legítimo.
    expect(csv).toContain('"Otros","L. 0.00"');
    expect(csv).toContain('"Saldo pendiente","L. 0.00"');
  });

  it('downloads the close summary CSV and releases the object URL', async () => {
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const createObjectURL = vi.fn((blob: Blob) => {
      void blob;
      return 'blob:cash-close-summary';
    });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });

    const blob = downloadCloseSummaryCsv(closeSummary, new Date('2026-07-07T08:00:00-06:00'));

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    await expect(readBlobText(blob)).resolves.toContain('"Diferencia","- L. 1.00"');
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:cash-close-summary');
  });
});

function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}
