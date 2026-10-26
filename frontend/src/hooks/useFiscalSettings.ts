import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { FiscalSettings, PublicBranding } from '@/lib/api';
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
    onSuccess: (updated) => {
      // Publish the confirmed identity before background revalidation so every
      // shell and login subscriber updates even when the branding GET is slow.
      queryClient.setQueryData(queryKeys.settings.fiscal(), updated);
      queryClient.setQueryData<PublicBranding>(queryKeys.settings.branding(), {
        hospital_name: updated.hospital_name,
        primary_color: updated.primary_color,
        slogan: updated.slogan,
        government_line: updated.government_line,
        secretariat_line: updated.secretariat_line,
        receipt_location: updated.receipt_location,
      });
      return invalidateSettingsQueries(queryClient);
    },
  });
}
