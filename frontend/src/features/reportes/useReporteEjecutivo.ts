import { useQuery } from '@tanstack/react-query';
import { reports, type ExecutiveReportFilters } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { normalizeReporte, type ReporteEjecutivo } from './types';

/**
 * Carga el reporte ejecutivo con la misma clave de cache y contrato que la
 * exportación: `reports.getExecutiveReport(appliedFilters)`.
 */
export function useReporteEjecutivo(filters: ExecutiveReportFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.reports.executive(filters),
    queryFn: async (): Promise<ReporteEjecutivo> => normalizeReporte(await reports.getExecutiveReport(filters)),
    staleTime: 60_000,
    enabled: enabled && Boolean(filters.date_from && filters.date_to),
  });
}
