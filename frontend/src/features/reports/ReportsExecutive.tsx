import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { notify } from '@/components/ui/toaster';
import {
  type ExecutiveReportFilters,
  apiClient,
  userSafeErrorMessage,
} from '@/lib/api';
import { useExecutiveReport } from '@/hooks/useExecutiveReport';
import { downloadBlob, openBlobInNewTab } from '@/lib/download';
import { ExecutiveSummary } from './components/ExecutiveSummary';
import { ExecutiveAlerts } from './components/ExecutiveAlerts';
import { TrendChart } from './components/TrendChart';
import { PaymentMethodPanel } from './components/PaymentMethodPanel';
import { ServiceRanking } from './components/ServiceRanking';
import { MetricsGlossary } from './components/MetricsGlossary';
import {
  ReportFiltersPanel,
  computePresetRange,
  type PresetKey,
} from './components/ReportFiltersPanel';

type ReportsExecutiveProps = {
  canExport: boolean;
  canViewManagerial: boolean;
  onStatus: (message: string) => void;
  titleLevel?: 1 | 2 | 3;
};

export function ReportsExecutive({
  canViewManagerial,
  canExport,
  onStatus,
  titleLevel = 1,
}: ReportsExecutiveProps) {
  const [preset, setPreset] = useState<PresetKey>(canViewManagerial ? 'thisMonth' : 'today');
  const [filters, setFilters] = useState<ExecutiveReportFilters>(() => {
    const initialRange = computePresetRange(canViewManagerial ? 'thisMonth' : 'today');
    return { date_from: initialRange.from, date_to: initialRange.to };
  });
  const [appliedFilters, setAppliedFilters] = useState<ExecutiveReportFilters>(() => {
    const initialRange = computePresetRange(canViewManagerial ? 'thisMonth' : 'today');
    return { date_from: initialRange.from, date_to: initialRange.to };
  });
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const executiveRangeError = validateReportDateRange(
    filters.date_from,
    filters.date_to,
    92,
    'ejecutivo',
  );

  const { data: report, isFetching, isError, refetch, error: queryError } = useExecutiveReport(
    appliedFilters,
    canViewManagerial && executiveRangeError === null,
  );

  if (!canViewManagerial) {
    return (
      <EmptyState
        title="Reporte ejecutivo no disponible"
        description="Su usuario no tiene permiso para consultar el reporte ejecutivo. Solicite a un supervisor el permiso reports.managerial.view."
      />
    );
  }

  function handleRefresh() {
    if (executiveRangeError) {
      onStatus(executiveRangeError);
      return;
    }
    if (sameFilters(filters, appliedFilters)) {
      void refetch();
      return;
    }
    setAppliedFilters(filters);
  }

  function handleExportPdf() {
    if (!canExport) {
      notify.warning('Exportacion PDF requiere permiso de exportacion de reportes.');
      return;
    }
    if (executiveRangeError) {
      notify.warning(executiveRangeError);
      onStatus(executiveRangeError);
      return;
    }
    if (exporting) return;
    setExporting(true);
    onStatus('Preparando PDF ejecutivo...');
    void runExecutiveExport(
      apiClient.downloadExecutivePdf,
      filters,
      (blob) => {
        openBlobInNewTab(blob, `reporte-ejecutivo-${filters.date_from}-a-${filters.date_to}.pdf`);
        notify.success('PDF ejecutivo generado.');
        onStatus('PDF ejecutivo generado.');
      },
      (err) => {
        const message = userSafeErrorMessage(err, 'No se pudo generar el PDF ejecutivo.');
        notify.error(message);
        onStatus(message);
      },
      () => {
        setExporting(false);
      },
    );
  }

  function handleExportExcel() {
    if (!canExport) {
      notify.warning('Exportacion Excel requiere permiso de exportacion de reportes.');
      return;
    }
    if (executiveRangeError) {
      notify.warning(executiveRangeError);
      onStatus(executiveRangeError);
      return;
    }
    if (exporting) return;
    setExporting(true);
    onStatus('Descargando Excel ejecutivo...');
    void runExecutiveExport(
      apiClient.downloadExecutiveExcel,
      filters,
      (blob) => {
        downloadBlob(blob, `reporte-ejecutivo-${filters.date_from}-a-${filters.date_to}.xlsx`);
        notify.success('Excel ejecutivo descargado.');
        onStatus('Excel ejecutivo descargado.');
      },
      (err) => {
        const message = userSafeErrorMessage(err, 'No se pudo descargar el Excel.');
        notify.error(message);
        onStatus(message);
      },
      () => {
        setExporting(false);
      },
    );
  }

  return (
    <section className="flex flex-col gap-5" aria-label="Reporte ejecutivo">
      <ReportFiltersPanel
        filters={filters}
        preset={preset}
        onPresetChange={setPreset}
        onChange={setFilters}
        onRefresh={handleRefresh}
        onExportPdf={handleExportPdf}
        onExportExcel={handleExportExcel}
        canExport={canExport}
        loading={isFetching}
        exporting={exporting}
        titleLevel={titleLevel}
        rangeError={executiveRangeError}
      />

      {executiveRangeError ? (
        <Alert variant="warning" title="Rango ejecutivo no valido">
          {executiveRangeError}
        </Alert>
      ) : null}

      {isError ? (
        <ErrorState
          title="No se pudo cargar el reporte ejecutivo"
          description={userSafeErrorMessage(queryError, 'Error desconocido')}
          action={
            <button
              type="button"
              onClick={handleRefresh}
              className="rounded border border-border bg-card px-3 py-1.5 text-sm font-semibold hover:bg-muted"
            >
              Reintentar
            </button>
          }
        />
      ) : null}

      {isFetching && !report ? (
        <LoadingState label="Cargando reporte ejecutivo..." />
      ) : null}

      {report ? (
        <div className="flex flex-col gap-5">
          <ExecutiveSummary report={report} />
          <ExecutiveAlerts report={report} />
          <PaymentMethodPanel report={report} />
          <TrendChart report={report} />
          <ServiceRanking report={report} />
        </div>
      ) : null}

      <div className="flex justify-end">
        <MetricsGlossary open={glossaryOpen} onOpenChange={setGlossaryOpen} compact />
      </div>
    </section>
  );
}

function validateReportDateRange(dateFrom: string, dateTo: string, maxDays: number, scope: string): string | null {
  if (!dateFrom || !dateTo) {
    return 'Seleccione fecha de inicio y fin para el reporte.';
  }

  const start = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Seleccione fechas validas para el reporte.';
  }

  const diffDays = Math.ceil((end.getTime() - start.getTime()) / 86_400_000) + 1;

  if (diffDays < 1) {
    return 'La fecha de inicio debe ser anterior o igual a la fecha de fin.';
  }

  if (diffDays > maxDays) {
    return `El rango maximo permitido para reportes ${scope} es de ${maxDays} dias.`;
  }

  return null;
}

function sameFilters(left: ExecutiveReportFilters, right: ExecutiveReportFilters): boolean {
  return left.date_from === right.date_from && left.date_to === right.date_to;
}

async function runExecutiveExport<T>(
  task: (filters: ExecutiveReportFilters) => Promise<T>,
  filters: ExecutiveReportFilters,
  onSuccess: (value: T) => void,
  onError: (err: unknown) => void,
  finalize: () => void,
): Promise<void> {
  try {
    const result = await task(filters);
    onSuccess(result);
  } catch (err) {
    onError(err);
  } finally {
    finalize();
  }
}
