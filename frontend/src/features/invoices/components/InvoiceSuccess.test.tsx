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
    expect(document.body.textContent).toContain('L. 0.00');
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|undefined/);
  });
});
