import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { type Invoice, type InvoiceFilters, type PaginatedMeta, userSafeErrorMessage } from '../../../lib/api';
import { useInvoices } from '../../../hooks/useInvoices';
import {
  detailInvoiceIdFromSearchParams,
  filtersFromSearchParams,
  reconciliationCriterionFromFilters,
  searchParamsFromFilters,
  withPreservedDetail,
  type ReconciliationCriterion,
} from './invoiceHistoryParams';

type UseInvoiceHistoryQueryOptions = {
  /**
   * Parametro de URL del panel de detalle. El historial historico usa
   * `invoice`; la pantalla nueva de Recibos usa `operacion`.
   */
  detailParam?: string;
};

/**
 * Capa de datos del historial: filtros sincronizados con la URL, consulta
 * TanStack Query, paginacion y errores seguros. No conoce la presentacion.
 */
export function useInvoiceHistoryQuery(options: UseInvoiceHistoryQueryOptions = {}) {
  const detailParam = options.detailParam ?? 'invoice';
  const [searchParams, setSearchParams] = useSearchParams();
  const searchFilterKey = searchParams.toString();
  const [filters, setFilters] = useState<InvoiceFilters>(() => filtersFromSearchParams(searchParams));

  useEffect(() => {
    setFilters(filtersFromSearchParams(new URLSearchParams(searchFilterKey)));
  }, [searchFilterKey]);

  // TanStack Query replaces the prior manual useState + useEffect
  // loading. Cross-PC invalidation is handled by useBroadcastSync
  // through the queryClient. staleTime of 30s matches the cashier
  // expectation that the screen stays fresh for the duration of a
  // single filter/refresh action.
  const invoicesQuery = useInvoices(filters);
  const invoicesList: Invoice[] = Array.isArray(invoicesQuery.data?.data)
    ? (invoicesQuery.data!.data as Invoice[])
    : [];
  const meta: PaginatedMeta = invoicesQuery.data?.meta ?? { current_page: 1, per_page: 10, total: 0 };
  const hasCachedInvoices = invoicesQuery.data !== undefined;
  const loading = invoicesQuery.isLoading;
  const loadError = invoicesQuery.isError && !hasCachedInvoices
    ? userSafeErrorMessage(invoicesQuery.error, 'No se pudo cargar historial.')
    : '';
  const refreshError = invoicesQuery.isError && hasCachedInvoices
    ? userSafeErrorMessage(invoicesQuery.error, 'No se pudo actualizar el historial.')
    : '';

  function applyFilters(draftFilters: InvoiceFilters) {
    const nextFilters = { ...draftFilters, page: 1 };
    setFilters(nextFilters);
    setSearchParams(withPreservedDetail(searchParamsFromFilters(nextFilters), searchParams, detailParam));
    // The query refetches automatically because filters is in the
    // queryKey.
  }

  function clearFilters() {
    const clearedFilters: InvoiceFilters = {
      date_from: '',
      date_to: '',
      status: '',
      patient: '',
      invoice_number: '',
      cash_session_id: '',
      page: 1,
      per_page: 10,
    };
    setFilters(clearedFilters);
    setSearchParams(withPreservedDetail({}, searchParams, detailParam));
    // Refetch is automatic via the filters key.
  }

  async function changePage(page: number) {
    const nextFilters = { ...filters, page };
    setFilters(nextFilters);
    setSearchParams(withPreservedDetail(searchParamsFromFilters(nextFilters), searchParams, detailParam));
    // Refetch is automatic via the filters key.
  }

  const hasActiveFilters = !!(
    filters.patient ||
    filters.invoice_number ||
    filters.status ||
    filters.balance_state ||
    filters.receipt_state ||
    filters.cash_session_id ||
    filters.date_from ||
    filters.date_to
  );
  const reconciliationCriterion: ReconciliationCriterion | null = reconciliationCriterionFromFilters(filters);
  const detailInvoiceId = detailInvoiceIdFromSearchParams(searchParams, detailParam);

  return {
    filters,
    applyFilters,
    clearFilters,
    changePage,
    hasActiveFilters,
    reconciliationCriterion,
    invoicesList,
    meta,
    loading,
    loadError,
    refreshError,
    isEmpty: invoicesList.length === 0,
    refetch: invoicesQuery.refetch,
    searchParams,
    setSearchParams,
    detailInvoiceId,
  };
}
