import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InvoiceConfirmation } from './InvoiceConfirmation';

const service = {
  id: 1,
  category_id: 1,
  area_id: 1,
  name: 'Glucosa',
  slug: 'glucosa',
  price: '17.25',
  scan_code: null,
  barcode: null,
  qr_code: null,
  taxable: true,
  active: true,
  visible_in_billing: true,
  is_billable: true,
  special_rule_code: null,
  category: { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 },
};

describe('InvoiceConfirmation', () => {
  it('does not manually confirm from Enter keydown before the native button click', () => {
    const onConfirm = vi.fn();

    render(
      <InvoiceConfirmation
        open
        onOpenChange={vi.fn()}
        patientName="Maria Lopez"
        items={[{ service, quantity: '1.00', dialysisPrescription: false }]}
        preview={{ subtotal: '15.00', tax: '2.25', total: '17.25' }}
        cashSessionId={7}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.keyDown(screen.getByRole('button', { name: /emitir y abrir cobro/i }), { key: 'Enter' });

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
