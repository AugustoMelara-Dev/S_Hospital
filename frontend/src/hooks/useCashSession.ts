import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export function useCashSession() {
  return useQuery({
    queryKey: ['cash-sessions', 'current'],
    queryFn: () => apiClient.getCurrentCashSession(),
  });
}

export function useOpenCashSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { opening_amount: string; notes?: string | null }) =>
      apiClient.openCashSession(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-sessions'] });
    },
  });
}

export function useCloseCashSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { closing_amount: string; notes?: string | null } }) =>
      apiClient.closeCashSession(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}