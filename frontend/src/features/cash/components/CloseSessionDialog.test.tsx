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

  it('prints the close summary without confirming the cash close', () => {
    const onConfirm = vi.fn();
    const print = vi.fn();
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

    expect(print).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('exports the close summary without confirming the cash close', () => {
    const onConfirm = vi.fn();
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const createObjectURL = vi.fn(() => 'blob:cash-close-summary');
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
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:cash-close-summary');
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
