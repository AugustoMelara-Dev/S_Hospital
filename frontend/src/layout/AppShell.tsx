import {
  Archive,
  Boxes,
  ChevronDown,
  ClipboardList,
  FileClock,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  Settings,
  ShieldCheck,
  User,
  WalletCards,
  Sun,
  Moon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { type AuthUser, type CashSession } from '../lib/api';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { useTheme } from '../hooks/useTheme';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';

export type AppNavigationItem = {
  label: string;
  path: string;
  permission?: string | string[];
  icon: typeof LayoutDashboard;
};

export const appNavigation: AppNavigationItem[] = [
  { label: 'Inicio', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Nueva Factura', path: '/billing/new', permission: 'invoices.create', icon: ReceiptText },
  { label: 'Caja', path: '/cashbox', permission: 'cash.view', icon: WalletCards },
  { label: 'Catálogo', path: '/catalog', permission: 'catalog.view', icon: Boxes },
  { label: 'Historial', path: '/invoices', permission: 'invoices.view', icon: FileClock },
  { label: 'Reportes', path: '/reports', permission: ['reports.view', 'reports.managerial.view', 'reports.cash_session.view'], icon: ClipboardList },
  { label: 'Backups', path: '/backups', permission: 'backups.view', icon: Archive },
  { label: 'Configuración Fiscal', path: '/settings/fiscal', permission: 'settings.fiscal.view', icon: Settings },
  { label: 'Usuarios', path: '/admin/users', permission: 'users.view', icon: User },
];

type AppShellProps = {
  cashSession: CashSession | null;
  children: React.ReactNode;
  onQuickCash: () => void;
  onQuickInvoice: () => void;
  onLogout: () => void;
  status: string;
  user: AuthUser;
  topbarVariant?: 'default' | 'minimal';
  logoUrl?: string | null;
};

export type { AppShellProps };

function SidebarContent({
  user,
  cashSession,
  visibleNavigation,
  activeItem,
  onLogout,
  logoUrl,
}: {
  user: AuthUser;
  cashSession: CashSession | null;
  visibleNavigation: AppNavigationItem[];
  activeItem: AppNavigationItem | undefined;
  onLogout: () => void;
  logoUrl?: string | null;
}) {
  const roleLabel = user.roles.length > 0 ? user.roles.join(', ') : 'Sin rol';
  const cashLabel = cashSession?.status === 'open' ? `Caja #${cashSession.id} abierta` : 'Sin caja';

  return (
    <div className="flex h-full flex-col bg-slate-900 text-slate-50">
      <div className="flex items-center gap-3 border-b border-slate-700 p-5">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo"
            className="size-10 object-contain rounded bg-white p-1 shrink-0"
          />
        ) : (
          <div className="flex size-10 items-center justify-center rounded-lg bg-teal-600 shrink-0">
            <ShieldCheck className="size-5 text-white" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">Hospital Billing OS</p>
          <p className="truncate text-xs text-slate-400">{cashLabel}</p>
        </div>
      </div>

      <nav
        aria-label="Navegación principal"
        className="flex-1 overflow-y-auto p-4"
      >
        <ul className="flex flex-col gap-1" role="list">
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem?.path === item.path;

            return (
              <li key={item.path}>
                <NavLink
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-l-4 border-teal-500 bg-slate-800 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                  )}
                  to={item.path}
                >
                  <Icon className="size-5 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-slate-700 p-4">
        <div className="flex items-center gap-3 rounded-lg bg-slate-800 p-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-700">
            <User className="size-5 text-slate-300" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user.name}</p>
            <p className="truncate text-xs text-slate-400">{roleLabel}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="mt-2 w-full justify-start text-slate-300 hover:bg-slate-800 hover:text-white"
          size="sm"
          onClick={onLogout}
        >
          <LogOut className="size-4" aria-hidden="true" />
          Cerrar Sesión
        </Button>
        <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3 text-[10px] text-slate-500">
          <span>Sistema LAN Seguro</span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-400">v1.1.0</span>
        </div>
      </div>
    </div>
  );
}

