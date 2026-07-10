import { describe, expect, it } from 'vitest';
import type {
  InstitutionalReceipt,
  Invoice,
  PaymentReceiptOutcome,
  PaymentRegistrationResult,
} from '../../../lib/api/types';
import { interpretPaymentOutcome } from './paymentOutcome';

const receipt = {
  id: 31,
  receipt_number_full: 'REC-A-00000031',
} as InstitutionalReceipt;

const paidInvoice = {
  id: 8,
  status: 'paid',
  balance_due: '0.00',
} as Invoice;

const partialInvoice = {
  id: 8,
  status: 'partial',
  balance_due: '7.25',
} as Invoice;

function result(
  overrides: Partial<PaymentRegistrationResult> & { receipt_outcome: PaymentReceiptOutcome },
): PaymentRegistrationResult {
  return {
    payment: {} as PaymentRegistrationResult['payment'],
    invoice: paidInvoice,
    institutional_receipt: null,
    institutional_receipt_error: null,
    ...overrides,
  };
}

describe('interpretPaymentOutcome', () => {
  it('returns a ready receipt only for a consistent issued outcome', () => {
    expect(interpretPaymentOutcome(result({
      receipt_outcome: 'issued',
      institutional_receipt: receipt,
    }))).toEqual({ kind: 'receipt_ready', receipt });
  });

  it('returns actionable recovery copy without suggesting another payment', () => {
    expect(interpretPaymentOutcome(result({
      receipt_outcome: 'recovery_required',
      institutional_receipt_error: 'Serie no configurada.',
    }))).toEqual({
      kind: 'receipt_recovery',
      message: 'Pago registrado, pero el recibo institucional esta pendiente: Serie no configurada. Revise la factura en Historial antes de entregar comprobante.',
    });
  });

  it('returns the remaining balance for a partial payment', () => {
    expect(interpretPaymentOutcome(result({
      receipt_outcome: 'not_required',
      invoice: partialInvoice,
    }))).toEqual({
      kind: 'partial',
      message: 'Pago parcial registrado. Saldo pendiente 7.25.',
    });
  });

  it('treats an issued outcome without a receipt as recovery required', () => {
    expect(interpretPaymentOutcome(result({
      receipt_outcome: 'issued',
      institutional_receipt: null,
    }))).toEqual({
      kind: 'receipt_recovery',
      message: 'Pago registrado, pero el recibo institucional esta pendiente: No se recibio el comprobante institucional. Revise la factura en Historial antes de entregar comprobante.',
    });
  });
});
