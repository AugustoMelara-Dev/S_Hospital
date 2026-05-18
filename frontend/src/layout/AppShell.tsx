import {
  Archive,
  Boxes,
  ClipboardList,
  FileClock,
  LayoutDashboard,
  LogOut,
  Plus,
  ReceiptText,
  Settings,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { type AuthUser, type CashSession } from '../lib/api';
import { cn } from '../lib/utils';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

export type AppNavigationItem = {
  label: string;
  path: string;
  permission?: string | string[];
  icon: typeof LayoutDashboard;
};

export const appNavigation: AppNavigationItem[] = [
  { label: 'Inicio', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Nueva factura', path: '/billing/new', permission: 'invoices.create', icon: ReceiptText },
  { label: 'Caja', path: '/cashbox', permission: 'cash.view', icon: WalletCards },
  { label: 'Catalogo', path: '/catalog', permission: 'catalog.view', icon: Boxes },
  { label: 'Historial', path: '/invoices', permission: 'invoices.view', icon: FileClock },
  { label: 'Reportes', path: '/reports', permission: ['reports.view', 'reports.managerial.view', 'reports.cash_session.view'], icon: ClipboardList },
  { label: 'Backups', path: '/backups', permission: 'backups.view', icon: Archive },
  { label: 'Configuracion fiscal', path: '/settings/fiscal', permission: 'settings.fiscal.view', icon: Settings },
];

type AppShellProps = {
  cashSession: CashSession | null;
  children: React.ReactNode;
  onLogout: () => void;
  status: string;
  user: AuthUser;
};

export function AppShell({ cashSession, children, onLogout, status, user }: AppShellProps) {
  const location = useLocation();
  const [now, setNow] = useState(() => new Date());
  const visibleNavigation = appNavigation.filter((item) => {
    if (!item.permission) {
      return true;
    }

    const permissions = Array.isArray(item.permission) ? item.permission : [item.permission];

    return permissions.some((permission) => user.permissions.includes(permission));
  });
  const activeItem = [...appNavigation]
    .sort((left, right) => right.path.length - left.path.length)
    .find((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`));
  const roleLabel = user.roles.length > 0 ? user.roles.join(', ') : 'Sin rol';
  const cashLabel = cashSession?.status === 'open' ? `Caja #${cashSession.id} abierta` : 'Caja sin validar';
  const localTime = new Intl.DateTimeFormat('es-HN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(now);
  const serverLabel = status.toLowerCase().includes('error') || status.toLowerCase().includes('no se pudo')
    ? 'Servidor LAN con alerta'
    : 'Servidor LAN operativo';
  const canCreateInvoices = user.permissions.includes('invoices.create');
  const canViewCash = user.permissions.includes('cash.view');
  const canViewInvoices = user.permissions.includes('invoices.view');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="app-shell min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[17rem_1fr]">
        <aside className="print-hidden border-b border-border bg-sidebar text-sidebar-foreground lg:border-b-0 lg:border-r">
          <div className="flex flex-col gap-4 p-4 lg:min-h-screen lg:gap-6">
            <div className="flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent p-3">
              <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">Hospital Billing OS</p>
                <p className="truncate text-xs text-sidebar-foreground/70">Caja hospitalaria LAN</p>
              </div>
            </div>

            <nav
              aria-label="Navegacion principal"
              className="flex gap-1 overflow-x-auto pb-1 lg:flex-1 lg:flex-col lg:overflow-visible lg:pb-0"
            >
              {visibleNavigation.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-11 shrink-0 items-center gap-3 rounded-md px-3 text-sm font-semibold text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:shrink',
                        isActive && 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground',
                      )
                    }
                    key={item.path}
                    to={item.path}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="print-hidden sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
            <div className="flex min-h-16 flex-col gap-3 px-5 py-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                  {activeItem?.label ?? 'Modulo'}
                </p>
                <p className="truncate text-xl font-semibold tracking-normal">
                  {activeItem?.label ?? 'Hospital Billing OS'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canCreateInvoices ? (
                  <Button asChild size="sm">
                    <NavLink to="/billing/new">
                      <Plus className="size-4" aria-hidden="true" />
                      Facturar
                    </NavLink>
                  </Button>
                ) : null}
                {canViewCash ? (
                  <Button asChild variant="secondary" size="sm">
                    <NavLink to="/cashbox">
                      <WalletCards className="size-4" aria-hidden="true" />
                      Arqueo
                    </NavLink>
                  </Button>
                ) : null}
                {canViewInvoices ? (
                  <Button asChild variant="secondary" size="sm">
                    <NavLink to="/invoices">
                      <FileClock className="size-4" aria-hidden="true" />
                      Buscar recibos
                    </NavLink>
                  </Button>
                ) : null}
                <Badge variant="outline">{cashLabel}</Badge>
                <Badge variant="outline" title={status}>{serverLabel}</Badge>
                <Badge variant="secondary">Hora local {localTime}</Badge>
                <Badge variant="secondary">{roleLabel}</Badge>
                <span className="text-sm font-semibold text-foreground">{user.name}</span>
                <Button type="button" variant="secondary" size="sm" onClick={onLogout}>
                  <LogOut className="size-4" aria-hidden="true" />
                  Salir
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 p-5">
            <div className="mx-auto flex max-w-7xl flex-col gap-5">{children}</div>
          </main>

          <footer className="print-hidden border-t border-border bg-card px-5 py-3">
            <p className="mx-auto max-w-7xl text-sm text-muted-foreground" role="status">
              {status}
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
