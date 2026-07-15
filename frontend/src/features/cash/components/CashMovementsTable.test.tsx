import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CashMovementsTable, type CashMovement } from './CashMovementsTable';

describe('CashMovementsTable', () => {
  it('shows payment movements as positive entries and payment voids as negative entries', () => {
    render(
      <CashMovementsTable
        movements={[
          movement({ id: 1, type: 'payment', method: 'cash', amount: '51.75' }),
          movement({ id: 2, type: 'payment_void', method: 'cash', amount: '-17.25' }),
          movement({ id: 3, type: 'closing', method: 'closing', amount: '134.50' }),
        ]}
      />,
    );

    const mobileList = screen.getByRole('list', { name: /movimientos de caja en m.vil/i });
    expect(within(mobileList).getByText('Pago').closest('li')).toHaveTextContent('+ L 51.75');
    expect(within(mobileList).getByText('Reverso de pago').closest('li')).toHaveTextContent('- L 17.25');
    expect(within(mobileList).getByText('Reverso de pago').closest('li')).not.toHaveTextContent('- -');
    expect(within(mobileList).getByText('Cierre').closest('li')).toHaveTextContent('L 134.50');
    expect(screen.queryByText('payment_void')).not.toBeInTheDocument();
  });

  it('renders the institutional operational grid and no invented actions', () => {
    render(
      <CashMovementsTable
        movements={[
          movement({ id: 10, type: 'payment', method: 'cash', amount: '10.00' }),
        ]}
      />,
    );

    expect(screen.getAllByRole('region', { name: /movimientos de caja/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('list', { name: /movimientos de caja en m.vil/i })).toHaveTextContent('+ L 10.00');
    expect(screen.queryByRole('button', { name: /editar|eliminar|revertir/i })).not.toBeInTheDocument();
  });

  it('uses the shared empty state instead of rendering an empty table row', () => {
    render(<CashMovementsTable movements={[]} />);

    expect(screen.getByText(/sin movimientos de caja/i)).toBeInTheDocument();
    expect(screen.getByText(/entradas, salidas y ajustes aparecer[aá]n/i)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /movimientos de caja en m.vil/i })).toBeEmptyDOMElement();
  });

  it('shows a human fallback when a movement time is unavailable', () => {
    render(
      <CashMovementsTable
        movements={[
          movement({ id: 20, type: 'payment', method: 'cash', amount: '10.00', occurred_at: 'fecha-danada' }),
        ]}
      />,
    );

    expect(screen.getAllByText(/hora no disponible/i).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/fecha-danada|invalid date/i);
  });

  it('links an auditable movement to its invoice and identifies its payment', () => {
    render(
      <MemoryRouter>
        <CashMovementsTable
          canViewInvoices
          movements={[
            movement({
              id: 30,
              payment_id: 81,
              invoice_id: 22,
              invoice_number: 'FAC-000022',
              type: 'payment',
              method: 'cash',
              amount: '68.40',
              notes: 'Cobro validado en ventanilla',
            }),
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('link', { name: /factura FAC-000022/i })[0])
      .toHaveAttribute('href', '/invoices?invoice=22');
    expect(screen.getAllByText(/pago #81/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/cobro validado en ventanilla/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('list', { name: /movimientos de caja en móvil/i })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /ver detalle del movimiento 30/i })[0]);
    const detail = screen.getByRole('dialog', { name: /detalle del movimiento 30/i });
    expect(within(detail).getByText(/factura FAC-000022/i)).toBeVisible();
    expect(within(detail).getByText(/pago #81/i)).toBeVisible();
    expect(within(detail).getByText(/cobro validado en ventanilla/i)).toBeVisible();
  });

  it('shows the invoice reference as text when invoices.view is missing', () => {
    render(
      <MemoryRouter>
        <CashMovementsTable
          canViewInvoices={false}
          movements={[
            movement({
              id: 31,
              payment_id: 82,
              invoice_id: 23,
              invoice_number: 'FAC-000023',
              notes: 'Reverso autorizado por supervisión',
            }),
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByText(/factura FAC-000023/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /factura FAC-000023/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/reverso autorizado por supervisión/i).length).toBeGreaterThan(0);
  });
});

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
