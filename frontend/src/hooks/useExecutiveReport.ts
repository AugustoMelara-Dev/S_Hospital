import { useQuery } from '@tanstack/react-query';
import { apiClient, type ExecutiveReport, type ExecutiveReportFilters } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useExecutiveReport(filters: ExecutiveReportFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.reports.executive(filters),
    queryFn: () => apiClient.getExecutiveReport(filters),
    staleTime: 60_000,
    enabled: enabled && Boolean(filters.date_from && filters.date_to),
  });
}

export type { ExecutiveReport, ExecutiveReportFilters };
