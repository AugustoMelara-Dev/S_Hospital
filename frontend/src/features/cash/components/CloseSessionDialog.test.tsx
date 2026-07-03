import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CloseSessionDialog } from './CloseSessionDialog';

describe('CloseSessionDialog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('has accessible title and description while preserving difference confirmation', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <CloseSessionDialog
        open
        onOpenChange={onOpenChange}
        session={{
          opening_amount: '100.00',
          expected_cash_amount: '100.00',
          payments_by_method: { cash: '0.00', transfer: '0.00', card: '0.00', other: '0.00' },
          pending_invoice_count: 0,
          pending_amount: '0.00',
        }}
        closingAmount="90.00"
        closingNotes=""
        difference={-10}
        isSubmitting={false}
        onClosingNotesChange={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    const dialog = screen.getByRole('alertdialog', { name: /cerrar caja/i });
    expect(dialog).toHaveAccessibleDescription(/monto apertura/i);
    expect(screen.getByRole('heading', { name: /1\. resumen del turno/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /2\. conteo de efectivo/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /3\. confirmar cierre/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/nota sobre la diferencia/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: /^cerrar caja$/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('requires a useful note before confirming a cash difference', () => {
    const onConfirm = vi.fn();
    const onClosingNotesChange = vi.fn();

    render(
      <CloseSessionDialog
        open
        onOpenChange={vi.fn()}
        session={{
          opening_amount: '100.00',
          expected_cash_amount: '100.00',
          payments_by_method: { cash: '0.00', transfer: '0.00', card: '0.00', other: '0.00' },
          pending_invoice_count: 0,
          pending_amount: '0.00',
        }}
        closingAmount="105.00"
        closingNotes="x"
        difference={5}
        isSubmitting={false}
        onClosingNotesChange={onClosingNotesChange}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByLabelText(/nota sobre la diferencia/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: /^cerrar caja$/i })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/al menos 5 caracteres/i);

    fireEvent.change(screen.getByLabelText(/nota sobre la diferencia/i), {
      target: { value: 'Sobrante confirmado' },
    });

    expect(onClosingNotesChange).toHaveBeenCalledWith('Sobrante confirmado');
  });

  it('prints only the close summary without confirming the cash close', () => {
    const onConfirm = vi.fn();
    const print = vi.fn(() => {
      expect(document.body.dataset.printingCashClose).toBe('true');
    });
    vi.stubGlobal('print', print);

    render(
      <CloseSessionDialog
        open
        onOpenChange={vi.fn()}
        session={{
          opening_amount: '100.00',
          expected_cash_amount: '125.00',
          payments_by_method: { cash: '25.00', transfer: '0.00', card: '0.00', other: '0.00' },
          pending_invoice_count: 0,
          pending_amount: '0.00',
        }}
        closingAmount="125.00"
        closingNotes=""
        difference={0}
        isSubmitting={false}
        onClosingNotesChange={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /imprimir resumen/i }));

    expect(document.querySelector('[data-cash-close-print-root]')).toBeInTheDocument();
    expect(print).toHaveBeenCalledTimes(1);
    expect(document.body.dataset.printingCashClose).toBeUndefined();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('exports the close summary without confirming the cash close', async () => {
    const onConfirm = vi.fn();
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

    render(
      <CloseSessionDialog
        open
        onOpenChange={vi.fn()}
        session={{
          opening_amount: '100.00',
          expected_cash_amount: '125.00',
          payments_by_method: { cash: '25.00', transfer: '10.00', card: '5.00', other: '0.00' },
          pending_invoice_count: 0,
          pending_amount: '0.00',
        }}
        closingAmount="124.00"
        closingNotes="Faltante revisado"
        difference={-1}
        isSubmitting={false}
        onClosingNotesChange={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /exportar resumen/i }));

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    const exportedBlob = createObjectURL.mock.calls[0]?.[0] as Blob;
    const exportedBytes = new Uint8Array(await readBlobBytes(exportedBlob));
    const exportedText = await readBlobText(exportedBlob);
    expect([...exportedBytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(exportedText).toMatch(/^"Campo","Valor"/);
    expect(exportedText).toContain('"Nota","Faltante revisado"');
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:cash-close-summary');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('does not allow confirming close while invoices are pending', () => {
    const onConfirm = vi.fn();

    render(
      <CloseSessionDialog
        open
        onOpenChange={vi.fn()}
        session={{
          opening_amount: '100.00',
          expected_cash_amount: '125.00',
          payments_by_method: { cash: '25.00', transfer: '0.00', card: '0.00', other: '0.00' },
          pending_invoice_count: 1,
          pending_amount: '30.00',
        }}
        closingAmount="125.00"
        closingNotes=""
        difference={0}
        isSubmitting={false}
        onClosingNotesChange={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    const closeButton = screen.getByRole('button', { name: /^cerrar caja$/i });
    expect(screen.getByText(/factura\(s\) pendientes o parciales/i)).toBeInTheDocument();
    expect(closeButton).toBeDisabled();

    fireEvent.click(closeButton);

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('explains why closing is blocked when pending amount exists without pending count', () => {
    const onConfirm = vi.fn();

    render(
      <CloseSessionDialog
        open
        onOpenChange={vi.fn()}
        session={{
          opening_amount: '100.00',
          expected_cash_amount: '125.00',
          payments_by_method: { cash: '25.00', transfer: '0.00', card: '0.00', other: '0.00' },
          pending_invoice_count: 0,
          pending_amount: '30.00',
        }}
        closingAmount="125.00"
        closingNotes=""
        difference={0}
        isSubmitting={false}
        onClosingNotesChange={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    const closeButton = screen.getByRole('button', { name: /^cerrar caja$/i });
    expect(screen.getByText(/hay saldo pendiente en esta caja/i)).toBeInTheDocument();
    expect(screen.getByText(/revise historial antes de cerrar/i)).toBeInTheDocument();
    expect(closeButton).toBeDisabled();

    fireEvent.click(closeButton);

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('uses opening amount as expected cash fallback for legacy session payloads', () => {
    render(
      <CloseSessionDialog
        open
        onOpenChange={vi.fn()}
        session={{
          opening_amount: '100.00',
          expected_cash_amount: null,
          expected_amount: null,
          payments_by_method: { cash: '0.00', transfer: '0.00', card: '0.00', other: '0.00' },
          pending_invoice_count: 0,
          pending_amount: '0.00',
        }}
        closingAmount="100.00"
        closingNotes=""
        difference={0}
        isSubmitting={false}
        onClosingNotesChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('alertdialog', { name: /cerrar caja/i });
    expect(dialog).toHaveTextContent(/monto apertura:\s*L 100\.00/i);
    expect(dialog).toHaveTextContent(/efectivo esperado:\s*L 100\.00/i);
  });
});

function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
}

function readBlobBytes(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(blob);
  });
}
