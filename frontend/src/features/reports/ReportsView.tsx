import { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ReportsAudit } from './ReportsAudit';
import { ReportsCash } from './ReportsCash';
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
    return <ReportsCash canViewCash={props.canViewCashSessionReport} canViewManagerial={props.canViewManagerial} />;
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
    />
  );
}
