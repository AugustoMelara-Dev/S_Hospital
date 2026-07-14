import { parseCents } from '../../../lib/money';

export type ReconciliationInput = {
  payments_total?: string;
  pending_invoice_count?: number;
  pending_amount?: string;
  missing_institutional_receipt_count?: number;
  reversed_payments_count?: number;
  reversed_payments_total?: string;
  status?: 'open' | 'closed';
  difference_amount?: string | number | null;
};

export type ReconciliationBlocker =
  | { kind: 'pending_invoices'; count: number; amount: string }
  | { kind: 'missing_receipts'; count: number };

export type ReconciliationStatus = {
  state: 'ready' | 'blocked';
  blockers: ReconciliationBlocker[];
  reversedPayments: { count: number; total: string };
  expenses: { supported: false };
};

export function buildReconciliationStatus(input: ReconciliationInput): ReconciliationStatus {
  const pendingCount = safeCount(input.pending_invoice_count);
  const pendingAmount = input.pending_amount ?? '0.00';
  const missingReceiptCount = safeCount(input.missing_institutional_receipt_count);
  const blockers: ReconciliationBlocker[] = [];

  if (pendingCount > 0 || parseCents(pendingAmount) > 0) {
    blockers.push({ kind: 'pending_invoices', count: pendingCount, amount: pendingAmount });
  }

  if (missingReceiptCount > 0) {
    blockers.push({ kind: 'missing_receipts', count: missingReceiptCount });
  }

  return {
    state: blockers.length === 0 ? 'ready' : 'blocked',
    blockers,
    reversedPayments: {
      count: safeCount(input.reversed_payments_count),
      total: input.reversed_payments_total ?? '0.00',
    },
    expenses: { supported: false },
  };
}

function safeCount(value: number | undefined): number {
  return Number.isInteger(value) && (value ?? 0) > 0 ? value ?? 0 : 0;
}
