import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useDashboardReport(enabled = true) {
  return useQuery({
    queryKey: queryKeys.reports.dashboard(),
    queryFn: () => apiClient.getDashboardReport(),
    enabled,
    staleTime: 30_000,
  });
}
