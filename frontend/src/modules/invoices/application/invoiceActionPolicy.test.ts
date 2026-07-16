import { describe, expect, it } from 'vitest';
import type { Invoice } from '../../../lib/api/types';
import { invoiceActionPolicy } from './invoiceActionPolicy';

const permissions = {
  canIssueInstitutionalReceipt: true,
  canCollectPayment: true,
  canOperateAnyInvoice: false,
  canReprint: true,
  canReprintAny: false,
  canReverse: true,
  canViewReceipt: true,
  canVoid: true,
  isOwnInvoiceFromToday: true,
};

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1,
    status: 'paid',
    institutional_receipt: null,
    ...overrides,
  } as Invoice;
}

describe('invoiceActionPolicy', () => {
  it('offers receipt recovery instead of a non-institutional receipt action', () => {
    expect(invoiceActionPolicy(invoice(), permissions)).toMatchObject({
      generateInstitutionalReceipt: true,
      collectPayment: false,
      openReceipt: false,
      reprint: false,
      reverse: true,
      void: false,
    });
  });

  it('allows first open and download for an issued unprinted receipt', () => {
    expect(invoiceActionPolicy(invoice({
      institutional_receipt: {
        id: 4,
        status: 'issued',
        receipt_number_full: 'REC-4',
        issued_at: '2026-07-09T10:00:00-06:00',
        reprint_count: 0,
        has_print_events: false,
      },
    }), permissions)).toMatchObject({
      openReceipt: true,
      auditedOpen: false,
      downloadInstitutionalReceipt: true,
      reprint: true,
    });
  });

  it('keeps pure view and save available after printing while guarding reprint separately', () => {
    const printed = invoice({
      institutional_receipt: {
        id: 5,
        status: 'issued',
        receipt_number_full: 'REC-5',
        issued_at: '2026-07-09T10:00:00-06:00',
        reprint_count: 1,
        has_print_events: true,
      },
    });

    expect(invoiceActionPolicy(printed, { ...permissions, canReprint: false })).toMatchObject({
      openReceipt: true,
      auditedOpen: false,
      downloadInstitutionalReceipt: true,
      reprint: false,
    });
  });

  it('returns no mutating or receipt actions for a void invoice', () => {
    expect(invoiceActionPolicy(invoice({ status: 'void' }), permissions)).toEqual({
      openReceipt: false,
      auditedOpen: false,
      collectPayment: false,
      downloadInstitutionalReceipt: false,
      generateInstitutionalReceipt: false,
      reprint: false,
      reverse: false,
      void: false,
    });
  });

  it('hides actions outside the ownership scope', () => {
    expect(invoiceActionPolicy(invoice(), {
      ...permissions,
      canOperateAnyInvoice: false,
      canReprintAny: false,
      isOwnInvoiceFromToday: false,
    })).toEqual({
      openReceipt: false,
      auditedOpen: false,
      collectPayment: false,
      downloadInstitutionalReceipt: false,
      generateInstitutionalReceipt: false,
      reprint: false,
      reverse: false,
      void: false,
    });
  });

  it('offers collection only for payable invoices in the authorized scope', () => {
    expect(invoiceActionPolicy(invoice({ status: 'issued' }), permissions).collectPayment).toBe(true);
    expect(invoiceActionPolicy(invoice({ status: 'partial' }), permissions).collectPayment).toBe(true);
    expect(invoiceActionPolicy(invoice({ status: 'paid' }), permissions).collectPayment).toBe(false);
    expect(invoiceActionPolicy(invoice({ status: 'issued' }), { ...permissions, canCollectPayment: false }).collectPayment).toBe(false);
  });
});
