import { ChevronRightIcon, LogOutIcon, SearchIcon, SettingsIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { type AuthUser, type CashSession } from '@/lib/api';
import { MoneyText } from '@/design-system/admin/components';
import { parseCents } from '@/lib/moneyCents';
import { useGuardedAction } from '@/hooks/useUnsavedChangesGuard';
import {
  adminRoutePaths,
  getActiveAdminSection,
  getVisibleAdminSections,
  getVisibleAdministrationItems,
  isAdministrationPath,
  resolveAdminLanding,
  type AdminNavigationItem,
} from '@/navigation/adminNavigation';
import { openCommandPalette } from './CommandPalette';
import { SECTION_ICONS, ADMIN_ICONS } from './adminIcons';

const focusRing =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]';
const roleLabels: Record<string, string> = {
  admin: 'Administración',
  cashier: 'Caja',
  supervisor: 'Supervisión',
  auditor: 'Auditoría',
};

export type AdminSidebarProps = {
  user: AuthUser;
  hospitalName: string;
  logoUrl?: string | null;
  onLogout: () => void;
  cashSession: CashSession | null;
  cashSessionLoading?: boolean;
  /** Cierra el cajón móvil al navegar. */
  onNavigate?: () => void;
  className?: string;
};

/**
 * Navegación lateral del panel administrativo: icono + etiqueta, agrupada en
 * Operación (Resumen · Cobrar · Recibos · Caja · Reportes) y Administración
 * secundaria. Estado de caja y usuario compactos al pie. Sustituye la barra
 * superior de la identidad anterior.
 */
