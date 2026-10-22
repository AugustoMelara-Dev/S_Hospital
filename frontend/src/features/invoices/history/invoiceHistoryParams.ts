import type { InvoiceFilters } from '../../../lib/api';

export type ReconciliationCriterion = {
  kind: 'pending_balance' | 'missing_receipt';
  cashSessionId: string;
};

export function positiveIntegerFromSearchParam(value: string | null, fallback: number): number {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function filtersFromSearchParams(searchParams: URLSearchParams): InvoiceFilters {
  const reconciliationCashSessionId = positiveIntegerFromSearchParam(
    searchParams.get('reconciliation_cash_session_id'),
    0,
  );
  const hasPendingBalanceCriterion = reconciliationCashSessionId > 0
    && searchParams.get('balance_state') === 'pending';
  const hasMissingReceiptCriterion = !hasPendingBalanceCriterion
    && reconciliationCashSessionId > 0
    && searchParams.get('receipt_state') === 'missing';
  const hasReconciliationCriterion = hasPendingBalanceCriterion || hasMissingReceiptCriterion;

  return {
    date_from: searchParams.get('date_from') ?? '',
    date_to: searchParams.get('date_to') ?? '',
    status: (searchParams.get('status') ?? '') as InvoiceFilters['status'],
    balance_state: hasPendingBalanceCriterion ? 'pending' : '',
    receipt_state: hasMissingReceiptCriterion ? 'missing' : '',
    reconciliation_cash_session_id: hasReconciliationCriterion
      ? String(reconciliationCashSessionId)
      : undefined,
    patient: searchParams.get('q') ?? searchParams.get('patient') ?? '',
    invoice_number: searchParams.get('invoice_number') ?? '',
    cash_session_id: searchParams.get('cash_session_id') ?? '',
    page: positiveIntegerFromSearchParam(searchParams.get('page'), 1),
    per_page: positiveIntegerFromSearchParam(searchParams.get('per_page'), 10),
  };
}

export function searchParamsFromFilters(filters: InvoiceFilters): Record<string, string> {
  const params: Record<string, string> = {};

  if (filters.date_from) {
    params.date_from = filters.date_from;
  }
  if (filters.date_to) {
    params.date_to = filters.date_to;
  }
  if (filters.status) params.status = filters.status;
  if (filters.reconciliation_cash_session_id && filters.balance_state === 'pending') {
    params.balance_state = filters.balance_state;
    params.reconciliation_cash_session_id = filters.reconciliation_cash_session_id;
  } else if (filters.reconciliation_cash_session_id && filters.receipt_state === 'missing') {
    params.receipt_state = filters.receipt_state;
    params.reconciliation_cash_session_id = filters.reconciliation_cash_session_id;
  }
  if (filters.patient) params.q = filters.patient;
  if (filters.invoice_number) params.invoice_number = filters.invoice_number;
  if (filters.cash_session_id?.trim()) params.cash_session_id = filters.cash_session_id.trim();
  if (filters.page && filters.page > 1) params.page = String(filters.page);
  if (filters.per_page && filters.per_page !== 10) params.per_page = String(filters.per_page);

  return params;
}

export function reconciliationCriterionFromFilters(filters: InvoiceFilters): ReconciliationCriterion | null {
  const cashSessionId = filters.reconciliation_cash_session_id?.trim();

  if (!cashSessionId) return null;
  if (filters.balance_state === 'pending') return { kind: 'pending_balance', cashSessionId };
  if (filters.receipt_state === 'missing') return { kind: 'missing_receipt', cashSessionId };

  return null;
}

/**
 * Conserva el identificador del detalle abierto al cambiar de filtros/pagina.
 * `detailParam` permite que la pantalla nueva use `?operacion=` sin duplicar
 * la logica de la URL (el historial historico mantiene `?invoice=`).
 */
export function withPreservedDetail(
  filters: Record<string, string>,
  currentSearchParams: URLSearchParams,
  detailParam = 'invoice',
): Record<string, string> {
  const detail = currentSearchParams.get(detailParam);
  return detail ? { ...filters, [detailParam]: detail } : filters;
}

export function detailInvoiceIdFromSearchParams(
  searchParams: URLSearchParams,
  detailParam = 'invoice',
): number {
  return positiveIntegerFromSearchParam(searchParams.get(detailParam), 0);
}

export function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
