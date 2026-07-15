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
        closingAmount="95.00"
        closingAmountError={null}
        closingAmountRef={createRef<HTMLInputElement>()}
        closingNotes=""
        difference={-5}
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

    expect(screen.getByRole('region', { name: /cierre guiado/i })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /diferencia en vivo/i }))
      .toHaveAccessibleDescription(/faltante/i);
    expect(screen.getByText(/nota obligatoria/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /^cerrar caja$/i })).toBeEnabled();
    expect(screen.getByLabelText(/monto contado/i)).toHaveAttribute('inputmode', 'decimal');
    expect(screen.getByLabelText(/nota de cierre/i)).not.toBeRequired();
    expect(screen.queryByRole('button', { name: /registrar egreso/i })).not.toBeInTheDocument();
  });

  it('places a history resolution action beside every invoice blocker', () => {
    render(
      <MemoryRouter>
        <CashClosingPanel
          canCloseCash
          canViewInvoices
          closingAmount="100.00"
          closingAmountError={null}
          closingAmountRef={createRef<HTMLInputElement>()}
          closingNotes=""
          difference={0}
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
    expect(within(blockers).getAllByRole('link', { name: /resolver en historial/i })).toHaveLength(2);
    const blockerRows = within(blockers).getAllByRole('listitem');
    expect(blockerRows[0]).toHaveTextContent(/1 factura.*L 25\.00/i);
    expect(blockerRows[1]).toHaveTextContent(/2 recibos institucionales pendientes/i);
  });
});
