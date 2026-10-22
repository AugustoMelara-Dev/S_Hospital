import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { institutionalReceipts } from '@/lib/api/institutionalReceipts';
import { InstitutionalReceiptPreviewFrame } from './InstitutionalReceiptPreviewFrame';

afterEach(() => vi.restoreAllMocks());

function receiptDocument(copyLabels: string[], reprintLabel?: string): string {
  const pages = copyLabels
    .map(
      (label) => `<section class="receipt-page">
        <div class="receipt-layout">
          <span class="chip">${label}</span>
          ${reprintLabel ? `<span class="chip">${reprintLabel}</span>` : ''}
          <div class="doc-number">REC-A-00000042</div>
          <span class="patient-name">Maria Lopez</span>
          <table class="items-table"><tbody><tr><td>Hemograma completo</td>
            <td class="money">L. 92.00</td></tr></tbody></table>
          <table class="totals-table"><tr class="grand-total"><td>Total</td>
            <td class="money">L. 92.00</td></tr></table>
        </div>
      </section>`,
    )
    .join('');

  return `<!doctype html><html><head><style>.receipt-page{page-break-after:always}</style></head><body>${pages}</body></html>`;
}

function renderFrame() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <InstitutionalReceiptPreviewFrame receiptId={42} receiptNumber="REC-A-00000042" />
    </QueryClientProvider>,
  );
}

describe('InstitutionalReceiptPreviewFrame', () => {
  it('anuncia «preparando» mientras el documento no llega', () => {
    vi.spyOn(institutionalReceipts, 'previewHtml').mockReturnValue(new Promise<string>(() => {}));

    renderFrame();

    const status = screen.getByRole('status', { name: /preparando vista previa del recibo/i });
    expect(status).toHaveTextContent(/preparando la vista previa del recibo/i);
    expect(screen.queryByTitle(/Vista previa del recibo institucional/i)).not.toBeInTheDocument();
  });

  it('distingue el error del estado listo y permite reintentar', async () => {
    const user = userEvent.setup();
    const preview = vi
      .spyOn(institutionalReceipts, 'previewHtml')
      .mockRejectedValue(new Error('servidor local no responde'));

    renderFrame();

    expect(await screen.findByText(/no se pudo preparar la vista previa/i)).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: /preparando vista previa/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /reintentar/i }));
    await waitFor(() => expect(preview).toHaveBeenCalledTimes(2));
  });

  it('renderiza el documento generado y declara sus ejemplares reales', async () => {
    const html = receiptDocument(['ORIGINAL', 'PRIMERA COPIA']);
    vi.spyOn(institutionalReceipts, 'previewHtml').mockResolvedValue(html);

    renderFrame();

    const frame = await screen.findByTitle('Vista previa del recibo institucional REC-A-00000042');
    expect(frame).toHaveAttribute('srcdoc', html);
    // El marco carga el documento real: paciente, líneas y totales vienen del
    // comprobante generado, no de una maqueta paralela.
    const srcdoc = frame.getAttribute('srcdoc') ?? '';
    expect(srcdoc).toContain('Maria Lopez');
    expect(srcdoc).toContain('Hemograma completo');
    expect(srcdoc).toContain('L. 92.00');
    expect(frame).toHaveClass('border', 'border-[var(--ui-line)]', 'bg-receipt-paper');
    expect(frame).not.toHaveClass('rounded-md', 'shadow-sm', 'border-border', 'bg-muted/20');
    // El documento vive en una superficie continua dentro del diálogo; no se
    // envuelve en una segunda tarjeta.
    expect(frame.parentElement).toHaveClass('overflow-hidden', 'bg-[var(--ui-surface-alt)]');
    expect(frame.parentElement).not.toHaveClass('rounded-[var(--ui-radius-panel)]', 'p-4');
    expect(frame.parentElement).not.toHaveClass('bg-muted/20');

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Vista previa del recibo');
    // El conteo de bloques del documento es el número de EJEMPLARES del
    // conjunto; el número real de páginas PDF lo publica el plan del generador.
    expect(status).toHaveTextContent('2 ejemplares (ORIGINAL · PRIMERA COPIA)');
    expect(institutionalReceipts.previewHtml).toHaveBeenCalledWith(42);
  });

  it('anuncia dos ejemplares cuando comparten una hoja carta con línea de corte', async () => {
    vi.spyOn(institutionalReceipts, 'previewHtml').mockResolvedValue(`<!doctype html><html><body>
      <section class="receipt-page" data-receipt-composition="paired">
        <div data-receipt-zone="1"><span data-receipt-copy-label="ORIGINAL">Original · paciente</span></div>
        <div data-receipt-cut-line>Línea de corte</div>
        <div data-receipt-zone="2"><span data-receipt-copy-label="PRIMERA COPIA">Copia · archivo</span></div>
      </section>
    </body></html>`);

    renderFrame();

    expect(await screen.findByText('2 ejemplares (ORIGINAL · PRIMERA COPIA)')).toBeInTheDocument();
  });

  it('muestra el aviso de reimpresión con el número del documento', async () => {
    vi.spyOn(institutionalReceipts, 'previewHtml').mockResolvedValue(
      receiptDocument(['ORIGINAL'], 'REIMPRESIÓN #2'),
    );

    renderFrame();

    expect(await screen.findByText(/Reimpresión registrada · REIMPRESIÓN #2/i)).toBeInTheDocument();
  });

  it('no presenta un marco en blanco cuando lo recibido no es el comprobante completo', async () => {
    vi.spyOn(institutionalReceipts, 'previewHtml').mockResolvedValue('<html><body>REC-00000070</body></html>');

    renderFrame();

    expect(await screen.findByText(/vista previa incompleta/i)).toBeInTheDocument();
    expect(screen.queryByTitle(/Vista previa del recibo institucional/i)).not.toBeInTheDocument();
    expect(screen.getByText(/no incluye las páginas del comprobante/i)).toBeInTheDocument();
  });
});
