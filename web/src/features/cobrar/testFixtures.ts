/** Test fixtures shared by the Cobrar and Recibos tests (not imported by app code). */
import {
  ERYTHROPOIETIN_RULE,
  type Invoice,
  type InvoicePreview,
  type InvoicePreviewRequest,
  type Payment,
  type Receipt,
  type Service,
} from '@/api/types';
import { makeMe } from '@/test/mockApi';
import type { InvoiceDetail } from '@/features/recibos/types';

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
  cash_register_id: 1,
  user_id: 1,
  status: 'open',
  opened_at: '2026-11-17T07:02:00-06:00',
  opening_cents: 0,
};

export function makeService(id: number, name: string, price_cents: number, extra: Partial<Service> = {}): Service {
  return {
    id,
    category_id: 1,
    category: { id: 1, name: 'Laboratorio', active: true },
    area_id: null,
    area: null,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    source_key: null,
    aliases: null,
    description: null,
    price_cents,
    tax_rate_id: null,
    tax_rate: null,
    active: true,
    visible_in_billing: true,
    is_billable: true,
    special_rule_code: null,
    ...extra,
  };
}

export const hemograma = makeService(10, 'Hemograma completo', 15000);
export const hemoglobina = makeService(11, 'Hemoglobina glicosilada', 32050);
export const epo = makeService(20, 'Eritropoyetina 4000 UI', 25000, {
  category: { id: 2, name: 'Farmacia', active: true },
  category_id: 2,
  special_rule_code: ERYTHROPOIETIN_RULE,
});
export const services = [hemograma, hemoglobina, epo];

/** Simplified server preview (all exempt) — enough to drive the UI. */
export function previewFor(body: InvoicePreviewRequest): InvoicePreview {
  const items = body.items.map((it, i) => {
    const s = services.find((x) => x.id === it.service_id) ?? hemograma;
    const free = body.dialysis_prescription && s.special_rule_code === ERYTHROPOIETIN_RULE;
    const registered = Math.round((s.price_cents * it.quantity_hundredths) / 100);
    const sub = free ? 0 : registered;
    return {
      service_id: s.id,
      service_name: s.name,
      category_name: s.category?.name ?? '',
      area_name: null,
      quantity_hundredths: it.quantity_hundredths,
      unit_price_registered_cents: s.price_cents,
      unit_price_cents: free ? 0 : s.price_cents,
      rule_adjustment_cents: registered - sub,
      rate_bp: 0,
      line_subtotal_cents: sub,
      tax_cents: 0,
      line_total_cents: sub,
      special_rule_applied: free,
      position: i,
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
    tax_breakdown: [{ rate_bp: 0, base_cents: total, label: 'Exento' }],
    settlement: total === 0 ? 'free_by_rule' : 'pending',
  };
}

export function makeReceipt(overrides: Partial<Receipt> = {}): Receipt {
  return {
    id: 70,
    invoice_id: 5,
    series_id: 1,
    number: 12,
    number_full: 'REC-A-00000012',
    status: 'issued',
    amount_cents: 15000,
    amount_words: 'CIENTO CINCUENTA LEMPIRAS CON 00/100',
    payer_name: 'María López',
    cash_session_id: 3,
    issued_by: 1,
    issued_at: '2026-11-17T09:15:00-06:00',
    reprint_count: 0,
    voided_at: null,
    void_reason: null,
    ...overrides,
  };
}

export function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 5,
    number: '000-001-01-00000012',
    fiscal_sequence_id: 1,
    fiscal_cai: 'ABC123-DEF456',
    fiscal_range_from: '000-001-01-00000001',
    fiscal_range_to: '000-001-01-00005000',
    fiscal_valid_until: '2026-12-31',
    hospital_name: 'Hospital de Prueba',
    hospital_rtn: null,
    hospital_address: null,
    hospital_phone: null,
    government_line: null,
    secretariat_line: null,
    receipt_location: null,
    receipt_footer_text: null,
    patient_name: 'María López',
    subtotal_cents: 15000,
    exempt_cents: 15000,
    taxable_cents: 0,
    tax_cents: 0,
    total_cents: 15000,
    paid_cents: 0,
    balance_cents: 15000,
    tax_breakdown: [{ rate_bp: 0, base_cents: 15000, label: 'Exento' }],
    status: 'issued',
    settlement: 'pending',
    dialysis_prescription: false,
    cash_session_id: 3,
    issued_by: 1,
    issued_at: '2026-11-17T09:10:00-06:00',
    voided_by: null,
    voided_at: null,
    void_reason: null,
    reversed: false,
    receipt: null,
    ...overrides,
  };
}

export function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 90,
    invoice_id: 5,
    cash_session_id: 3,
    user_id: 1,
    method: 'cash',
    amount_cents: 15000,
    received_cents: 20000,
    change_cents: 5000,
    reference: null,
    status: 'posted',
    void_reason: null,
    voided_by: null,
    voided_at: null,
    paid_at: '2026-11-17T09:15:00-06:00',
    ...overrides,
  };
}

export function makeDetail(overrides: Partial<InvoiceDetail> = {}): InvoiceDetail {
  return {
    ...makeInvoice(),
    items: [
      {
        id: 1,
        invoice_id: 5,
        service_id: 10,
        service_name: 'Hemograma completo',
        category_name: 'Laboratorio',
        area_name: null,
        quantity_hundredths: 100,
        unit_price_registered_cents: 15000,
        unit_price_cents: 15000,
        rule_adjustment_cents: 0,
        rate_bp: 0,
        line_subtotal_cents: 15000,
        tax_cents: 0,
        line_total_cents: 15000,
        special_rule_applied: false,
        position: 0,
      },
    ],
    payments: [],
    receipt: null,
    actions: { can_pay: true, can_void: true, can_reverse: false, can_reprint: false, can_issue_receipt: false },
    ...overrides,
  };
}
