import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, App as AntApp, Button, Empty, Spin, Typography } from 'antd';
import {
  type ExecutiveReportFilters as ExecutiveReportFilterState,
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
import { PendingAgingPanel } from './components/PendingAgingPanel';
import { ExecutiveReportFilters } from './components/ExecutiveReportFilters';
import { computePresetRange, parseReportDate, type PresetKey } from './components/reportDateRanges';
import { AccountingPolicyPanel } from '@/modules/reports/components/AccountingPolicyPanel';
import { ReportScope } from './components/ReportScope';

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
  const { message: notify } = AntApp.useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilters = initialExecutiveFilters(searchParams, canViewManagerial);
  const [preset, setPreset] = useState<PresetKey>(() => detectExecutivePreset(initialFilters));
  const [filters, setFilters] = useState<ExecutiveReportFilterState>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<ExecutiveReportFilterState>(initialFilters);
  const urlFilterKey = searchParams.toString();

  useEffect(() => {
    const currentParams = new URLSearchParams(urlFilterKey);
    const next = initialExecutiveFilters(currentParams, canViewManagerial);

    if (!currentParams.has('from') || !currentParams.has('to')) {
      const normalized = new URLSearchParams(currentParams);
      normalized.set('from', next.date_from);
      normalized.set('to', next.date_to);
      setSearchParams(normalized, { replace: true });
      return;
    }

    setFilters((current) => sameFilters(current, next) ? current : next);
    setAppliedFilters((current) => sameFilters(current, next) ? current : next);
    setPreset(detectExecutivePreset(next));
  }, [canViewManagerial, setSearchParams, urlFilterKey]);
  const [exporting, setExporting] = useState(false);
  const executiveRangeError = validateReportDateRange(
    filters.date_from,
    filters.date_to,
    92,
    'ejecutivo',
  );
  const hasUnappliedChanges = !sameFilters(filters, appliedFilters);

  const { data: report, dataUpdatedAt, isFetching, isError, refetch, error: queryError } = useExecutiveReport(
    appliedFilters,
    canViewManagerial && executiveRangeError === null,
  );

  if (!canViewManagerial) {
    return (
      <Empty description={<><Typography.Title level={3}>Reporte ejecutivo no disponible</Typography.Title><Typography.Text>Su usuario no tiene permiso para consultar el reporte ejecutivo. Solicite a un supervisor el permiso reports.managerial.view.</Typography.Text></>} />
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
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('from', filters.date_from);
      next.set('to', filters.date_to);
      return next;
    });
  }

  function handleExportPdf() {
    if (!canExport) {
      notify?.warning?.('Exportacion PDF requiere permiso de exportacion de reportes.');
      return;
    }
    if (executiveRangeError) {
      notify?.warning?.(executiveRangeError);
      onStatus(executiveRangeError);
      return;
    }
    if (hasUnappliedChanges) {
      notify?.warning?.('Aplique el periodo antes de exportar el reporte ejecutivo.');
      return;
    }
    if (exporting) return;
    setExporting(true);
    onStatus('Preparando PDF ejecutivo...');
    void runExecutiveExport(
      apiClient.downloadExecutivePdf,
      appliedFilters,
      (blob) => {
        openBlobInNewTab(blob, `reporte-ejecutivo-${appliedFilters.date_from}-a-${appliedFilters.date_to}.pdf`);
        notify?.success?.('PDF ejecutivo generado.');
        onStatus('PDF ejecutivo generado.');
      },
      (err) => {
        const message = userSafeErrorMessage(err, 'No se pudo generar el PDF ejecutivo.');
        notify?.error?.(message);
        onStatus(message);
      },
      () => {
        setExporting(false);
      },
    );
  }

  function handleExportExcel() {
    if (!canExport) {
      notify?.warning?.('Exportacion Excel requiere permiso de exportacion de reportes.');
      return;
    }
    if (executiveRangeError) {
      notify?.warning?.(executiveRangeError);
      onStatus(executiveRangeError);
      return;
    }
    if (hasUnappliedChanges) {
      notify?.warning?.('Aplique el periodo antes de exportar el reporte ejecutivo.');
      return;
    }
    if (exporting) return;
    setExporting(true);
    onStatus('Descargando Excel ejecutivo...');
    void runExecutiveExport(
      apiClient.downloadExecutiveExcel,
      appliedFilters,
      (blob) => {
        downloadBlob(blob, `reporte-ejecutivo-${appliedFilters.date_from}-a-${appliedFilters.date_to}.xlsx`);
        notify?.success?.('Excel ejecutivo descargado.');
        onStatus('Excel ejecutivo descargado.');
      },
      (err) => {
        const message = userSafeErrorMessage(err, 'No se pudo descargar el Excel.');
        notify?.error?.(message);
        onStatus(message);
      },
      () => {
        setExporting(false);
      },
    );
  }

  return (
    <section className="flex flex-col gap-5" aria-label="Reporte ejecutivo">
      <ExecutiveReportFilters
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
        hasUnappliedChanges={hasUnappliedChanges}
      />

      {!executiveRangeError ? (
        <ReportScope
          ariaLabel="Alcance del reporte ejecutivo"
          from={appliedFilters.date_from}
          to={appliedFilters.date_to}
          source="Totales operativos consolidados por el servidor hospitalario"
          updatedAt={dataUpdatedAt}
        />
      ) : null}

      {executiveRangeError ? (
        <Alert type="warning" showIcon title="Rango ejecutivo no válido" description={executiveRangeError} />
      ) : null}

      {isError ? (
        <Alert
          type="error"
          showIcon
          title="No se pudo cargar el reporte ejecutivo"
          description={<>{userSafeErrorMessage(queryError, 'No se pudo cargar la información. Revise la conexión local y vuelva a intentar.')}
            <Button
              htmlType="button"
              onClick={handleRefresh}
              size="large"
            >
              Reintentar
            </Button>
          </>}
        />
      ) : null}

      {isFetching && !report ? (
        <div role="status" aria-label="Cargando reporte ejecutivo..."><Spin /> Cargando reporte ejecutivo...</div>
      ) : null}

      {report ? (
        <div className="flex flex-col gap-5">
          <ExecutiveSummary report={report} />
          <AccountingPolicyPanel policy={report.accounting_policy} />
          <ExecutiveAlerts report={report} />
          <PendingAgingPanel report={report} />
          <PaymentMethodPanel report={report} />
          <TrendChart report={report} />
          <ServiceRanking report={report} />
        </div>
      ) : null}
    </section>
  );
}

