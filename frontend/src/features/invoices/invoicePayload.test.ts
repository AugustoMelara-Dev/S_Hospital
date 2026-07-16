import { describe, expect, it } from 'vitest';
import type { CartItem } from './components/InvoiceCart';
import type { Service } from '@/lib/api';
import { buildInvoicePayload } from './invoicePayload';

function service(id: number): Service {
  return {
    id,
    category_id: 1,
    area_id: 1,
    name: `Servicio ${id}`,
    aliases: null,
    slug: `servicio-${id}`,
    scan_code: null,
    barcode: null,
    qr_code: null,
    price: '25.00',
    taxable: true,
    active: true,
    visible_in_billing: true,
    is_billable: true,
    special_rule_code: id === 10 ? 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION' : null,
    category: { id: 1, name: 'Medicamentos', slug: 'medicamentos', active: true, sort_order: 1 },
    area: { id: 1, name: 'Farmacia', slug: 'farmacia', active: true },
  } as Service;
}

describe('buildInvoicePayload', () => {
  it('trims the patient name and sends dialysis prescription only at invoice level', () => {
    const cartItems: CartItem[] = [
      { service: service(10), quantity: '1.00', dialysisPrescription: true },
      { service: service(11), quantity: '2.00', dialysisPrescription: false },
    ];

    expect(buildInvoicePayload({
      canMarkDialysisPrescription: true,
      cartItems,
      patientName: '  Maria Lopez  ',
    })).toEqual({
      patient_name: 'Maria Lopez',
      dialysis_prescription: true,
      items: [
        { service_id: 10, quantity: '1.00' },
        { service_id: 11, quantity: '2.00' },
      ],
    });
  });

  it('does not request dialysis prescription when the user lacks permission', () => {
    const cartItems: CartItem[] = [
      { service: service(10), quantity: '1.00', dialysisPrescription: true },
    ];

    expect(buildInvoicePayload({
      canMarkDialysisPrescription: false,
      cartItems,
      patientName: 'Maria Lopez',
    })).toMatchObject({
      dialysis_prescription: false,
    });
  });

  it('ignores stale dialysis flags attached to non-EPO services', () => {
    const cartItems: CartItem[] = [
      { service: service(10), quantity: '1.00', dialysisPrescription: false },
      { service: service(11), quantity: '1.00', dialysisPrescription: true },
    ];

    expect(buildInvoicePayload({
      canMarkDialysisPrescription: true,
      cartItems,
      patientName: 'Maria Lopez',
    })).toMatchObject({
      dialysis_prescription: false,
    });
  });
});
