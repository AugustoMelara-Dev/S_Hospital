import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ReportsAudit } from './ReportsAudit';
import { ReportsCash } from './ReportsCash';
import { ReportsExecutive } from './ReportsExecutive';
import { LineChartOutlined, SafetyCertificateOutlined, WalletOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/ui/page-header';

type ReportsViewProps = {
  canBrowseCashSessions: boolean;
  canExport: boolean;
  canViewAuditReports: boolean;
  canViewCashSessionReport: boolean;
  canViewManagerial: boolean;
  onStatus: (message: string) => void;
};

const SUB_ROUTES = [
  {
    id: 'executive',
    label: 'Ejecutivo',
    description: 'Cobros, pendientes, ticket promedio, tendencia y servicios.',
    icon: LineChartOutlined,
  },
  {
    id: 'cash',
    label: 'Caja',
    description: 'Sesiones, cajeros, metodos y diferencias.',
    icon: WalletOutlined,
  },
  {
    id: 'audit',
    label: 'Auditoria',
    description: 'Anulaciones, reversos, cambios de precio y fiscales.',
    icon: SafetyCertificateOutlined,
  },
] as const;

type ReportSubRoute = typeof SUB_ROUTES[number]['id'];

export function ReportsView(props: ReportsViewProps) {
  const { isRoot, subRoute } = useReportsRoute();
  const requestedSubRoute =
    isRoot && subRoute === 'executive' && !props.canViewManagerial && props.canViewCashSessionReport
      ? 'cash'
      : isRoot && subRoute === 'executive' && !props.canViewManagerial && !props.canViewCashSessionReport && props.canViewAuditReports
        ? 'audit'
      : subRoute;
  const activeSubRoute = permittedReportRoute(
    requestedSubRoute,
    props.canViewManagerial,
    props.canViewCashSessionReport,
    props.canViewAuditReports,
  );

  return (
    <div data-slot="reports-view" className="flex flex-col gap-5">
      {isRoot ? (
        <PageHeader
          title="Informes y auditoría"
          description="Resumen ejecutivo, control de caja y trazabilidad para la supervisión institucional."
          className="pb-4"
        />
      ) : null}
      <ReportsNavigation
        active={activeSubRoute}
        canViewAuditReports={props.canViewAuditReports}
        canViewManagerial={props.canViewManagerial}
        canViewCash={props.canViewCashSessionReport}
      />
      <ReportsContent {...props} subRoute={activeSubRoute} executiveTitleLevel={isRoot ? 2 : 1} />
    </div>
  );
}

function useReportsRoute(): { isRoot: boolean; subRoute: ReportSubRoute } {
  const location = useLocation();
  return useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const requestedSubRoute = segments[1] ?? 'executive';
    const subRoute = isReportSubRoute(requestedSubRoute) ? requestedSubRoute : 'executive';
    return { isRoot: segments.length === 1, subRoute };
  }, [location.pathname]);
}

function isReportSubRoute(value: string): value is ReportSubRoute {
  return SUB_ROUTES.some((route) => route.id === value);
}

function permittedReportRoute(
  requested: ReportSubRoute,
  canViewManagerial: boolean,
  canViewCash: boolean,
  canViewAuditReports: boolean,
): ReportSubRoute {
  if (canAccessReportRoute(requested, canViewManagerial, canViewCash, canViewAuditReports)) {
    return requested;
  }

  if (requested !== 'cash' && canViewCash) {
    return 'cash';
  }

  if (requested !== 'executive' && canViewManagerial) {
    return 'executive';
  }

  if (requested !== 'audit' && canViewAuditReports) {
    return 'audit';
  }

  return requested;
}

function canAccessReportRoute(
  route: ReportSubRoute,
  canViewManagerial: boolean,
  canViewCash: boolean,
  canViewAuditReports: boolean,
): boolean {
  if (route === 'cash') {
    return canViewCash || canViewManagerial;
  }

  if (route === 'audit') {
    return canViewAuditReports;
  }

  return canViewManagerial;
}

function ReportsNavigation({
  active,
  canViewAuditReports,
  canViewManagerial,
  canViewCash,
}: {
  active: ReportSubRoute;
  canViewAuditReports: boolean;
  canViewManagerial: boolean;
  canViewCash: boolean;
}) {
  const basePath = '/reports';
  const visible = SUB_ROUTES.filter((route) => {
    if (route.id === 'executive') return canViewManagerial;
    if (route.id === 'audit') return canViewAuditReports;
    if (route.id === 'cash') return canViewCash || canViewManagerial;
    return true;
  });

  if (visible.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Secciones de reportes" className="grid gap-3 md:grid-cols-3">
      {visible.map((route) => {
        const isActive = active === route.id;
        const Icon = route.icon;
        const descriptionId = `report-section-${route.id}-description`;
        return (
          <Link
            key={route.id}
            to={`${basePath}/${route.id}`}
            aria-current={isActive ? 'page' : undefined}
            aria-describedby={descriptionId}
            className={`flex min-h-20 items-center gap-3 border px-4 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 ${isActive ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-blue-600'}`}
          >
            <span className="flex size-10 shrink-0 items-center justify-center"><Icon aria-hidden="true" className="size-5" /></span>
            <span className="min-w-0">
              <span className="block font-semibold">{route.label}</span>
              <span id={descriptionId} className="mt-1 block text-xs font-normal leading-relaxed">{route.description}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function ReportsContent({
  executiveTitleLevel,
  subRoute,
  ...props
}: ReportsViewProps & {
  executiveTitleLevel: 1 | 2 | 3;
  subRoute: ReportSubRoute;
}) {
  if (subRoute === 'cash') {
    return (
      <ReportsCash
        canBrowseCashSessions={props.canBrowseCashSessions}
        canExport={props.canExport}
        canViewCash={props.canViewCashSessionReport}
        canViewManagerial={props.canViewManagerial}
      />
    );
  }

  if (subRoute === 'audit') {
    return (
      <ReportsAudit
        canViewManagerial={props.canViewAuditReports}
        canViewExecutiveSummary={props.canViewManagerial}
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
      titleLevel={executiveTitleLevel}
    />
  );
}
