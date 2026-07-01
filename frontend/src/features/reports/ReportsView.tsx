import { useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { EmptyState, ErrorState } from '@/components/ui/states';
import {
  InfoPanel,
  OperationalBanner,
} from '@/components/shared';
import {
  type ExecutiveReportFilters,
  apiClient,
  userSafeErrorMessage,
} from '@/lib/api';
import { useExecutiveReport } from '@/hooks/useExecutiveReport';
import { AuditSummaryPanel } from './components/AuditSummaryPanel';
import {
  ReportFiltersPanel,
  computePresetRange,
  type PresetKey,
} from './components/ReportFiltersPanel';
import { CashSessionReportTab } from './components/CashSessionReportTab';
import { ReportsExecutive } from './ReportsExecutive';
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
    <ReportsExecutive
      canViewManagerial={props.canViewManagerial}
      canExport={props.canExport}
      onStatus={props.onStatus}
    />
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

      {!canViewCash && !canViewManagerial ? (
        <EmptyState
          title="Reporte de caja no disponible"
          description="Este usuario no tiene permiso para consultar cajas."
        />
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
