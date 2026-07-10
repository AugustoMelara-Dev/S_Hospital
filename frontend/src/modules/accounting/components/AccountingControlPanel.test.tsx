import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AccountingControlPanel } from './AccountingControlPanel';

describe('AccountingControlPanel', () => {
  it('shows every operational accounting fact without inventing expenses', () => {
    render(
      <MemoryRouter>
        <AccountingControlPanel canViewInvoices reconciliation={{
          payments_total: '216.35',
          pending_invoice_count: 2,
          pending_amount: '35.50',
          missing_institutional_receipt_count: 1,
          reversed_payments_count: 3,
          reversed_payments_total: '42.75',
          status: 'open',
          difference_amount: '-5.00',
        }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /control contable de caja/i })).toBeInTheDocument();
    expect(screen.getByText('L 35.50')).toBeInTheDocument();
    expect(screen.getByText(/2 facturas pendientes/i)).toBeInTheDocument();
    expect(screen.getByText(/1 recibo institucional pendiente/i)).toBeInTheDocument();
    expect(screen.getByText('L 42.75')).toBeInTheDocument();
    expect(screen.getByText(/3 pagos reversados/i)).toBeInTheDocument();
    expect(screen.getByText('L 216.35')).toBeInTheDocument();
    expect(screen.getByText('- L 5.00')).toHaveAccessibleDescription(/faltante/i);
    expect(screen.getByText(/cierre en preparación/i)).toBeInTheDocument();
    expect(screen.getByText(/egresos operativos no est[aá]n modelados/i)).toBeInTheDocument();
    expect(screen.queryByText(/egresos.*L 0\.00/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /registrar egreso/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /resolver en historial/i })).toHaveAttribute('href', '/invoices');
  });

  it('shows a ready state when there are no close blockers', () => {
    render(
      <MemoryRouter>
        <AccountingControlPanel reconciliation={{}} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/sin pendientes que bloqueen el cierre/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /resolver en historial/i })).not.toBeInTheDocument();
  });

  it('explains blockers without a history action when invoices.view is missing', () => {
    render(
      <MemoryRouter>
        <AccountingControlPanel
          canViewInvoices={false}
          reconciliation={{ pending_invoice_count: 1, pending_amount: '20.00' }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/solicite apoyo a un usuario con acceso al historial/i)).toBeVisible();
    expect(screen.queryByRole('link', { name: /resolver en historial/i })).not.toBeInTheDocument();
  });
});
