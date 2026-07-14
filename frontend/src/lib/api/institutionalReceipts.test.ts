import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './base';
import { institutionalReceipts } from './institutionalReceipts';

describe('institutionalReceipts API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads the first receipt PDF with GET when no reprint reason is provided', async () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' });
    const download = vi.spyOn(apiClient, 'download').mockResolvedValue(blob);
    const postDownload = vi.spyOn(apiClient, 'postDownload').mockResolvedValue(blob);

    await expect(institutionalReceipts.pdf(42)).resolves.toBe(blob);

    expect(download).toHaveBeenCalledWith('/api/institutional-receipts/42/pdf');
    expect(postDownload).not.toHaveBeenCalled();
  });

  it('sends reprint reasons in a POST body instead of the URL', async () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' });
    const download = vi.spyOn(apiClient, 'download').mockResolvedValue(blob);
    const postDownload = vi.spyOn(apiClient, 'postDownload').mockResolvedValue(blob);

    await expect(institutionalReceipts.pdf(42, '  Reposicion solicitada  ')).resolves.toBe(blob);

    expect(download).not.toHaveBeenCalled();
    expect(postDownload).toHaveBeenCalledWith('/api/institutional-receipts/42/pdf', {
      reason: 'Reposicion solicitada',
    });
  });

  it('allows institutional receipt creation with a caller-managed idempotency key', async () => {
    const request = vi.spyOn(apiClient, 'request').mockResolvedValue({
      data: { id: 42, receipt_number_full: 'REC-A-00000042' },
    });

    await expect(institutionalReceipts.store(
      { invoice_id: 12 },
      { idempotencyKey: 'institutional-receipt-attempt-1' },
    )).resolves.toMatchObject({ id: 42 });

    expect(request).toHaveBeenCalledWith('/api/institutional-receipts', {
      method: 'POST',
      idempotencyKey: 'institutional-receipt-attempt-1',
      headers: { 'Idempotency-Key': 'institutional-receipt-attempt-1' },
      body: JSON.stringify({ invoice_id: 12 }),
    });
  });

  it('allows print events with a caller-managed idempotency key', async () => {
    const request = vi.spyOn(apiClient, 'request').mockResolvedValue({
      data: { receipt: { id: 42, receipt_number_full: 'REC-A-00000042' } },
    });

    await expect(institutionalReceipts.registerPrintEvent(
      42,
      'Copia solicitada por auditoria',
      { idempotencyKey: 'print-event-attempt-1' },
    )).resolves.toMatchObject({ id: 42 });

    expect(request).toHaveBeenCalledWith('/api/institutional-receipts/42/print-events', {
      method: 'POST',
      idempotencyKey: 'print-event-attempt-1',
      headers: { 'Idempotency-Key': 'print-event-attempt-1' },
      body: JSON.stringify({ reason: 'Copia solicitada por auditoria' }),
    });
  });

  it('allows institutional PDF reprints with a caller-managed idempotency key', async () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' });
    const postDownload = vi.spyOn(apiClient, 'postDownload').mockResolvedValue(blob);

    await expect(institutionalReceipts.pdf(
      42,
      '  Reposicion solicitada  ',
      { idempotencyKey: 'institutional-pdf-attempt-1' },
    )).resolves.toBe(blob);

    expect(postDownload).toHaveBeenCalledWith('/api/institutional-receipts/42/pdf', {
      reason: 'Reposicion solicitada',
    }, {
      idempotencyKey: 'institutional-pdf-attempt-1',
    });
  });
});
