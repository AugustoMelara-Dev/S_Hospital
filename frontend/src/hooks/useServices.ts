import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { ServiceFilters } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useServices(filters: ServiceFilters = {}, options: { enabled?: boolean } = {}) {
  const hasIntent = Boolean(
    filters.search?.trim()
    || filters.code?.trim()
    || filters.categoryId
    || filters.areaId
    || !filters.billing,
  );

  return useQuery({
    queryKey: queryKeys.services.list(filters),
    queryFn: ({ signal }) => apiClient.getServicesPage(filters, { signal }),
    placeholderData: (previousData) => previousData,
    enabled: options.enabled ?? hasIntent,
  });
}
