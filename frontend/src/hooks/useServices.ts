import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { ServiceFilters } from '@/lib/api';

export function useServices(filters: ServiceFilters = {}) {
  return useQuery({
    queryKey: ['services', filters],
    queryFn: () => apiClient.getServicesPage(filters),
  });
}

export function useService(id: number) {
  return useQuery({
    queryKey: ['services', id],
    queryFn: () => apiClient.getServices({}).then((services) => services.find((s) => s.id === id)),
    enabled: !!id,
  });
}