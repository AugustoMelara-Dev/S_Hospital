import { createRef } from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CashClosingPanel } from './CashClosingPanel';

describe('CashClosingPanel', () => {
  it('explains a shortage in text and keeps the audited close action touch-sized', () => {
    render(
      <CashClosingPanel
        canCloseCash
        cashSessionId={77}
        closingAmount="95.00"
        closingAmountError={null}
        closingAmountRef={createRef<HTMLInputElement>()}
        closingNotes=""
        differenceCents={-500}
        hasCashDifference
        hasPendingBalance={false}
        missingInstitutionalReceiptCount={0}
        isSubmitting={false}
        onClosingAmountChange={vi.fn()}
        onClosingNotesChange={vi.fn()}
        onSubmit={vi.fn()}
        pendingAmount="0.00"
        pendingInvoiceCount={0}
      />,
    );

    expect(screen.getByRole('region', { name: /cerrar el turno/i })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /diferencia en vivo/i }))
      .toHaveAccessibleDescription(/faltante/i);
    expect(screen.getByText(/nota obligatoria/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /^cerrar caja$/i })).toBeEnabled();
    expect(screen.getByLabelText(/monto contado/i)).toHaveAttribute('inputmode', 'decimal');
    expect(screen.getByLabelText(/nota de cierre/i)).not.toBeRequired();
    expect(screen.queryByRole('button', { name: /registrar egreso/i })).not.toBeInTheDocument();
  });

  it('declara el conteo en cero confirmado sin confundirlo con un conteo no realizado', () => {
    const { unmount } = render(
      <CashClosingPanel
        canCloseCash
        cashSessionId={77}
        closingAmount=""
        closingAmountError={null}
        closingAmountRef={createRef<HTMLInputElement>()}
        closingNotes=""
        differenceCents={null}
        hasCashDifference={false}
        hasPendingBalance={false}
        missingInstitutionalReceiptCount={0}
        isSubmitting={false}
        onClosingAmountChange={vi.fn()}
        onClosingNotesChange={vi.fn()}
        onSubmit={vi.fn()}
        pendingAmount="0.00"
        pendingInvoiceCount={0}
      />,
    );

    // No realizado: conteo pendiente.
    expect(screen.getByRole('status', { name: /diferencia en vivo/i }))
      .toHaveAccessibleDescription(/conteo pendiente/i);
    unmount();

    render(
      <CashClosingPanel
        canCloseCash
        cashSessionId={77}
        closingAmount="0.00"
        closingAmountError={null}
        closingAmountReadOnly
        closingAmountRef={createRef<HTMLInputElement>()}
        closingNotes=""
        differenceCents={-5000}
        hasCashDifference
        hasPendingBalance={false}
        missingInstitutionalReceiptCount={0}
        isSubmitting={false}
        onClosingAmountChange={vi.fn()}
        onClosingNotesChange={vi.fn()}
        onSubmit={vi.fn()}
        pendingAmount="0.00"
        pendingInvoiceCount={0}
        zeroCountConfirmed
      />,
    );

    // Cero confirmado: la gaveta se declara sin efectivo, con su nota exigida.
    expect(screen.getByText(/la gaveta se declara sin efectivo/i)).toBeInTheDocument();
    expect(screen.getByText(/conteo en cero confirmado en el arqueo/i)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /diferencia en vivo/i }))
      .toHaveAccessibleDescription(/conteo en cero confirmado/i);
    expect(screen.getByText(/nota obligatoria/i)).toBeVisible();
  });

  it('places a history resolution action beside every invoice blocker', () => {
    render(
      <MemoryRouter>
        <CashClosingPanel
          canCloseCash
          canViewInvoices
          cashSessionId={77}
          closingAmount="100.00"
          closingAmountError={null}
          closingAmountRef={createRef<HTMLInputElement>()}
          closingNotes=""
          differenceCents={0}
          hasCashDifference={false}
          hasPendingBalance
          missingInstitutionalReceiptCount={2}
          isSubmitting={false}
          onClosingAmountChange={vi.fn()}
          onClosingNotesChange={vi.fn()}
          onSubmit={vi.fn()}
          pendingAmount="25.00"
          pendingInvoiceCount={1}
        />
      </MemoryRouter>,
    );

    const blockers = screen.getByRole('list', { name: /bloqueos del cierre/i });
    expect(within(blockers).getAllByRole('link', { name: /resolver en recibos/i })).toHaveLength(2);
    const blockerRows = within(blockers).getAllByRole('listitem');
    expect(blockerRows[0]).toHaveTextContent(/1 factura.*L\. 25\.00/i);
    expect(blockerRows[1]).toHaveTextContent(/2 recibos institucionales pendientes/i);
    expect(within(blockerRows[0]).getByRole('link', { name: /resolver en recibos/i }))
      .toHaveAttribute('href', '/recibos?balance_state=pending&reconciliation_cash_session_id=77');
    expect(within(blockerRows[1]).getByRole('link', { name: /resolver en recibos/i }))
      .toHaveAttribute('href', '/recibos?receipt_state=missing&reconciliation_cash_session_id=77');
  });
});
