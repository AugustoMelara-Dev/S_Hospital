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
  it('keeps the accounting warning free of implementation language', () => {
    render(
      <InvoiceConfirmation
        open
        onOpenChange={vi.fn()}
        patientName="Maria Lopez"
        items={[{ service, quantity: '1.00', dialysisPrescription: false }]}
        preview={{ subtotal: '15.00', tax: '2.25', total: '17.25' }}
        cashSessionId={7}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText(/total definitivo/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/backend|payload|api/i);
  });

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

  it('preserves long patient and service data in the real modal content', () => {
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

    expect(screen.getByText(longPatientName)).toBeInTheDocument();

    const servicesList = screen.getByRole('list', { name: /servicios por confirmar/i });
    expect(within(servicesList).getByText(/consulta especializada de nefrologia/i)).toBeInTheDocument();
    expect(within(servicesList).getByText(/L 17\.25/i)).toBeInTheDocument();
    expect(screen.getByText(/L 238\.05/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /emitir y abrir cobro/i })).toBeEnabled();
  });

  it('shows every EPO line as free when the invoice has a dialysis prescription', () => {
    const erythropoietin = {
      ...service,
      name: 'Eritropoyetina',
      price: '25.00',
      special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
    };
    render(
      <InvoiceConfirmation
        open
        onOpenChange={vi.fn()}
        patientName="Maria Lopez"
        items={[
          { service: { ...erythropoietin, id: 10 }, quantity: '1.00', dialysisPrescription: true },
          { service: { ...erythropoietin, id: 11 }, quantity: '1.00', dialysisPrescription: false },
        ]}
        preview={{ subtotal: '0.00', tax: '0.00', total: '0.00' }}
        cashSessionId={7}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getAllByText('GRATIS')).toHaveLength(2);
  });
});