export function AdminSidebar({
  cashSession,
  cashSessionLoading = false,
  className,
  hospitalName,
  logoUrl,
  onLogout,
  onNavigate,
  user,
}: AdminSidebarProps) {
  const location = useLocation();
  const sections = getVisibleAdminSections(user.permissions);
  const administrationItems = getVisibleAdministrationItems(user.permissions);
  const activeSection = getActiveAdminSection(location.pathname, user.permissions);
  const administrationActive = isAdministrationPath(location.pathname);
  const homePath = resolveAdminLanding(user);
  const requestGuardedAction = useGuardedAction();

  const cashOpen = cashSession?.status === 'open';
  const canViewCash = user.permissions.includes('cash.view');

  function renderItem(item: AdminNavigationItem, active: boolean, iconKey: 'section' | 'admin') {
    const Icon = (iconKey === 'section' ? SECTION_ICONS : ADMIN_ICONS)[item.id];

    return (
      <li key={item.id}>
        <Link
          to={item.path}
          onClick={onNavigate}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'group flex min-h-11 items-center gap-3 rounded-[var(--ui-radius-control)] px-3 py-2.5 text-[length:var(--ui-text-base)]',
            'transition-[color,background-color] duration-[var(--ui-duration-state)] ease-[var(--ui-ease-out)]',
            active
              ? 'bg-[var(--ui-action)] font-semibold text-[color:var(--ui-action-foreground)] shadow-sm'
              : 'font-medium text-[color:var(--ui-ink-soft)] hover:bg-[var(--ui-surface-alt)] hover:text-[color:var(--ui-ink)]',
            focusRing,
          )}
        >
          {Icon ? (
            <Icon
              aria-hidden="true"
              data-icon
              className={cn(
                'size-[1.125rem] shrink-0',
                active
                  ? 'text-[color:var(--ui-action-foreground)]'
                  : 'text-[color:var(--ui-ink-faint)]',
              )}
            />
          ) : null}
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
        </Link>
      </li>
    );
  }

  return (
    <div
      data-ui-sidebar="true"
      className={cn(
        'flex h-full min-h-0 flex-col gap-5 bg-[var(--ui-action-subtle)] px-3 py-5',
        className,
      )}
    >
      <Link
        to={homePath}
        onClick={onNavigate}
        className={cn(
          'flex items-start gap-3 rounded-[var(--ui-radius-control)] px-2 py-2',
          focusRing,
        )}
        aria-label={`${hospitalName} — inicio`}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            className="size-8 rounded-[var(--ui-radius-control)] object-contain outline outline-1 -outline-offset-1 outline-[oklch(1_0_0/0.1)]"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-[var(--ui-radius-control)] bg-[var(--ui-action)] text-[color:var(--ui-action-foreground)] shadow-sm"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-4.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[length:var(--ui-text-base)] font-semibold leading-snug text-[color:var(--ui-ink)]">
            {hospitalName}
          </span>
          <span className="block text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-ink-soft)]">
            Sistema de caja
          </span>
        </span>
      </Link>

      <button
        type="button"
        data-ui-press
        onClick={openCommandPalette}
        className={cn(
          'flex min-h-10 items-center gap-2 rounded-[var(--ui-radius-control)] border border-[var(--ui-line)] bg-[var(--ui-surface)] px-3 py-2 text-left text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink-soft)] hover:bg-[var(--ui-surface-hover)] hover:text-[color:var(--ui-ink)]',
          focusRing,
        )}
      >
        <SearchIcon aria-hidden="true" data-icon className="size-4 shrink-0" />
        <span className="flex-1">Buscar</span>
        <kbd className="rounded-[var(--ui-radius)] border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] px-1 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-faint)]">
          Ctrl K
        </kbd>
      </button>

      <nav
        aria-label="Navegación principal"
        className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto"
      >
        <ul className="flex flex-col gap-1.5">
          {sections.map((section) =>
            renderItem(section, activeSection?.id === section.id, 'section'),
          )}
        </ul>

        {administrationItems.length > 0 ? (
          /*
           * Una sola entrada de grupo.
           *
           * Antes cada destino administrativo se pintaba en la barra lateral y
           * todos recibían `aria-current="page"` a la vez al estar en cualquier
           * subruta de Administración (V08: «cinco destinos activos a la vez»).
           * Además duplicaba el menú interno de `AdministracionView`.
           *
           * Contrato: el destino actual de administración lo declara la
           * navegación interna de `AdministracionView` (única con
           * `aria-current="page"`); esta entrada solo agrupa y marca actividad
           * con `data-active`, sin reclamar la página.
           */
          <div className="flex flex-col gap-0.5">
            <p className="px-2.5 pb-1 text-[length:var(--ui-text-xs)] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-ink-faint)]">
              Gestión
            </p>
            <ul className="flex flex-col gap-0.5">
              <li>
                <Link
                  to={adminRoutePaths.administracion}
                  onClick={onNavigate}
                  data-active={administrationActive ? 'true' : undefined}
                  className={cn(
                    'group flex min-h-11 items-center gap-3 rounded-[var(--ui-radius-control)] px-3 py-2.5 text-[length:var(--ui-text-base)]',
                    'transition-[color,background-color] duration-[var(--ui-duration-state)] ease-[var(--ui-ease-out)]',
                    administrationActive
                      ? 'bg-[var(--ui-action)] font-semibold text-[color:var(--ui-action-foreground)] shadow-sm'
                      : 'font-medium text-[color:var(--ui-ink-soft)] hover:bg-[var(--ui-surface-alt)] hover:text-[color:var(--ui-ink)]',
                    focusRing,
                  )}
                >
                  <SettingsIcon
                    aria-hidden="true"
                    data-icon
                    className={cn(
                      'size-[1.125rem] shrink-0',
                      administrationActive
                        ? 'text-[color:var(--ui-action-foreground)]'
                        : 'text-[color:var(--ui-ink-faint)]',
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">Administración</span>
                </Link>
              </li>
            </ul>
          </div>
        ) : null}
      </nav>

      {canViewCash ? (
        <Link
          to={adminRoutePaths.caja}
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-2.5 rounded-[var(--ui-radius-control)] border border-[var(--ui-line)] bg-[var(--ui-surface)] px-3 py-3',
            'transition-[background-color] duration-[var(--ui-duration-state)] ease-[var(--ui-ease-out)] hover:bg-[var(--ui-surface-hover)]',
            focusRing,
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'size-2 shrink-0 rounded-full',
              cashOpen ? 'bg-[var(--ui-success)]' : 'bg-[var(--ui-ink-faint)]',
            )}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]">
              {cashSessionLoading
                ? 'Consultando caja…'
                : cashOpen
                  ? cashSession?.cash_register?.name ?? 'Caja abierta'
                  : 'Sin caja abierta'}
            </span>
            <span className="block truncate text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-faint)]">
              {cashOpen && cashSession ? (
                <>
                  Inicial <MoneyText cents={parseCents(cashSession.opening_amount)} />
                </>
              ) : (
                'Abra caja para cobrar'
              )}
            </span>
          </span>
          <ChevronRightIcon aria-hidden="true" data-icon className="size-4 shrink-0 text-[color:var(--ui-ink-faint)]" />
        </Link>
      ) : null}

      <div className="flex items-center gap-2 border-t border-[var(--ui-line)] pt-3">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--ui-surface-alt)] text-[length:var(--ui-text-xs)] font-semibold text-[color:var(--ui-ink-soft)]"
        >
          {user.name.slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]">
            {user.name}
          </span>
          <span className="block truncate text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-faint)]">
            {user.roles.map((role) => roleLabels[role] ?? role).join(', ') || 'Sin rol'}
          </span>
        </span>
        <button
          type="button"
          data-ui-press
          onClick={() => requestGuardedAction(onLogout)}
          aria-label="Salir"
          className={cn(
            'inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--ui-radius-control)] text-[color:var(--ui-ink-soft)] hover:bg-[var(--ui-surface-alt)] hover:text-[color:var(--ui-ink)]',
            focusRing,
          )}
        >
          <LogOutIcon aria-hidden="true" data-icon className="size-4" />
        </button>
      </div>
    </div>
  );
}
