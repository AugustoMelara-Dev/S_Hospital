import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { invalidateBillingQueries } from '@/lib/queryInvalidation';
import { queryKeys } from '@/lib/queryKeys';

export function useCashSession() {
  return useQuery({
    queryKey: queryKeys.cashSessions.current(),
    queryFn: () => apiClient.getCurrentCashSession(),
  });
}

export function useOpenCashSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { opening_amount: string; notes?: string | null }) =>
      apiClient.openCashSession(payload),
    onSuccess: () => {
      return invalidateBillingQueries(queryClient);
    },
  });
}

export function useCloseCashSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { closing_amount: string; notes?: string | null } }) =>
      apiClient.closeCashSession(id, payload),
    onSuccess: () => {
      return invalidateBillingQueries(queryClient);
    },
  });
}
