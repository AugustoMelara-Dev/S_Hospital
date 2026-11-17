/**
 * Local types for Recibos/Cobrar that are not (yet) in `@/api/types`.
 * The integrator should reconcile these with the backend schemas.
 */
import type { Invoice, InvoiceDisplayStatus, InvoiceItem, Payment, Receipt } from '@/api/types';

/** Server-computed permissions for the current user on one invoice (GET /api/invoices/{id}). */
export type InvoiceActions = {
  can_pay: boolean;
  can_void: boolean;
  can_reverse: boolean;
  can_reprint: boolean;
  can_issue_receipt: boolean;
};

/** GET /api/invoices/{id}: invoice with items, payments, receipt and `actions`. */
export type InvoiceDetail = Invoice & {
  items: InvoiceItem[];
  payments: Payment[];
  receipt: Receipt | null;
  actions?: InvoiceActions;
  cash_register_name?: string | null;
};

/** Row of GET /api/invoices (assumed to be an Invoice without nested collections). */
export type InvoiceListItem = Pick<
  Invoice,
  'id' | 'number' | 'issued_at' | 'patient_name' | 'total_cents' | 'paid_cents' | 'balance_cents' | 'status' | 'settlement'
> &
  Partial<Pick<Invoice, 'issued_by_name' | 'receipt'>>;

/**
 * UI status filter → `status` query param. `pending` maps to the API status `issued`.
 * `no_charge` ("Emitida sin cobro") is sent as `status=no_charge` (assumed; backend must accept it).
 */
export const STATUS_FILTER_TO_API: Record<InvoiceDisplayStatus, string> = {
  pending: 'issued',
  partial: 'partial',
  paid: 'paid',
  no_charge: 'no_charge',
  void: 'void',
};

/** Fallback when the backend does not send `actions` (derived from status only; server still enforces). */
export function deriveActions(inv: InvoiceDetail): InvoiceActions {
  if (inv.actions) return inv.actions;
  const posted = inv.payments.some((p) => p.status === 'posted');
  const open = inv.status === 'issued' || inv.status === 'partial';
  return {
    can_pay: open && inv.balance_cents > 0,
    can_void: inv.status === 'issued' && !posted,
    can_reverse: inv.status !== 'void' && posted,
    can_reprint: Boolean(inv.receipt && inv.receipt.status === 'issued'),
    can_issue_receipt: inv.status === 'paid' && !inv.receipt,
  };
}
