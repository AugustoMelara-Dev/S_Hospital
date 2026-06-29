import { type AuthUser, type CashSession } from '../lib/api';
import { type AppNavigationItem } from '../navigation/appNavigation';
import { SidebarSection } from './components/SidebarSection';
import { Banknote, ChevronsLeft, ChevronsRight, ShieldCheck } from 'lucide-react';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { Button } from '../components/ui/button';
import { usePublicBranding } from '../hooks/useFiscalSettings';
import { displayHospitalName } from '../lib/hospital-name';
import { cn } from '../lib/utils';

interface SidebarProps {
  user: AuthUser;
  cashSession: CashSession | null;
  visibleNavigation: AppNavigationItem[];
  activeItem: AppNavigationItem | undefined;
  logoUrl?: string | null;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
}

export function SidebarContent({
  user,
  cashSession,
  visibleNavigation,
  activeItem,
  logoUrl,
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
}: SidebarProps) {
  const { data: fiscal } = usePublicBranding();
  const hospitalName = displayHospitalName(fiscal?.hospital_name);
  const roleLabel = user.roles.length > 0 ? user.roles.join(', ') : 'Sin rol';
  const cashIsOpen = cashSession?.status === 'open';
  const cashLabel = cashIsOpen ? `Caja #${cashSession.id}` : 'Caja cerrada';
  const groupedNavigation = groupNavigation(visibleNavigation);

  return (
    <div
      className={cn(
        'flex h-full flex-col bg-sidebar text-sidebar-foreground',
        collapsed ? 'border-r border-sidebar-border' : 'border-r border-sidebar-border',
      )}
    >
      <div
        className={cn(
          'flex items-center border-b border-sidebar-border p-3',
          collapsed ? 'justify-center' : 'justify-between gap-2 p-4',
        )}
      >
        {logoUrl && !collapsed ? (
          <img
            src={logoUrl}
            alt="Logo institucional"
            width={40}
            height={40}
            className="size-11 shrink-0 rounded-md border border-sidebar-border bg-card object-contain p-1"
          />
        ) : (
          <div
            className={cn(
              'flex shrink-0 items-center justify-center rounded-md border border-sidebar-primary/30 bg-sidebar text-sidebar-primary shadow-sm',
              collapsed ? 'size-9' : 'size-11',
            )}
            aria-hidden="true"
          >
            <ShieldCheck className={collapsed ? 'size-4' : 'size-5'} />
          </div>
        )}
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/80">
              Sistema hospitalario local
            </p>
            <p className="truncate text-sm font-semibold leading-tight text-sidebar-foreground" title={hospitalName}>
              {hospitalName}
            </p>
          </div>
        ) : null}
        {onToggleCollapsed ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-pressed={collapsed}
            aria-label={collapsed ? 'Expandir menu lateral' : 'Colapsar menu lateral'}
            onClick={onToggleCollapsed}
          >
            {collapsed ? <ChevronsRight className="size-4" aria-hidden="true" /> : <ChevronsLeft className="size-4" aria-hidden="true" />}
          </Button>
        ) : null}
      </div>

      {!collapsed ? (
        <div
          data-slot="sidebar-cash-status"
          className={cn(
            'mx-3 mb-3 mt-1 flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium',
            cashIsOpen
              ? 'border-success/40 bg-success/10 text-success-foreground'
              : 'border-warning/40 bg-warning/10 text-warning-foreground',
          )}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-sidebar-border bg-sidebar text-sidebar-primary">
            <Banknote className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.14em] text-current/80">Caja</p>
            <p className="truncate font-mono text-sm font-semibold tabular-nums">{cashLabel}</p>
          </div>
        </div>
      ) : null}

      <nav aria-label="Navegación principal" className="min-h-0 flex-1">
        <ScrollArea className="h-full">
          <div className={cn('flex flex-col gap-4 py-3', collapsed ? 'px-1' : 'px-3')}>
            {groupedNavigation.length > 0 ? (
              groupedNavigation.map((section) => (
                <SidebarSection
                  key={section.group}
                  label={section.label}
                  sectionId={`sidebar-section-${section.group}`}
                  activeItem={activeItem}
                  items={section.items}
                  onNavigate={onNavigate}
                  collapsed={collapsed}
                />
              ))
            ) : collapsed ? null : (
              <p className="rounded-md border border-sidebar-border bg-sidebar-accent px-3 py-2 text-xs text-sidebar-foreground/70">
                No hay módulos de navegación disponibles.
              </p>
            )}
          </div>
        </ScrollArea>
      </nav>

      {!collapsed ? (
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3 rounded-md border border-sidebar-border bg-sidebar-accent/80 p-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-sidebar-border bg-sidebar text-sidebar-foreground/70" aria-hidden="true">
              <span className="text-sm font-semibold uppercase">{(user.name?.[0] ?? '?').toString()}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight text-sidebar-foreground">{user.name}</p>
              <p className="truncate text-xs text-sidebar-foreground/78">{roleLabel}</p>
            </div>
          </div>
          <Separator className="my-3 bg-sidebar-border" />
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/80">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
            <span>Operacion LAN</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function groupNavigation(items: AppNavigationItem[]) {
  const groups = [
    { group: 'operations', label: 'Operación' },
    { group: 'administration', label: 'Administración' },
    { group: 'support', label: 'Soporte' },
  ] as const;

  return groups
    .map((group) => ({
      ...group,
      items: items.filter((item) => (item.navigationGroup ?? 'operations') === group.group),
    }))
    .filter((group) => group.items.length > 0);
}
