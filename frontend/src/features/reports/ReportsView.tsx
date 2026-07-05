import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ReportsAudit } from './ReportsAudit';
import { ReportsCash } from './ReportsCash';
import { ReportsExecutive } from './ReportsExecutive';
import { PageHeader } from '@/components/ui/page-header';
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

type ReportSubRoute = typeof SUB_ROUTES[number]['id'];

export function ReportsView(props: ReportsViewProps) {
  const { isRoot, subRoute } = useReportsRoute();
  const requestedSubRoute =
    isRoot && subRoute === 'executive' && !props.canViewManagerial && props.canViewCashSessionReport
      ? 'cash'
      : subRoute;
  const activeSubRoute = permittedReportRoute(requestedSubRoute, props.canViewManagerial, props.canViewCashSessionReport);

  return (
    <div data-slot="reports-view" className="flex flex-col gap-5">
      {isRoot ? (
        <PageHeader
          title="Reportes"
          description="Ejecutivo, caja y auditoria para supervision diaria."
          className="pb-4"
        />
      ) : null}
      <ReportsNavigation active={activeSubRoute} canViewManagerial={props.canViewManagerial} canViewCash={props.canViewCashSessionReport} />
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
): ReportSubRoute {
  if (canAccessReportRoute(requested, canViewManagerial, canViewCash)) {
    return requested;
  }

  if (requested !== 'cash' && canViewCash) {
    return 'cash';
  }

  return requested;
}

function canAccessReportRoute(
  route: ReportSubRoute,
  canViewManagerial: boolean,
  canViewCash: boolean,
): boolean {
  if (route === 'cash') {
    return canViewCash || canViewManagerial;
  }

  return canViewManagerial;
}

function ReportsNavigation({
  active,
  canViewManagerial,
  canViewCash,
}: {
  active: ReportSubRoute;
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
        const descriptionId = `report-section-${route.id}-description`;
        return (
          <Link
            key={route.id}
            to={`${basePath}/${route.id}`}
            aria-current={isActive ? 'page' : undefined}
            aria-describedby={descriptionId}
            className={cn(
              'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              isActive
                ? 'border-hospital-primary bg-hospital-primary/10 text-foreground shadow-sm'
                : 'border-operational-border bg-operational-surface text-muted-foreground hover:border-hospital-primary/45 hover:text-foreground',
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            <span>{route.label}</span>
            <span id={descriptionId} className="sr-only">
              {route.description}
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
        canExport={props.canExport}
        canViewCash={props.canViewCashSessionReport}
        canViewManagerial={props.canViewManagerial}
      />
    );
  }

  if (subRoute === 'audit') {
    return (
      <ReportsAudit
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
      titleLevel={executiveTitleLevel}
    />
  );
}
