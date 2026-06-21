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
});
