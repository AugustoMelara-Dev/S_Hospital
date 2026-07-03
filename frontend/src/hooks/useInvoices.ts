import { useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { createClientIdempotencyKey } from '@/lib/api/base';
import type { InvoiceFilters, InvoicePayload } from '@/lib/api';
import { invalidateBillingQueries } from '@/lib/queryInvalidation';
import { queryKeys } from '@/lib/queryKeys';

export function useInvoices(filters: InvoiceFilters = {}) {
  const normalizedFilters = normalizeInvoiceFilters(filters);

  return useQuery({
    queryKey: queryKeys.invoices.list(normalizedFilters),
    queryFn: () => apiClient.getInvoices(normalizedFilters),
    staleTime: 30_000,
  });
}

function normalizeInvoiceFilters(filters: InvoiceFilters): InvoiceFilters {
  const normalized: InvoiceFilters = {
    date_from: normalizeTextFilter(filters.date_from),
    date_to: normalizeTextFilter(filters.date_to),
    status: normalizeTextFilter(filters.status) as InvoiceFilters['status'],
    patient: normalizeTextFilter(filters.patient),
    invoice_number: normalizeTextFilter(filters.invoice_number),
    user_id: normalizeTextFilter(filters.user_id),
    cash_session_id: normalizeTextFilter(filters.cash_session_id),
    page: filters.page,
    per_page: filters.per_page,
  };

  return Object.fromEntries(
    Object.entries(normalized).filter(([, value]) => value !== undefined && value !== ''),
  ) as InvoiceFilters;
}

function normalizeTextFilter(value: string | undefined): string | undefined {
  return value?.trim();
}

export function useInvoice(id: number) {
  return useQuery({
    queryKey: queryKeys.invoices.detail(id),
    queryFn: () => apiClient.getInvoice(id),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const idempotencyKeyRef = useRef<string | null>(null);

  return useMutation({
    mutationFn: (payload: InvoicePayload) => {
      idempotencyKeyRef.current ??= createClientIdempotencyKey();

      return apiClient.createInvoice(payload, {
        idempotencyKey: idempotencyKeyRef.current,
      });
    },
    onSuccess: () => {
      idempotencyKeyRef.current = null;
      return invalidateBillingQueries(queryClient);
    },
  });
}
