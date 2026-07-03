import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { FiscalSettings } from '@/lib/api';
import { invalidateSettingsQueries } from '@/lib/queryInvalidation';
import { queryKeys } from '@/lib/queryKeys';

export function useFiscalSettings() {
  return useQuery({
    queryKey: queryKeys.settings.fiscal(),
    queryFn: () => apiClient.getFiscalSettings(),
    staleTime: 60_000,
  });
}

export function useOperationalSettings() {
  return useQuery({
    queryKey: queryKeys.settings.operational(),
    queryFn: () => apiClient.getOperationalSettings(),
    staleTime: 60_000,
  });
}

export function usePublicBranding() {
  return useQuery({
    queryKey: queryKeys.settings.branding(),
    queryFn: () => apiClient.getPublicBranding(),
  });
}

export function useUpdateFiscalSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Partial<FiscalSettings>) => apiClient.updateFiscalSettings(payload),
    onSuccess: () => {
      return invalidateSettingsQueries(queryClient);
    },
  });
}
