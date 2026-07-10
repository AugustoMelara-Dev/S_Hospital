import type {
  InstitutionalReceipt,
  PaymentRegistrationResult,
} from '../../../lib/api/types';

export type PaymentUiOutcome =
  | { kind: 'receipt_ready'; receipt: InstitutionalReceipt }
  | { kind: 'receipt_recovery'; message: string }
  | { kind: 'partial'; message: string };

export function interpretPaymentOutcome(result: PaymentRegistrationResult): PaymentUiOutcome {
  if (result.receipt_outcome === 'issued' && result.institutional_receipt) {
    return { kind: 'receipt_ready', receipt: result.institutional_receipt };
  }

  if (result.receipt_outcome === 'not_required' && result.invoice.status !== 'paid') {
    return {
      kind: 'partial',
      message: `Pago parcial registrado. Saldo pendiente ${result.invoice.balance_due}.`,
    };
  }

  const reason = result.institutional_receipt_error?.trim()
    || 'No se recibio el comprobante institucional.';

  return {
    kind: 'receipt_recovery',
    message: `Pago registrado, pero el recibo institucional esta pendiente: ${reason} Revise la factura en Historial antes de entregar comprobante.`,
  };
}
