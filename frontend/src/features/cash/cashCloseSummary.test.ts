import { describe, expect, it, vi } from 'vitest';
import { buildCloseSummaryCsv, downloadCloseSummaryCsv } from './cashCloseSummary';

const closeSummary = {
  cashSessionId: 12,
  closedAt: '2026-07-06T17:30:00-06:00',
  openingAmount: 100,
  expectedAmount: 125,
  methods: { cash: '25.00', transfer: '10.00', card: '5.00', other: '0.00' },
  pendingAmount: 0,
  pendingInvoiceCount: 0,
  closingAmount: '124.00',
  difference: -1,
  closingNotes: 'Faltante "revisado"',
};

describe('cashCloseSummary', () => {
  it('builds an auditable close summary CSV with BOM and escaped values', () => {
    const csv = buildCloseSummaryCsv(closeSummary);

    expect([...new TextEncoder().encode(csv).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(csv.startsWith('\uFEFF"Campo","Valor"')).toBe(true);
    expect(csv).toContain('"Caja","Caja #12"');
    expect(csv).toContain('"Nota","Faltante ""revisado"""');
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
    await expect(readBlobText(blob)).resolves.toContain('"Diferencia","- L 1.00"');
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
