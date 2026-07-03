import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CashReconciliationPanel } from './CashReconciliationPanel';
import { buildExecutiveReport } from './testUtils';

describe('CashReconciliationPanel', () => {
  it('uses the shared empty state when no cash sessions exist', () => {
    render(<CashReconciliationPanel report={buildExecutiveReport({ cash_sessions: [] })} />);

    expect(screen.getByText(/sin sesiones de caja/i)).toBeInTheDocument();
    expect(screen.getByText(/las sesiones conciliadas apareceran/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders cash sessions inside the shared accessible table container', () => {
    render(
      <CashReconciliationPanel
        report={buildExecutiveReport({
          cash_sessions: [
            {
              id: 9,
              cashier: 'Caja Principal',
              opened_at: '2026-06-02T08:00:00.000000Z',
              closed_at: '2026-06-02T16:00:00.000000Z',
              opening_amount: '500.00',
              expected_cash: '700.00',
              counted_cash: '695.00',
              difference: '-5.00',
              status: 'closed',
              closure_note: 'Faltante validado',
            },
          ],
        })}
      />,
    );

    expect(screen.getByRole('region', { name: /sesiones de caja/i })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /sesiones de caja conciliadas/i })).toBeInTheDocument();
    expect(screen.getByText('Caja Principal')).toBeInTheDocument();
    expect(document.body.textContent).toContain('- L 5.00');
    expect(screen.getByText('Cerrada')).toBeInTheDocument();
  });

  it('shows human fallbacks when cash session dates are unavailable', () => {
    render(
      <CashReconciliationPanel
        report={buildExecutiveReport({
          cash_sessions: [
            {
              id: 10,
              cashier: 'Caja Validacion',
              opened_at: 'fecha-danada',
              closed_at: 'cierre-danado',
              opening_amount: '500.00',
              expected_cash: '500.00',
              counted_cash: '500.00',
              difference: '0.00',
              status: 'closed',
              closure_note: null,
            },
          ],
        })}
      />,
    );

    expect(screen.getAllByText('Fecha no disponible')).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(/Invalid Date|fecha-danada|cierre-danado/i);
  });
});
