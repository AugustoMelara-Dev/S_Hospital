import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PendingAgingPanel } from './PendingAgingPanel';
import { buildExecutiveReport } from './testUtils';

describe('PendingAgingPanel', () => {
  it('uses the shared empty state when no pending invoices exist', () => {
    render(<PendingAgingPanel report={buildExecutiveReport()} />);

    expect(screen.getByText(/sin facturas pendientes/i)).toBeInTheDocument();
    expect(screen.getByText(/las facturas con saldo abierto apareceran/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders pending invoices inside the shared accessible table container', () => {
    render(
      <PendingAgingPanel
        report={buildExecutiveReport({
          pending_aging: {
            '0_7_days': { count: 1, amount: '150.00' },
            '8_30_days': { count: 0, amount: '0.00' },
            '31_plus_days': { count: 0, amount: '0.00' },
            items: [
              {
                invoice_number: 'FAC-000123',
                patient: 'Maria Lopez',
                total: '200.00',
                balance_due: '150.00',
                issued_at: '2026-06-02T08:00:00.000000Z',
                age_days: 4,
                bucket: '0_7_days',
              },
            ],
          },
        })}
      />,
    );

    expect(screen.getByRole('region', { name: /facturas pendientes/i })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /facturas pendientes por antiguedad/i })).toBeInTheDocument();
    expect(screen.getByText('FAC-000123')).toBeInTheDocument();
    expect(screen.getByText('Maria Lopez')).toBeInTheDocument();
    expect(screen.getByText('4 d')).toBeInTheDocument();
    expect(document.body.textContent).toContain('L 150.00');
  });
});
