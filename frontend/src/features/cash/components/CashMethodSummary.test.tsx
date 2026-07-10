import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CashMethodSummary } from './CashMethodSummary';

describe('CashMethodSummary', () => {
  it('shows recorded payment methods as one readable reconciliation list', () => {
    render(
      <CashMethodSummary
        paymentsByMethod={{
          cash: '72.50',
          transfer: '18.25',
          card: '9.75',
          other: '0.00',
        }}
        paymentsCount={4}
        pendingAmount="12.00"
      />,
    );

    const summary = screen.getByRole('region', { name: /métodos de pago/i });
    expect(within(summary).getByText('Efectivo')).toBeVisible();
    expect(within(summary).getByText('L 72.50')).toBeVisible();
    expect(within(summary).getByText('Transferencia')).toBeVisible();
    expect(within(summary).getByText('L 18.25')).toBeVisible();
    expect(within(summary).getByText(/4 pagos registrados/i)).toBeVisible();
    expect(within(summary).getByText(/L 12\.00 pendiente/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /registrar egreso/i })).not.toBeInTheDocument();
  });

  it('does not invent per-method counted values when the API does not provide them', () => {
    render(
      <CashMethodSummary
        paymentsByMethod={{ cash: '10.00', transfer: '0.00', card: '0.00', other: '0.00' }}
      />,
    );

    expect(screen.getByText(/el sistema no recibe conteos separados por método/i)).toBeVisible();
    expect(screen.queryByText(/contado por transferencia/i)).not.toBeInTheDocument();
  });
});
