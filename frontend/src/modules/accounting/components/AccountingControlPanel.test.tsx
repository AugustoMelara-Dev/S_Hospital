import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AccountingControlPanel } from './AccountingControlPanel';

describe('AccountingControlPanel', () => {
  it('shows the closing blockers and the difference without repeating the turn totals', () => {
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

    expect(screen.getByRole('heading', { name: /control del cierre/i })).toBeInTheDocument();
    expect(screen.getByText(/1 recibo institucional por emitir/i)).toBeInTheDocument();
    expect(screen.getByText('L. 42.75')).toBeInTheDocument();
    expect(screen.getByText(/3 pagos reversados por revisar/i)).toBeInTheDocument();
    expect(screen.getByText('- L. 5.00')).toHaveAccessibleDescription(/faltante/i);
    expect(screen.getByText(/cierre en preparación/i)).toBeInTheDocument();
    // Los totales del turno (cobros y saldo pendiente) viven en la banda del
    // turno, no aquí: no se repiten en dos contenedores.
    expect(screen.queryByText('L. 216.35')).not.toBeInTheDocument();
    expect(screen.queryByText('L. 35.50')).not.toBeInTheDocument();
    expect(screen.queryByText(/no registra egresos/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /registrar egreso/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /resolver en historial/i })).toHaveAttribute('href', '/invoices');
    expect(screen.getByRole('link', { name: /resolver en historial/i })).toHaveAttribute('data-ui-press');
  });

  it('distingue «sin pendientes documentales» de «arqueo completo» (V16)', () => {
    const { unmount } = render(
      <MemoryRouter>
        <AccountingControlPanel reconciliation={{}} />
      </MemoryRouter>,
    );

    // Sin conteo físico registrado NO se declara el arqueo terminado.
    expect(screen.getByText(/sin pendientes documentales/i)).toBeInTheDocument();
    expect(screen.getByText(/falta ingresar el conteo físico/i)).toBeInTheDocument();
    expect(screen.queryByText(/conteo y conciliación completos/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /resolver en historial/i })).not.toBeInTheDocument();

    unmount();

    render(
      <MemoryRouter>
        <AccountingControlPanel reconciliation={{ difference_amount: '0.00' }} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/conteo y conciliación completos/i)).toBeInTheDocument();
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

  it('omite los contadores en cero y no inventa un L. 0.00', () => {
    const { container } = render(
      <MemoryRouter>
        <AccountingControlPanel reconciliation={{}} />
      </MemoryRouter>,
    );

    // Sin recibos ni reversos pendientes no hay filas de cero.
    expect(screen.queryByText(/^recibos pendientes$/i)).toBeNull();
    expect(screen.queryByText(/^pagos reversados$/i)).toBeNull();
    expect(container.querySelector('[data-ui-money]')).toBeNull();
    expect(screen.queryByText('L. 0.00')).not.toBeInTheDocument();
    // El estado del cierre sí declara su estado con una marca no cromática.
    expect(container.querySelector('[data-ui-status]')).not.toBeNull();
    expect(screen.getByText(/ingrese el conteo físico/i)).toBeInTheDocument();
  });

  it('formats a positive difference as a admin warning without losing its sign', () => {
    render(
      <MemoryRouter>
        <AccountingControlPanel reconciliation={{ status: 'closed', difference_amount: '5.00' }} />
      </MemoryRouter>,
    );

    expect(screen.getByText('+ L. 5.00')).toHaveAccessibleDescription(/sobrante/i);
    expect(screen.getByText(/cierre confirmado/i)).toBeInTheDocument();
  });
});
