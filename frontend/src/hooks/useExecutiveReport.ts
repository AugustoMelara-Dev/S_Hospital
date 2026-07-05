import { useQuery } from '@tanstack/react-query';
import { apiClient, type ExecutiveReport, type ExecutiveReportFilters, type TodayReport } from '@/lib/api';
import { getVisibleRefetchInterval } from '@/lib/query/polling';
import { queryKeys } from '@/lib/queryKeys';

export function useTodayReport() {
  return useQuery({
    queryKey: queryKeys.reports.today(),
    queryFn: () => apiClient.getTodayReport(),
    refetchInterval: () => getVisibleRefetchInterval(60_000),
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}

export function useExecutiveReport(filters: ExecutiveReportFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.reports.executive(filters),
    queryFn: () => apiClient.getExecutiveReport(filters),
    staleTime: 60_000,
    enabled: enabled && Boolean(filters.date_from && filters.date_to),
  });
}

export type { ExecutiveReport, ExecutiveReportFilters, TodayReport };
