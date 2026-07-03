import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CashMovementsTable, type CashMovement } from './CashMovementsTable';

describe('CashMovementsTable', () => {
  it('shows payment movements as positive entries and payment voids as negative entries', () => {
    render(
      <CashMovementsTable
        movements={[
          movement({ id: 1, type: 'payment', method: 'cash', amount: '51.75' }),
          movement({ id: 2, type: 'payment_void', method: 'cash', amount: '17.25' }),
          movement({ id: 3, type: 'closing', method: 'closing', amount: '134.50' }),
        ]}
      />,
    );

    expect(rowFor('Pago')).toHaveTextContent('+ L 51.75');
    expect(rowFor('Reverso de pago')).toHaveTextContent('- L 17.25');
    expect(rowFor('Cierre')).toHaveTextContent('L 134.50');
    expect(rowFor('Cierre')).not.toHaveTextContent('- L 134.50');
    expect(screen.queryByText('payment_void')).not.toBeInTheDocument();
  });

  it('renders a semantic table with accessible caption and no invented actions', () => {
    render(
      <CashMovementsTable
        movements={[
          movement({ id: 10, type: 'payment', method: 'cash', amount: '10.00' }),
        ]}
      />,
    );

    expect(screen.getByRole('region', { name: /movimientos de caja/i })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /movimientos registrados/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /monto/i })).toHaveAttribute('data-numeric', 'true');
    expect(screen.getByRole('cell', { name: /\+ L 10\.00/i })).toHaveAttribute('data-numeric', 'true');
    expect(screen.queryByRole('button', { name: /editar|eliminar|revertir/i })).not.toBeInTheDocument();
  });

  it('uses the shared empty state instead of rendering an empty table row', () => {
    render(<CashMovementsTable movements={[]} />);

    expect(screen.getByText(/sin movimientos de caja/i)).toBeInTheDocument();
    expect(screen.getByText(/entradas, salidas y ajustes aparecer[aá]n/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows a human fallback when a movement time is unavailable', () => {
    render(
      <CashMovementsTable
        movements={[
          movement({ id: 20, type: 'payment', method: 'cash', amount: '10.00', occurred_at: 'fecha-danada' }),
        ]}
      />,
    );

    expect(screen.getByText(/hora no disponible/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/fecha-danada|invalid date/i);
  });
});

function rowFor(label: string): HTMLElement {
  return screen.getAllByText(label)[0]?.closest('tr') ?? (() => {
    throw new Error(`Missing row for ${label}`);
  })();
}

function movement(overrides: Partial<CashMovement>): CashMovement {
  return {
    id: 1,
    cash_session_id: 1,
    payment_id: null,
    user_id: 1,
    type: 'payment',
    method: null,
    amount: '0.00',
    notes: null,
    occurred_at: '2026-06-17T09:00:00-06:00',
    ...overrides,
  };
}
