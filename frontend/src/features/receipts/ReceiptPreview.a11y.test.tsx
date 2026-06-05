import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { ReceiptPreview } from './ReceiptPreview';
import type { ReceiptData } from '../../lib/api';

vi.mock('react-to-print', () => ({
  useReactToPrint: () => () => undefined,
}));

function buildReceipt(): ReceiptData {
  return {
    invoice: {
      id: 1,
      invoice_number: '000-001-01-00000001',
      issued_at: '2026-06-02T08:00:00Z',
      total_in_words: 'DIECISIETE LEMPIRAS CON VEINTICINCO CENTAVOS',
      patient_name: 'Paciente Validacion',
      cashier: 'Cajero Validacion',
      status: 'paid',
      tax_label: 'ISV',
      tax_rate: '15.00',
      subtotal: '15.00',
      tax_amount: '2.25',
      discount_amount: '0.00',
      total: '17.25',
      paid_amount: '17.25',
      balance_due: '0.00',
    },
    hospital: {
      name: 'Hospital San Isidro',
      rtn: '08011999123456',
      address: 'Calle Principal, Tegucigalpa',
      slogan: 'Salud para todos',
    },
    fiscal: {
      cai: 'TEST-CAI-12345',
      authorized_range: '000-001-01-00000001 al 000-001-01-99999999',
      valid_until: '2027-12-31',
    },
    institutional: {
      template_mode: 'institutional',
      paper_size: 'half_letter' as const,
      government_line: 'Gobierno de Honduras',
      secretariat_line: 'Secretaria de Salud Publica',
      location: 'Tegucigalpa',
      footer_text: 'Gracias por su visita',
      copy_label: 'Original / Copia',
      signature_label: 'Firma autorizada',
    },
    items: [
      {
        service_name: 'Consulta general',
        category_name: 'Consultas',
        quantity: '1.00',
        unit_price: '15.00',
        tax_amount: '2.25',
        line_total: '17.25',
        notes: null,
      },
    ],
    payments: [
      {
        id: 1,
        method: 'cash',
        amount: '17.25',
        reference: null,
        paid_at: '2026-06-01T12:05:00',
        cashier: 'Cajero Validacion',
      },
    ],
    width: 'half_letter' as const,
  };
}

describe('ReceiptPreview accessibility', () => {
  it('has no axe-core violations on the half-letter render', async () => {
    const { container } = render(
      <ReceiptPreview receipt={buildReceipt()} onWidthChange={() => undefined} />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it('labels the printable receipt container for assistive technologies', () => {
    const { getByLabelText } = render(
      <ReceiptPreview receipt={buildReceipt()} onWidthChange={() => undefined} />,
    );

    expect(getByLabelText('Vista previa del recibo')).toBeInTheDocument();
  });
});