function initialExecutiveFilters(
  searchParams: URLSearchParams,
  canViewManagerial: boolean,
): ExecutiveReportFilterState {
  const defaultRange = computePresetRange(canViewManagerial ? 'thisMonth' : 'today');
  return {
    date_from: searchParams.get('from') ?? defaultRange.from,
    date_to: searchParams.get('to') ?? defaultRange.to,
  };
}

function detectExecutivePreset(filters: ExecutiveReportFilterState): PresetKey {
  const presets: PresetKey[] = ['today', 'yesterday', 'last7', 'thisMonth', 'lastMonth'];
  return presets.find((candidate) => {
    const range = computePresetRange(candidate);
    return range.from === filters.date_from && range.to === filters.date_to;
  }) ?? 'custom';
}

function validateReportDateRange(dateFrom: string, dateTo: string, maxDays: number, scope: string): string | null {
  if (!dateFrom || !dateTo) {
    return 'Seleccione fecha de inicio y fin para el reporte.';
  }

  const start = parseReportDate(dateFrom);
  const end = parseReportDate(dateTo);

  if (!start || !end) {
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

function sameFilters(left: ExecutiveReportFilterState, right: ExecutiveReportFilterState): boolean {
  return left.date_from === right.date_from && left.date_to === right.date_to;
}

async function runExecutiveExport<T>(
  task: (filters: ExecutiveReportFilterState) => Promise<T>,
  filters: ExecutiveReportFilterState,
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
