import { fireEvent, render, screen, within } from '@testing-library/react';
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

  it('confirms the invoice with Ctrl+Enter from the focused primary action', () => {
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

    fireEvent.keyDown(screen.getByRole('button', { name: /emitir y abrir cobro/i }), {
      key: 'Enter',
      code: 'Enter',
      ctrlKey: true,
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('keeps long patient and service names readable in narrow dialogs', () => {
    const longPatientName = 'Paciente con nombre extremadamente largo para validar que la confirmacion no se desborde en caja';
    const longService = {
      ...service,
      name: 'Consulta especializada de nefrologia con medicamento y descripcion administrativa muy extensa',
    };

    render(
      <InvoiceConfirmation
        open
        onOpenChange={vi.fn()}
        patientName={longPatientName}
        items={[{ service: longService, quantity: '12.00', dialysisPrescription: false }]}
        preview={{ subtotal: '207.00', tax: '31.05', total: '238.05' }}
        taxRate="15"
        cashSessionId={7}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText(longPatientName)).toHaveClass('min-w-0', 'break-words', 'text-right');

    const servicesList = screen.getByRole('list', { name: /servicios por confirmar/i });
    expect(within(servicesList).getByText(/consulta especializada de nefrologia/i)).toHaveClass('min-w-0', 'break-words');
    expect(within(servicesList).getByText(/L 17\.25/i)).toHaveClass('shrink-0', 'whitespace-nowrap', 'tabular-nums');
    expect(screen.getByText(/L 238\.05/i)).toHaveClass('shrink-0', 'whitespace-nowrap', 'tabular-nums');
    expect(screen.getByRole('button', { name: /emitir y abrir cobro/i })).toHaveClass('w-full', 'sm:flex-1');
  });
});
