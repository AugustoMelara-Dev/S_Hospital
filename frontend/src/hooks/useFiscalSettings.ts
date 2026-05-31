import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { FiscalSettings } from '@/lib/api';

export function useFiscalSettings() {
  return useQuery({
    queryKey: ['settings', 'fiscal'],
    queryFn: () => apiClient.getFiscalSettings(),
  });
}

export function usePublicBranding() {
  return useQuery({
    queryKey: ['settings', 'branding'],
    queryFn: () => apiClient.getPublicBranding(),
  });
}

export function useUpdateFiscalSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: FiscalSettings) => apiClient.updateFiscalSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'fiscal'] });
    },
  });
}
