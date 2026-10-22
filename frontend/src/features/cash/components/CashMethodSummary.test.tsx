import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CashMethodSummary } from './CashMethodSummary';

describe('CashMethodSummary', () => {
  it('shows only the methods with recorded payments, as one readable list', () => {
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

    const summary = screen.getByRole('region', { name: /cobros por método/i });
    expect(within(summary).getByText('Efectivo')).toBeVisible();
    expect(within(summary).getByText('L. 72.50')).toBeVisible();
    expect(within(summary).getByText('Transferencia')).toBeVisible();
    expect(within(summary).getByText('L. 18.25')).toBeVisible();
    expect(within(summary).getByText('Tarjeta')).toBeVisible();
    // Un método en cero no ocupa un contenedor.
    expect(within(summary).queryByText('Otros')).toBeNull();
    expect(within(summary).getByText(/4 pagos registrados/i)).toBeVisible();
    expect(within(summary).getByText(/L\. 12\.00 por cobrar/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /registrar egreso/i })).not.toBeInTheDocument();
  });

  it('declares a turn without payments in one discreet line instead of four zeros', () => {
    render(
      <CashMethodSummary
        paymentsByMethod={{ cash: '0.00', transfer: '0.00', card: '0.00', other: '0.00' }}
      />,
    );

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/sin cobros registrados en este turno/i);
    expect(screen.queryByText('L 0.00')).not.toBeInTheDocument();
    // El estado vacío conserva la superficie del módulo: la pestaña Resumen
    // no pinta texto suelto sobre el fondo ni dibuja una tarjeta vacía.
    const summary = screen.getByRole('region', { name: /cobros por método/i });
    expect(summary).toContainElement(status);
  });

  it('does not invent per-method counted values when the API does not provide them', () => {
    render(
      <CashMethodSummary
        paymentsByMethod={{ cash: '10.00', transfer: '0.00', card: '0.00', other: '0.00' }}
      />,
    );

    // El resumen solo muestra los montos cobrados por método; nunca un "contado"
    // por método que el servidor no entrega (el cierre compara solo el efectivo
    // físico con el efectivo esperado, y eso vive en el arqueo).
    expect(screen.queryByText(/contado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/contado por transferencia/i)).not.toBeInTheDocument();
    expect(screen.getByText('L. 10.00')).toBeVisible();
    expect(screen.queryByText('L 0.00')).not.toBeInTheDocument();
    // La distinción entre efectivo físico y otros medios queda declarada.
    expect(screen.getByText(/solo el efectivo entra a la gaveta/i)).toBeVisible();
  });
});
