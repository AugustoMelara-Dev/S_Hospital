import {
  Archive,
  Boxes,
  ClipboardList,
  FileClock,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  User,
  WalletCards,
  Info,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { type AuthUser, type CashSession } from '../lib/api';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { useFiscalSettings } from '../hooks/useFiscalSettings';
import * as DialogPrimitive from '@radix-ui/react-dialog';

export type AppNavigationItem = {
  label: string;
  path: string;
  permission?: string | string[];
  icon: typeof LayoutDashboard;
};

export const appNavigation: AppNavigationItem[] = [
  { label: 'Inicio', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Nueva Factura', path: '/billing/new', permission: 'invoices.create', icon: WalletCards },
  { label: 'Caja', path: '/cashbox', permission: 'cash.view', icon: WalletCards },
  { label: 'Catálogo', path: '/catalog', permission: 'catalog.view', icon: Boxes },
  { label: 'Historial', path: '/invoices', permission: 'invoices.view', icon: FileClock },
  { label: 'Reportes', path: '/reports', permission: ['reports.view', 'reports.managerial.view', 'reports.cash_session.view'], icon: ClipboardList },
  { label: 'Backups', path: '/backups', permission: 'backups.view', icon: Archive },
  { label: 'Configuración Fiscal', path: '/settings/fiscal', permission: 'settings.fiscal.view', icon: Settings },
  { label: 'Usuarios', path: '/admin/users', permission: 'users.view', icon: User },
  { label: 'Acerca de', path: '/about', icon: Info },
];

interface SidebarProps {
  user: AuthUser;
  cashSession: CashSession | null;
  visibleNavigation: AppNavigationItem[];
  activeItem: AppNavigationItem | undefined;
  onLogout: () => void;
  logoUrl?: string | null;
}

export function SidebarContent({
  user,
  cashSession,
  visibleNavigation,
  activeItem,
  onLogout,
  logoUrl,
}: SidebarProps) {
  const { data: fiscal } = useFiscalSettings();
  const hospitalName = fiscal?.hospital_name || 'Hospital Billing OS';

  const roleLabel = user.roles.length > 0 ? user.roles.join(', ') : 'Sin rol';
  const cashLabel = cashSession?.status === 'open' ? `Caja #${cashSession.id} abierta` : 'Sin caja';

  return (
    <div className="flex h-full flex-col bg-slate-900 text-slate-50 border-r border-slate-800">
      <div className="flex items-center gap-3 border-b border-slate-800 p-5">
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
          <p className="truncate text-sm font-bold text-white" title={hospitalName}>{hospitalName}</p>
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
                      ? 'border-l-4 border-secondary bg-slate-800 text-white font-semibold shadow-inner'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white',
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

      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center gap-3 rounded-lg bg-slate-800 p-3 shadow-inner">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-700">
            <User className="size-5 text-slate-350" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user.name}</p>
            <p className="truncate text-xs text-slate-450">{roleLabel}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="mt-2 w-full justify-start text-slate-400 hover:bg-slate-850 hover:text-white"
          size="sm"
          onClick={onLogout}
        >
          <LogOut className="size-4" aria-hidden="true" />
          Cerrar Sesión
        </Button>
        <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3 text-[10px] text-slate-500">
          <span>Sistema LAN Seguro</span>
          <span className="rounded bg-slate-850 px-1.5 py-0.5 font-mono text-slate-400">v1.1.0</span>
        </div>
      </div>
    </div>
  );
}

interface MobileSidebarProps extends SidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileSidebar({
  open,
  onOpenChange,
  user,
  cashSession,
  visibleNavigation,
  activeItem,
  onLogout,
  logoUrl,
}: MobileSidebarProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-0 top-0 z-50 h-full w-72 bg-slate-900 shadow-2xl transition-transform duration-250 ease-out data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0"
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
