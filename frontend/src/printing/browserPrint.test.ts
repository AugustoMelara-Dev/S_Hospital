import { afterEach, describe, expect, it, vi } from 'vitest';
import { printReceiptDocument } from './browserPrint';

describe('printReceiptDocument', () => {
  afterEach(() => {
    delete document.body.dataset.receiptWidth;
    delete document.body.dataset.printingReceipt;
    vi.restoreAllMocks();
  });

  it('activates the receipt-only print boundary while the browser dialog opens', () => {
    const print = vi.fn(() => {
      expect(document.body.dataset.receiptWidth).toBe('a5');
      expect(document.body.dataset.printingReceipt).toBe('true');
    });

    printReceiptDocument('a5', print);

    expect(print).toHaveBeenCalledOnce();
    expect(document.body.dataset.receiptWidth).toBeUndefined();
    expect(document.body.dataset.printingReceipt).toBeUndefined();
  });

  it('restores a pre-existing print boundary when printing fails', () => {
    document.body.dataset.receiptWidth = 'letter';
    document.body.dataset.printingReceipt = 'pending';

    expect(() => printReceiptDocument('58mm', () => {
      throw new Error('dialog unavailable');
    })).toThrow('dialog unavailable');

    expect(document.body.dataset.receiptWidth).toBe('letter');
    expect(document.body.dataset.printingReceipt).toBe('pending');
  });
});