function MobileSidebar({
  open,
  onOpenChange,
  user,
  cashSession,
  visibleNavigation,
  activeItem,
  onLogout,
  logoUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AuthUser;
  cashSession: CashSession | null;
  visibleNavigation: AppNavigationItem[];
  activeItem: AppNavigationItem | undefined;
  onLogout: () => void;
  logoUrl?: string | null;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-0 top-0 z-50 h-full w-72 bg-slate-900 shadow-xl transition-transform duration-200 ease-out data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0"
        >
          <DialogPrimitive.Title className="sr-only">Navegación principal</DialogPrimitive.Title>
          <SidebarContent
            user={user}
            cashSession={cashSession}
            visibleNavigation={visibleNavigation}
            activeItem={activeItem}
            onLogout={onLogout}
            logoUrl={logoUrl}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function AppShell({
  cashSession,
  children,
  onQuickCash,
  onQuickInvoice,
  onLogout,
  status,
  user,
  topbarVariant = 'default',
  logoUrl,
}: AppShellProps) {
  const location = useLocation();
  const { theme, setTheme, isDark } = useTheme();
  const [now, setNow] = useState(() => new Date());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const localTime = new Intl.DateTimeFormat('es-HN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(now);

  const serverOk = !status.toLowerCase().includes('error') && !status.toLowerCase().includes('no se pudo');
  const canCreateInvoices = user.permissions.includes('invoices.create');
  const canViewCash = user.permissions.includes('cash.view');
  const canUseQuickInvoice =
    canCreateInvoices &&
    user.permissions.includes('catalog.view') &&
    canViewCash &&
    user.permissions.includes('payments.create') &&
    user.permissions.includes('receipts.view');
  const showInvoiceAction = canUseQuickInvoice && location.pathname !== '/billing/new';
  const showCashAction =
    canViewCash &&
    (cashSession || user.permissions.includes('cash.open')) &&
    location.pathname !== '/cashbox' &&
    location.pathname !== '/cashbox/';

  const isMinimalTopbar = topbarVariant === 'minimal';

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const getBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(Boolean);
    const crumbs = [{ label: 'Inicio', path: '/' }];
    
    let currentPath = '';
    for (const segment of paths) {
      currentPath += `/${segment}`;
      if (segment === 'billing') {
        crumbs.push({ label: 'Facturación', path: '/billing/new' });
      } else if (segment === 'new') {
        crumbs.push({ label: 'Nueva Factura', path: '/billing/new' });
      } else if (segment === 'invoices') {
        crumbs.push({ label: 'Historial', path: '/invoices' });
      } else if (segment === 'services') {
        crumbs.push({ label: 'Catálogo', path: '/services' });
      } else if (segment === 'cashbox') {
        crumbs.push({ label: 'Caja', path: '/cashbox' });
      } else if (segment === 'reports') {
        crumbs.push({ label: 'Reportes', path: '/reports' });
      } else if (segment === 'settings') {
        crumbs.push({ label: 'Configuración', path: '/settings' });
      } else if (segment === 'admin') {
        crumbs.push({ label: 'Administración', path: '/admin/users' });
      } else if (segment === 'users') {
        crumbs.push({ label: 'Usuarios', path: '/admin/users' });
      } else {
        crumbs.push({ label: segment.charAt(0).toUpperCase() + segment.slice(1), path: currentPath });
      }
    }
    
    // Deduplicate consecutive identical crumbs (like Admin -> Admin or billing -> new)
    const uniqueCrumbs: typeof crumbs = [];
    const seenLabels = new Set<string>();
    for (const crumb of crumbs) {
      if (!seenLabels.has(crumb.label)) {
        uniqueCrumbs.push(crumb);
        seenLabels.add(crumb.label);
      }
    }
    return uniqueCrumbs;
  };

  const crumbs = getBreadcrumbs();

  return (
    <div className="app-shell min-h-screen bg-slate-50 text-slate-900">
      <MobileSidebar
        open={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
        user={user}
        cashSession={cashSession}
        visibleNavigation={visibleNavigation}
        activeItem={activeItem}
        onLogout={onLogout}
        logoUrl={logoUrl}
      />

      <aside className="print-hidden hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <SidebarContent
          user={user}
          cashSession={cashSession}
          visibleNavigation={visibleNavigation}
          activeItem={activeItem}
          onLogout={onLogout}
          logoUrl={logoUrl}
        />
      </aside>

      <div className="flex min-w-0 flex-col lg:ml-64">
        <header className="print-hidden sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 shadow-sm lg:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="size-5" aria-hidden="true" />
          </Button>

          <div className="flex-1 min-w-0">
            {isMinimalTopbar ? null : (
              <nav className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium" aria-label="Breadcrumb">
                {crumbs.map((crumb, idx) => (
                  <div key={crumb.path} className="flex items-center gap-1.5">
                    {idx > 0 && <span className="text-slate-300 dark:text-slate-600">/</span>}
                    {idx === crumbs.length - 1 ? (
                      <span className="text-slate-800 dark:text-slate-200 font-semibold truncate max-w-[120px] sm:max-w-none">{crumb.label}</span>
                    ) : (
                      <NavLink
                        to={crumb.path}
                        className="hover:text-slate-700 dark:hover:text-slate-350 transition-colors truncate max-w-[80px] sm:max-w-none"
                      >
                        {crumb.label}
                      </NavLink>
                    )}
                  </div>
                ))}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isMinimalTopbar && showInvoiceAction && (
              <Button type="button" size="sm" onClick={onQuickInvoice}>
                <Plus className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Nueva Factura</span>
              </Button>
            )}
            {!isMinimalTopbar && showCashAction && (
              <Button type="button" variant="secondary" size="sm" onClick={onQuickCash}>
                <WalletCards className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">{cashSession ? 'Ver Caja' : 'Abrir Caja'}</span>
              </Button>
            )}

            {!isMinimalTopbar && (
              <div
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                  serverOk
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-rose-50 text-rose-700',
                )}
                title={status}
              >
                <span
                  className={cn(
                    'size-2 rounded-full',
                    serverOk ? 'bg-emerald-500' : 'bg-rose-500',
                  )}
                />
                <span className="hidden sm:inline">{serverOk ? 'LAN Operativo' : 'Alerta'}</span>
              </div>
            )}

            {!isMinimalTopbar && (
              <div className="hidden items-center gap-2 text-sm text-slate-600 dark:text-slate-400 md:flex mr-2">
                <span>{localTime}</span>
              </div>
            )}

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-slate-600 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {isDark ? <Sun className="size-5 text-amber-500" /> : <Moon className="size-5" />}
            </Button>

            <DropdownMenuPrimitive.Root>
              <DropdownMenuPrimitive.Trigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="gap-2 px-2 py-1.5 h-auto font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Abrir menu de usuario"
                >
                  <span className="hidden md:inline">{user.name}</span>
                  <ChevronDown className="size-4" aria-hidden="true" />
                </Button>
              </DropdownMenuPrimitive.Trigger>
              <DropdownMenuPrimitive.Portal>
                <DropdownMenuPrimitive.Content
                  align="end"
                  className="z-50 min-w-48 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 shadow-lg"
                  sideOffset={8}
                >
                  <DropdownMenuPrimitive.Item
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-600 dark:text-slate-300 outline-none hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white focus:bg-slate-100 focus:text-slate-900 data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-900"
                    onClick={onLogout}
                  >
                    <LogOut className="size-4" aria-hidden="true" />
                    Cerrar Sesión
                  </DropdownMenuPrimitive.Item>
                </DropdownMenuPrimitive.Content>
              </DropdownMenuPrimitive.Portal>
            </DropdownMenuPrimitive.Root>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <div className="mx-auto flex max-w-7xl flex-col gap-5">{children}</div>
        </main>

        <footer className="print-hidden border-t border-slate-200 bg-white px-6 py-3">
          <p className="mx-auto max-w-7xl text-sm text-slate-500" role="status">
            {status}
          </p>
        </footer>
      </div>
    </div>
  );
}
