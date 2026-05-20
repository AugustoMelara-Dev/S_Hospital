import {
  ChevronDown,
  Menu,
  Moon,
  Plus,
  Sun,
  WalletCards,
  LogOut,
  Clock,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { type AuthUser, type CashSession } from '../lib/api';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { useTheme } from '../hooks/useTheme';
import { useClock } from '../hooks/useClock';
import { useServerStatus } from '../hooks/useServerStatus';
import { useFiscalSettings } from '../hooks/useFiscalSettings';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';

interface TopbarProps {
  user: AuthUser;
  cashSession: CashSession | null;
  status: string;
  isMinimalTopbar?: boolean;
  crumbs: Array<{ label: string; path: string }>;
  showInvoiceAction: boolean;
  showCashAction: boolean;
  onOpenMobileMenu: () => void;
  onQuickInvoice: () => void;
  onQuickCash: () => void;
  onLogout: () => void;
}

export function Topbar({
  user,
  cashSession,
  status,
  isMinimalTopbar = false,
  crumbs,
  showInvoiceAction,
  showCashAction,
  onOpenMobileMenu,
  onQuickInvoice,
  onQuickCash,
  onLogout,
}: TopbarProps) {
  const { setTheme, isDark } = useTheme();
  const { timeString, dateString } = useClock();
  const { isOnline, lastCheck } = useServerStatus();
  const { data: fiscal } = useFiscalSettings();

  const hospitalName = fiscal?.hospital_name || 'Hospital Billing OS';

  return (
    <header className="print-hidden sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm px-4 shadow-sm lg:px-6">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="lg:hidden shrink-0 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        onClick={onOpenMobileMenu}
        aria-label="Abrir menú"
      >
        <Menu className="size-5" aria-hidden="true" />
      </Button>

      {/* Hospital Title (Visible on larger screens) */}
      <div className="hidden md:flex items-center gap-2 border-r border-slate-200 dark:border-slate-800 pr-4 shrink-0">
        <span className="text-sm font-bold text-slate-800 dark:text-white truncate max-w-[200px]" title={hospitalName}>
          {hospitalName}
        </span>
      </div>

      {/* Contextual Navigation (Breadcrumbs) */}
      <div className="flex-1 min-w-0">
        {!isMinimalTopbar && (
          <nav className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium" aria-label="Breadcrumb">
            {crumbs.map((crumb, idx) => (
              <div key={`${crumb.path}-${idx}`} className="flex items-center gap-1.5">
                {idx > 0 && <span className="text-slate-300 dark:text-slate-600">/</span>}
                {idx === crumbs.length - 1 ? (
                  <span className="text-slate-800 dark:text-slate-200 font-semibold truncate max-w-[120px] sm:max-w-none">
                    {crumb.label}
                  </span>
                ) : (
                  <NavLink
                    to={crumb.path}
                    className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors truncate max-w-[80px] sm:max-w-none"
                  >
                    {crumb.label}
                  </NavLink>
                )}
              </div>
            ))}
          </nav>
        )}
      </div>

      {/* Right Side Actions & Badges */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Quick Actions */}
        {!isMinimalTopbar && showInvoiceAction && (
          <Button type="button" size="sm" onClick={onQuickInvoice} className="shadow-sm">
            <Plus className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Nueva Factura</span>
          </Button>
        )}
        {!isMinimalTopbar && showCashAction && (
          <Button type="button" variant="secondary" size="sm" onClick={onQuickCash} className="shadow-sm">
            <WalletCards className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">{cashSession ? 'Ver Caja' : 'Abrir Caja'}</span>
          </Button>
        )}

        {/* Server & Network LAN Status Badge */}
        {!isMinimalTopbar && (
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm transition-all duration-300',
              isOnline
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50'
                : 'bg-rose-50 text-rose-700 border border-rose-200/50 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50 animate-pulse',
            )}
            title={isOnline ? `Conexión LAN estable. Último check: ${lastCheck?.toLocaleTimeString()}` : `Desconectado del servidor local. Estado: ${status}`}
          >
            {isOnline ? (
              <Wifi className="size-3.5 text-emerald-500 dark:text-emerald-400" />
            ) : (
              <WifiOff className="size-3.5 text-rose-500 dark:text-rose-400" />
            )}
            <span className="hidden sm:inline">{isOnline ? 'LAN Conectado' : 'Sin Conexión'}</span>
          </div>
        )}

        {/* Live Clock */}
        {!isMinimalTopbar && (
          <div className="hidden items-center gap-2 text-xs font-mono font-medium text-slate-500 dark:text-slate-400 md:flex border-l border-slate-200 dark:border-slate-800 pl-3">
            <Clock className="size-3.5 text-slate-400" />
            <span title={`Fecha local: ${dateString}`}>{timeString}</span>
          </div>
        )}

        {/* Dark Mode Toggle */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-slate-650 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {isDark ? <Sun className="size-5 text-amber-500" /> : <Moon className="size-5" />}
        </Button>

        {/* User Dropdown */}
        <DropdownMenuPrimitive.Root>
          <DropdownMenuPrimitive.Trigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="gap-2 px-2 py-1.5 h-auto font-medium text-slate-605 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Abrir menu de usuario"
            >
              <div className="size-7 rounded-full bg-slate-150 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-secondary">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="hidden lg:inline text-xs">{user.name}</span>
              <ChevronDown className="size-4 text-slate-400" aria-hidden="true" />
            </Button>
          </DropdownMenuPrimitive.Trigger>
          <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.Content
              align="end"
              className="z-50 min-w-48 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
              sideOffset={8}
            >
              <div className="px-3 py-1.5 text-xs border-b border-slate-100 dark:border-slate-850 mb-1">
                <p className="font-semibold text-slate-800 dark:text-slate-200">{user.name}</p>
                <p className="text-slate-400 truncate">@{user.username}</p>
              </div>
              <DropdownMenuPrimitive.Item
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-xs text-rose-600 dark:text-rose-400 outline-none hover:bg-rose-50 dark:hover:bg-rose-950/20 focus:bg-rose-50 dark:focus:bg-rose-950/20 font-medium"
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
  );
}
