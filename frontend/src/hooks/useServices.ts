import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { ServiceFilters } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useServices(filters: ServiceFilters = {}) {
  return useQuery({
    queryKey: queryKeys.services.list(filters),
    queryFn: () => apiClient.getServicesPage(filters),
    placeholderData: (previousData) => previousData,
  });
}

export function useService(id: number) {
  return useQuery({
    queryKey: queryKeys.services.detail(id),
    queryFn: () => apiClient.getServices({}).then((services) => services.find((s) => s.id === id)),
    enabled: !!id,
  });
}
