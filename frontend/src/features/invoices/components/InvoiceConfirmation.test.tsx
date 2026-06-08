import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InvoiceConfirmation } from './InvoiceConfirmation';
import type { Service } from '../../../lib/api';

describe('InvoiceConfirmation', () => {
  it('renders malformed service and preview amounts as safe financial labels', () => {
    render(
      <InvoiceConfirmation
        open
        onOpenChange={vi.fn()}
        patientName="Paciente Prueba"
        items={[
          {
            service: serviceFixture({ price: 'NaN' }),
            quantity: '1.00',
            dialysisPrescription: false,
          },
        ]}
        preview={{ subtotal: 'monto-danado', tax: 'NaN', total: 'no-número' }}
        taxRate="15.00"
        cashSessionId={1}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText('Paciente Prueba')).toBeInTheDocument();
    expect(screen.getByText(/Hemograma/)).toBeInTheDocument();
    expect(document.body.textContent).toContain('L. 0.00');
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|no-número|undefined/);
  });
});

function serviceFixture(overrides: Partial<Service> = {}): Service {
  return {
    id: 1,
    category_id: 1,
    area_id: 1,
    name: 'Hemograma',
    aliases: null,
    slug: 'hemograma',
    scan_code: null,
    barcode: null,
    qr_code: null,
    price: '120.00',
    taxable: true,
    active: true,
    visible_in_billing: true,
    is_billable: true,
    special_rule_code: null,
    category: { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 },
    area: { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true },
    ...overrides,
  };
}
