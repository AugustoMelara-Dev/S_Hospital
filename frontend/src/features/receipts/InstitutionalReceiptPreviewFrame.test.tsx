import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { institutionalReceipts } from '@/lib/api/institutionalReceipts';
import { InstitutionalReceiptPreviewFrame } from './InstitutionalReceiptPreviewFrame';

afterEach(() => vi.restoreAllMocks());

describe('InstitutionalReceiptPreviewFrame', () => {
  it('renders the exact HTML produced by the institutional PDF builder', async () => {
    const html = '<!doctype html><html><body><h1>REC-A-00000042</h1></body></html>';
    vi.spyOn(institutionalReceipts, 'previewHtml').mockResolvedValue(html);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <InstitutionalReceiptPreviewFrame receiptId={42} receiptNumber="REC-A-00000042" />
      </QueryClientProvider>,
    );

    const frame = await screen.findByTitle('Vista previa del recibo institucional REC-A-00000042');
    expect(frame).toHaveAttribute('srcdoc', html);
    expect(frame).toHaveClass('rounded-md', 'border', 'bg-receipt-paper', 'shadow-sm');
    expect(frame.closest('[data-slot="card"]')).toHaveClass('overflow-hidden', 'bg-muted/30');
    expect(frame.parentElement).toHaveClass('p-2', 'sm:p-3');
    expect(institutionalReceipts.previewHtml).toHaveBeenCalledWith(42);
  });
});
