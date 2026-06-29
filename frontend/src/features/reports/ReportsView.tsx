import { useMemo, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import {
  InfoPanel,
  OperationalBanner,
  StatCard,
} from '@/components/shared';
import {
  type ExecutiveReportFilters,
  apiClient,
  userSafeErrorMessage,
} from '@/lib/api';
import { useExecutiveReport } from '@/hooks/useExecutiveReport';
import { ExecutiveSummary } from './components/ExecutiveSummary';
import { TrendChart } from './components/TrendChart';
import { PaymentMethodPanel } from './components/PaymentMethodPanel';
import { ServiceRanking } from './components/ServiceRanking';
import { AuditSummaryPanel } from './components/AuditSummaryPanel';
import { MetricsGlossary } from './components/MetricsGlossary';
import {
  ReportFiltersPanel,
  computePresetRange,
  type PresetKey,
} from './components/ReportFiltersPanel';
import { CashSessionReportTab } from './components/CashSessionReportTab';
import { notify } from '@/components/ui/toaster';
import { downloadBlob, openBlobInNewTab } from '@/lib/download';
import { cn } from '@/lib/utils';
import { LineChart, ShieldCheck, WalletCards } from 'lucide-react';

type ReportsViewProps = {
  canExport: boolean;
  canViewCashSessionReport: boolean;
  canViewManagerial: boolean;
  onStatus: (message: string) => void;
};

const SUB_ROUTES = [
  {
    id: 'executive',
    label: 'Ejecutivo',
    description: 'Cobros, pendientes, ticket promedio, tendencia y servicios.',
    icon: LineChart,
  },
  {
    id: 'cash',
    label: 'Caja',
    description: 'Sesiones, cajeros, metodos y diferencias.',
    icon: WalletCards,
  },
  {
    id: 'audit',
    label: 'Auditoria',
    description: 'Anulaciones, reversos, cambios de precio y fiscales.',
    icon: ShieldCheck,
  },
] as const;

export function ReportsView(props: ReportsViewProps) {
  const subRoute = SubRouteFromLocation();
  return (
    <div data-slot="reports-view" className="flex flex-col gap-5">
      <ReportsNavigation active={subRoute} canViewManagerial={props.canViewManagerial} canViewCash={props.canViewCashSessionReport} />
      <ReportsContent {...props} subRoute={subRoute} />
    </div>
  );
}

function SubRouteFromLocation(): typeof SUB_ROUTES[number]['id'] {
  const location = useLocation();
  return useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    return (segments[1] ?? 'executive') as typeof SUB_ROUTES[number]['id'];
  }, [location.pathname]);
}

