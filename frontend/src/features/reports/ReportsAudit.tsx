import { useState } from 'react';
import { ErrorState } from '@/components/ui/states';
import { InfoPanel } from '@/components/shared';
import { type ExecutiveReportFilters } from '@/lib/api';
import { useExecutiveReport } from '@/hooks/useExecutiveReport';
import { AuditSummaryPanel } from './components/AuditSummaryPanel';
import {
  ReportFiltersPanel,
  computePresetRange,
  type PresetKey,
} from './components/ReportFiltersPanel';

type ReportsAuditProps = {
  canExport: boolean;
  canViewManagerial: boolean;
  onStatus: (message: string) => void;
};

export function ReportsAudit({
  canViewManagerial,
  canExport,
}: ReportsAuditProps) {
  const [preset, setPreset] = useState<PresetKey>('thisMonth');
  const [filters, setFilters] = useState<ExecutiveReportFilters>(() => {
    const initialRange = computePresetRange('thisMonth');
    return { date_from: initialRange.from, date_to: initialRange.to };
  });
  const [appliedFilters, setAppliedFilters] = useState<ExecutiveReportFilters>(() => {
    const initialRange = computePresetRange('thisMonth');
    return { date_from: initialRange.from, date_to: initialRange.to };
  });

  const { data: report, isFetching, isError, refetch } = useExecutiveReport(
    appliedFilters,
    canViewManagerial,
  );

  if (!canViewManagerial) {
    return (
      <InfoPanel
        tone="warning"
        title="Sin permisos para auditoria"
        description="Su usuario no tiene permisos para consultar el reporte de auditoria."
      />
    );
  }

  return (
    <section className="flex flex-col gap-5" aria-label="Reporte de auditoria">
      <ReportFiltersPanel
        filters={filters}
        preset={preset}
        onPresetChange={setPreset}
        onChange={setFilters}
        onRefresh={() => setAppliedFilters(filters)}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
        canExport={canExport}
        loading={isFetching}
        exporting={false}
        rangeError={null}
      />

      {report ? (
        <div className="flex flex-col gap-5">
          <AuditSummaryPanel report={report} />
        </div>
      ) : null}

      {isError ? (
        <ErrorState
          title="No se pudo cargar la auditoria"
          description="Reintente la carga del reporte."
          action={
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded border border-border bg-card px-3 py-1.5 text-sm font-semibold hover:bg-muted"
            >
              Reintentar
            </button>
          }
        />
      ) : null}
    </section>
  );
}
