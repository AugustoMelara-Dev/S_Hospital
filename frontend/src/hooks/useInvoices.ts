import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { InvoiceFilters, InvoicePayload } from '@/lib/api';
import { invalidateBillingQueries } from '@/lib/queryInvalidation';
import { queryKeys } from '@/lib/queryKeys';

export function useInvoices(filters: InvoiceFilters = {}) {
  return useQuery({
    queryKey: queryKeys.invoices.list(filters),
    queryFn: () => apiClient.getInvoices(filters),
    staleTime: 30_000,
  });
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

  return useMutation({
    mutationFn: (payload: InvoicePayload) => apiClient.createInvoice(payload),
    onSuccess: () => {
      return invalidateBillingQueries(queryClient);
    },
  });
}