function ReportsNavigation({
  active,
  canViewManagerial,
  canViewCash,
}: {
  active: typeof SUB_ROUTES[number]['id'];
  canViewManagerial: boolean;
  canViewCash: boolean;
}) {
  const basePath = '/reports';
  const visible = SUB_ROUTES.filter((route) => {
    if (route.id === 'executive' || route.id === 'audit') return canViewManagerial;
    if (route.id === 'cash') return canViewCash || canViewManagerial;
    return true;
  });

  if (visible.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Secciones de reportes" className="flex flex-wrap gap-2">
      {visible.map((route) => {
        const isActive = active === route.id;
        const Icon = route.icon;
        return (
          <NavLink
            key={route.id}
            to={`${basePath}/${route.id}`}
            aria-current={isActive ? 'page' : undefined}
            className={({ isActive: navActive }) =>
              cn(
                'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                isActive || navActive
                  ? 'border-hospital-primary bg-hospital-primary/10 text-foreground shadow-sm'
                  : 'border-operational-border bg-operational-surface text-muted-foreground hover:border-hospital-primary/45 hover:text-foreground',
              )
            }
          >
            <Icon aria-hidden="true" className="size-4" />
            <span>{route.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function ReportsContent({
  subRoute,
  ...props
}: ReportsViewProps & { subRoute: typeof SUB_ROUTES[number]['id'] }) {
  if (subRoute === 'cash') {
    return <CashSubRoute canViewCash={props.canViewCashSessionReport} canViewManagerial={props.canViewManagerial} />;
  }

  if (subRoute === 'audit') {
    return (
      <AuditSubRoute
        canViewManagerial={props.canViewManagerial}
        canExport={props.canExport}
        onStatus={props.onStatus}
      />
    );
  }

  return (
    <ExecutiveSubRoute
      canViewManagerial={props.canViewManagerial}
      canExport={props.canExport}
      onStatus={props.onStatus}
    />
  );
}

function ExecutiveSubRoute({
  canViewManagerial,
  canExport,
  onStatus,
}: {
  canViewManagerial: boolean;
  canExport: boolean;
  onStatus: (message: string) => void;
}) {
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
  const exportingRef = useRef(false);
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
    if (exportingRef.current) return;
    exportingRef.current = true;
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
        exportingRef.current = false;
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
    if (exportingRef.current) return;
    exportingRef.current = true;
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
        exportingRef.current = false;
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
        exporting={exportingRef.current}
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

function CashSubRoute({
  canViewCash,
  canViewManagerial,
}: {
  canViewCash: boolean;
  canViewManagerial: boolean;
}) {
  const [cashSessionReport, setCashSessionReport] = useState<Awaited<ReturnType<typeof apiClient.getCashSessionReport>> | null>(null);
  const [cashReportId, setCashReportId] = useState('');
  const [cashError, setCashError] = useState('');
  // const { data: cashSession } = useCashSession();

  async function loadCashReport() {
    if (!cashReportId.trim()) {
      setCashError('Ingrese el numero de caja.');
      return;
    }
    try {
      setCashError('');
      setCashSessionReport(await apiClient.getCashSessionReport(cashReportId));
    } catch (err) {
      setCashError(userSafeErrorMessage(err, 'No se pudo cargar la caja.'));
    }
  }

  return (
    <section className="flex flex-col gap-5" aria-label="Reporte de caja">
      <OperationalBanner
        meta="Reporte de caja"
        title="Operacion de caja"
        description="Sesiones, cajeros, metodos de pago y diferencias de caja."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sesiones" value="Hoy" helper="Disponibles en historial" />
        <StatCard label="Cajero actual" value="Sin caja" helper="Abra caja desde el modulo de Caja" />
        <StatCard label="Metodos" value="Efectivo, transferencia, tarjeta" helper="Resumen por metodo disponible" />
        <StatCard label="Diferencias" value="0" helper="Cierres cuadrados; revise auditoria si hay alertas" />
      </div>

      <CashSessionReportTab
        canExport={canViewManagerial}
        cashSession={cashSessionReport}
        cashReportId={cashReportId}
        loading={false}
        exporting={false}
        error={cashError}
        onCashReportIdChange={setCashReportId}
        onExport={() => {}}
        onSubmit={(event) => {
          event.preventDefault();
          void loadCashReport();
        }}
      />

      {cashSessionReport ? (
        <div className="flex flex-col gap-5">
          <Card className="border-operational-border bg-operational-surface shadow-operational">
            <CardHeader title="Resumen" />
            <CardContent>
              <pre className="overflow-x-auto rounded border border-border bg-muted/30 p-3 text-xs">
                {JSON.stringify(
                  {
                    id: cashSessionReport.cash_session?.id,
                    status: cashSessionReport.cash_session?.status,
                    opening_amount: cashSessionReport.cash_session?.opening_amount,
                    closing_amount: cashSessionReport.cash_session?.closing_amount,
                    difference_amount: cashSessionReport.cash_session?.difference_amount,
                    totals_by_method: cashSessionReport.totals_by_method,
                  },
                  null,
                  2,
                )}
              </pre>
            </CardContent>
          </Card>
          {!canViewCash && !canViewManagerial ? (
            <EmptyState
              title="Reporte de caja no disponible"
              description="Este usuario no tiene permiso para consultar cajas."
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function AuditSubRoute({
  canViewManagerial,
  canExport,
}: {
  canViewManagerial: boolean;
  canExport: boolean;
  onStatus: (message: string) => void;
}) {
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


