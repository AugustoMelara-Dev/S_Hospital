/** Test fixtures shared by the Cobrar and Recibos tests (not imported by app code). */
import {
  ERYTHROPOIETIN_RULE,
  type Invoice,
  type InvoicePreview,
  type InvoicePreviewRequest,
  type Payment,
  type ReceiptSummary,
  type Service,
} from '@/api/types';
import { makeMe } from '@/test/mockApi';

export const cajero = makeMe({
  name: 'Luis Cajero',
  role: { code: 'cajero', name: 'Caja' },
  permissions: [
    'catalog.view',
    'invoices.view',
    'invoices.create',
    'cash.view',
    'cash.open',
    'cash.close',
    'payments.create',
    'payments.view',
    'receipts.view',
    'receipts.reprint',
    'reports.own',
    'patients.mark_dialysis_prescription',
  ],
});

export const openSession = {
  id: 3,
  cash_register: { id: 1, code: 'principal', name: 'Caja principal' },
  user: { id: 1, name: 'Luis Cajero' },
  status: 'open',
  opened_at: '2026-11-17T07:02:00-06:00',
  opening_cents: 0,
};

export function makeService(id: number, name: string, price_cents: number, extra: Partial<Service> = {}): Service {
  return {
    id,
    name,
    category: { id: 1, name: 'Laboratorio' },
    area: null,
    price_cents,
    tax_rate: null,
    active: true,
    visible_in_billing: true,
    is_billable: true,
    special_rule_code: null,
    aliases: '',
    description: '',
    updated_at: '2026-11-17T07:00:00-06:00',
    ...extra,
  };
}

export const hemograma = makeService(10, 'Hemograma completo', 15000);
export const hemoglobina = makeService(11, 'Hemoglobina glicosilada', 32050);
export const epo = makeService(20, 'Eritropoyetina 4000 UI', 25000, {
  category: { id: 2, name: 'Farmacia' },
  special_rule_code: ERYTHROPOIETIN_RULE,
});
export const services = [hemograma, hemoglobina, epo];

/** Simplified server preview (all exempt) — enough to drive the UI. */
export function previewFor(body: InvoicePreviewRequest): InvoicePreview {
  const items = body.items.map((it, i) => {
    const s = services.find((x) => x.id === it.service_id) ?? hemograma;
    const eligible = s.special_rule_code === ERYTHROPOIETIN_RULE;
    const free = body.dialysis_prescription && eligible;
    const registered = Math.round((s.price_cents * it.quantity_hundredths) / 100);
    const sub = free ? 0 : registered;
    return {
      position: i + 1,
      service_id: s.id,
      service_name: s.name,
      category_name: s.category.name,
      quantity_hundredths: it.quantity_hundredths,
      unit_price_registered_cents: s.price_cents,
      unit_price_cents: free ? 0 : s.price_cents,
      rule_adjustment_cents: registered - sub,
      rate_bp: 0,
      line_subtotal_cents: sub,
      tax_cents: 0,
      line_total_cents: sub,
      special_rule_applied: free,
      rule_eligible: eligible,
    };
  });
  const total = items.reduce((a, b) => a + b.line_total_cents, 0);
  return {
    items,
    subtotal_cents: total,
    exempt_cents: total,
    taxable_cents: 0,
    tax_cents: 0,
    total_cents: total,
    rule_adjustment_cents: items.reduce((a, b) => a + b.rule_adjustment_cents, 0),
    tax_breakdown: [{ rate_bp: 0, base_cents: total, tax_cents: 0, label: 'Exento' }],
    dialysis_prescription: body.dialysis_prescription,
    has_rule_eligible_items: items.some((x) => x.rule_eligible),
  };
}

export function makeReceipt(overrides: Partial<ReceiptSummary> = {}): ReceiptSummary {
  return {
    id: 70,
    number_full: 'REC-A-00000012',
    status: 'issued',
    reprint_count: 0,
    ...overrides,
  };
}

const cashier = { id: 1, name: 'Luis Cajero' };

export function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 5,
    number: '000-001-01-00000012',
    patient_name: 'María López',
    status: 'issued',
    settlement: 'pending',
    total_cents: 15000,
    paid_cents: 0,
    balance_cents: 15000,
    dialysis_prescription: false,
    reversed: false,
    issued_at: '2026-11-17T09:10:00-06:00',
    issued_by: cashier,
    cash_session_id: 3,
    subtotal_cents: 15000,
    exempt_cents: 15000,
    taxable_cents: 0,
    tax_cents: 0,
    rule_adjustment_cents: 0,
    tax_breakdown: [{ rate_bp: 0, base_cents: 15000, tax_cents: 0, label: 'Exento' }],
    fiscal: {
      cai: 'ABC123-DEF456',
      range_from: '000-001-01-00000001',
      range_to: '000-001-01-00005000',
      valid_until: '2026-12-31',
    },
    voided_at: null,
    voided_by: null,
    void_reason: null,
    items: [],
    payments: [],
    receipt: null,
    receipt_error: null,
    actions: { can_pay: true, can_void: true, can_reverse: false, can_reprint: false, can_issue_receipt: false },
    ...overrides,
  };
}

export function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 90,
    invoice_id: 5,
    cash_session_id: 3,
    user: cashier,
    method: 'cash',
    amount_cents: 15000,
    received_cents: 20000,
    change_cents: 5000,
    reference: '',
    status: 'posted',
    paid_at: '2026-11-17T09:15:00-06:00',
    void_reason: null,
    voided_at: null,
    ...overrides,
  };
}

/** GET /invoices/{id} with one line. */
export function makeDetail(overrides: Partial<Invoice> = {}): Invoice {
  return makeInvoice({
    items: [
      {
        id: 1,
        position: 1,
        service_id: 10,
        service_name: 'Hemograma completo',
        category_name: 'Laboratorio',
        area_name: '',
        quantity_hundredths: 100,
        unit_price_registered_cents: 15000,
        unit_price_cents: 15000,
        rule_adjustment_cents: 0,
        rate_bp: 0,
        line_subtotal_cents: 15000,
        tax_cents: 0,
        line_total_cents: 15000,
        special_rule_applied: false,
      },
    ],
    ...overrides,
  });
}
