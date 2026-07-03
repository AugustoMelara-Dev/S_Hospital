import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { InvoiceSuccess } from './InvoiceSuccess';

describe('InvoiceSuccess', () => {
  it('renders malformed totals as safe financial labels', () => {
    render(
      <MemoryRouter>
        <InvoiceSuccess
          open
          onOpenChange={vi.fn()}
          invoiceNumber="000-001-01-00000001"
          patientName="Paciente Prueba"
          total="monto-danado"
          status="issued"
          onCobrar={vi.fn()}
          onImprimir={vi.fn()}
          onNuevaFactura={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('000-001-01-00000001')).toBeInTheDocument();
    expect(document.body.textContent).toContain('L 0.00');
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|undefined/);
  });

  it('keeps paid success actions to print, new invoice and detail only', () => {
    render(
      <MemoryRouter>
        <InvoiceSuccess
          open
          onOpenChange={vi.fn()}
          invoiceNumber="000-001-01-00000009"
          patientName="Paciente Prueba"
          total="125.00"
          status="paid"
          onCobrar={vi.fn()}
          onImprimir={vi.fn()}
          onNuevaFactura={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('button', { name: /imprimir/i })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /crear otra factura/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ver recibo/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver detalle/i })).toHaveAttribute(
      'href',
      '/invoices?invoice_number=000-001-01-00000009',
    );
  });

  it('uses a paid success title when the invoice is already collected', () => {
    render(
      <MemoryRouter>
        <InvoiceSuccess
          open
          onOpenChange={vi.fn()}
          invoiceNumber="000-001-01-00000010"
          patientName="Paciente Pagado"
          total="125.00"
          status="paid"
          onCobrar={vi.fn()}
          onImprimir={vi.fn()}
          onNuevaFactura={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('dialog', { name: /factura pagada/i })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /factura emitida exitosamente/i })).not.toBeInTheDocument();
    expect(screen.getByText(/recibo listo para imprimir/i)).toBeInTheDocument();
  });
});
