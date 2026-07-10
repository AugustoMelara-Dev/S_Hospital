import { ChevronsLeft, ChevronsRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui/tooltip';
import { type AuthUser } from '../../lib/api';
import { roleListLabel } from '../../lib/role-labels';
import { cn } from '../../lib/utils';
import { type AppNavigationItem, type NavigationGroup } from '../../navigation/appNavigation';

type ClinicalRailProps = {
  activeItem: AppNavigationItem | undefined;
  collapsed: boolean;
  hospitalName: string;
  logoUrl?: string | null;
  navigation: readonly AppNavigationItem[];
  onToggleCollapsed: () => void;
  user: AuthUser;
};

const groups: ReadonlyArray<{ id: NavigationGroup; label: string }> = [
  { id: 'operations', label: 'Operación' },
  { id: 'administration', label: 'Administración' },
  { id: 'support', label: 'Soporte' },
];

export function ClinicalRail({ activeItem, collapsed, hospitalName, logoUrl, navigation, onToggleCollapsed, user }: ClinicalRailProps) {
  const sections = groups
    .map((group) => ({ ...group, items: navigation.filter((item) => (item.navigationGroup ?? 'operations') === group.id) }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      data-testid="clinical-rail"
      data-collapsed={collapsed ? 'true' : 'false'}
      className={cn(
        'print-hidden hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[12px_0_40px_-28px_rgba(4,20,28,.9)] transition-[width] duration-200 lg:fixed lg:inset-y-0 lg:z-30 lg:flex lg:flex-col',
        collapsed ? 'lg:w-[76px]' : 'lg:w-[264px]',
      )}
    >
      <div className={cn('flex min-h-24 items-center border-b border-sidebar-border', collapsed ? 'justify-center px-2' : 'gap-3 px-5')}>
        {logoUrl ? (
          <img src={logoUrl} alt={hospitalName} title={collapsed ? hospitalName : undefined} className="size-11 rounded-md border border-sidebar-border bg-card object-contain p-1" />
        ) : (
          <span
            role="img"
            aria-label={hospitalName}
            title={collapsed ? hospitalName : undefined}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-lg"
          >
            {collapsed ? (
              <span className="text-[10px] font-bold tracking-tight" aria-hidden="true">{hospitalInitials(hospitalName)}</span>
            ) : (
              <ShieldCheck className="size-5" aria-hidden="true" />
            )}
          </span>
        )}
        {!collapsed ? (
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/70">Consola clínica</p>
            <p data-testid="clinical-desktop-identity" className="mt-1 truncate text-sm font-semibold text-white" title={hospitalName}>{hospitalName}</p>
          </div>
        ) : null}
      </div>

      {sections.length > 0 ? (
        <nav aria-label="Navegación principal" className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
          <TooltipProvider>
            {sections.map((section) => (
              <section key={section.id} aria-labelledby={`clinical-rail-${section.id}`} className="mb-5">
                <h2 id={`clinical-rail-${section.id}`} className={cn('mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/85', collapsed && 'sr-only')}>
                  {section.label}
                </h2>
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = activeItem?.id === item.id;
                    const link = (
                      <Link
                        to={item.path}
                        aria-current={active ? 'page' : undefined}
                        data-active={active ? 'true' : 'false'}
                        className={cn(
                          'group relative flex min-h-11 items-center rounded-lg border border-transparent text-sm font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                          collapsed ? 'justify-center px-2' : 'gap-3 px-3',
                          active
                            ? 'border-sidebar-primary/35 bg-sidebar-primary/25 font-semibold text-white shadow-[inset_3px_0_0_var(--color-sidebar-primary)]'
                            : 'text-sidebar-foreground/80 hover:translate-x-0.5 hover:bg-sidebar-accent hover:text-white',
                        )}
                      >
                        <Icon className="size-5 shrink-0" aria-hidden="true" />
                        {!collapsed ? <span>{item.label}</span> : <span className="sr-only">{item.label}</span>}
                      </Link>
                    );

                    return (
                      <li key={item.id}>
                        {collapsed ? (
                          <Tooltip>
                            <TooltipTrigger asChild>{link}</TooltipTrigger>
                            <TooltipContent side="right">{item.label}</TooltipContent>
                          </Tooltip>
                        ) : link}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </TooltipProvider>
        </nav>
      ) : (
        <p className="m-3 rounded-md border border-sidebar-border bg-sidebar-accent p-3 text-xs text-sidebar-foreground/75">
          No hay módulos de navegación disponibles.
        </p>
      )}

      <div className="mt-auto border-t border-sidebar-border p-3">
        {!collapsed ? (
          <div className="mb-3 min-w-0 rounded-xl border border-sidebar-border bg-sidebar-accent/75 p-3">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-sidebar-foreground/70">{roleListLabel(user.roles)}</p>
          </div>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="!size-11 shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
          aria-label={collapsed ? 'Expandir navegación' : 'Reducir navegación'}
          aria-pressed={collapsed}
          onClick={onToggleCollapsed}
        >
          {collapsed ? <ChevronsRight aria-hidden="true" /> : <ChevronsLeft aria-hidden="true" />}
        </Button>
      </div>
    </aside>
  );
}

function hospitalInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
