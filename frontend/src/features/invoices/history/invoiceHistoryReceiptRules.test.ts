import { describe, expect, it } from 'vitest';
import type { Invoice, ReceiptData } from '../../../lib/api';
import {
  isAuditedReprintReceipt,
  issuedInstitutionalReceipt,
  requiresLegacyReprintReason,
} from './invoiceHistoryReceiptRules';

function receipt(overrides: Partial<ReceiptData> = {}): ReceiptData {
  return {
    width: 'half_letter',
    legacy_reprint_count: 0,
    hospital: { name: 'Hospital San Isidro', rtn: null },
    institutional: {
      template_mode: 'institutional',
      paper_size: 'half_letter',
      government_line: null,
      secretariat_line: null,
      location: null,
      footer_text: null,
      copy_label: 'Original',
      signature_label: null,
    },
    fiscal: { cai: null, authorized_range: null, valid_until: null },
    invoice: {
      invoice_number: '000-001-01-00000001',
      patient_name: 'Paciente',
      subtotal: '15.00',
      tax_amount: '2.25',
      discount_amount: '0.00',
      total: '17.25',
      paid_amount: '0.00',
      balance_due: '17.25',
      status: 'issued',
      issued_at: '2026-06-01T12:00:00.000000Z',
      cashier: null,
    },
    items: [],
    payments: [],
    ...overrides,
  };
}

describe('invoiceHistoryReceiptRules (T3-004)', () => {
  it('treats counter 0 with the original label as a first print (no reason, no POST)', () => {
    expect(requiresLegacyReprintReason(receipt())).toBe(false);
  });

  it('requires a human reason when the durable counter is greater than 0', () => {
    expect(requiresLegacyReprintReason(receipt({ legacy_reprint_count: 1 }))).toBe(true);
    expect(requiresLegacyReprintReason(receipt({ legacy_reprint_count: 7 }))).toBe(true);
  });

  it('does not ask again for an already audited reprint document', () => {
    const audited = receipt({
      legacy_reprint_count: 2,
      institutional: { ...receipt().institutional!, copy_label: 'REIMPRESIÓN #2' },
    });

    expect(isAuditedReprintReceipt(audited)).toBe(true);
    expect(requiresLegacyReprintReason(audited)).toBe(false);
  });

  it('never fabricates a reprint when the payload has no counter (legacy response)', () => {
    const payloadWithoutCounter = { ...receipt(), legacy_reprint_count: undefined } as unknown as ReceiptData;

    expect(requiresLegacyReprintReason(payloadWithoutCounter)).toBe(false);
  });

  it('returns false without a receipt', () => {
    expect(requiresLegacyReprintReason(null)).toBe(false);
    expect(isAuditedReprintReceipt(null)).toBe(false);
  });
});

describe('issuedInstitutionalReceipt (helper reubicado al retirar el legacy)', () => {
  const issuedReceipt = {
    id: 90,
    receipt_number_full: 'REC-A-00000090',
    status: 'issued',
  } as NonNullable<Invoice['institutional_receipt']>;

  function invoiceWithReceipt(
    institutionalReceipt: Invoice['institutional_receipt'],
  ): Invoice {
    return { institutional_receipt: institutionalReceipt } as Invoice;
  }

  it('returns the receipt only when its status is issued', () => {
    expect(issuedInstitutionalReceipt(invoiceWithReceipt(issuedReceipt))).toBe(issuedReceipt);
  });

  it('returns null when the receipt was voided or is absent', () => {
    expect(
      issuedInstitutionalReceipt(
        invoiceWithReceipt({ ...issuedReceipt, status: 'void' }),
      ),
    ).toBeNull();
    expect(issuedInstitutionalReceipt(invoiceWithReceipt(undefined))).toBeNull();
  });
});
