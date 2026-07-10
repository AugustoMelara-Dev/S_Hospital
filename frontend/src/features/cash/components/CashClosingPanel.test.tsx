import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
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
    expect(screen.getByRole('button', { name: /^cerrar caja$/i })).toHaveClass('min-h-11');
    expect(screen.getByLabelText(/monto contado/i)).toHaveClass('min-h-11');
    expect(screen.queryByRole('button', { name: /registrar egreso/i })).not.toBeInTheDocument();
  });
});
