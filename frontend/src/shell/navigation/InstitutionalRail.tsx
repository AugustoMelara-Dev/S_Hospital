import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { Button, Tooltip } from 'antd';
import { cn } from '../../lib/utils';
import { type AppNavigationItem, type NavigationGroup } from '../../navigation/appNavigation';
import { InstitutionalIdentity } from '../../design-system/components/InstitutionalIdentity';

type InstitutionalRailProps = {
  activeItem: AppNavigationItem | undefined;
  collapsed: boolean;
  hospitalName: string;
  logoUrl?: string | null;
  navigation: readonly AppNavigationItem[];
  onToggleCollapsed: () => void;
};

const groups: ReadonlyArray<{ id: NavigationGroup; label: string }> = [
  { id: 'operations', label: 'Operaciones y control' },
  { id: 'administration', label: 'Administración del sistema' },
  { id: 'support', label: 'Asistencia' },
];

export function InstitutionalRail({ activeItem, collapsed, hospitalName, logoUrl, navigation, onToggleCollapsed }: InstitutionalRailProps) {
  const sections = groups
    .map((group) => ({ ...group, items: navigation.filter((item) => (item.navigationGroup ?? 'operations') === group.id) }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      data-testid="institutional-rail"
      data-audit-panel="navigation"
      data-collapsed={collapsed ? 'true' : 'false'}
      data-expanded-width="224"
      className={cn(
        'print-hidden hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:fixed lg:inset-y-0 lg:z-30 lg:flex lg:flex-col',
        collapsed ? 'lg:w-20' : 'lg:w-56',
      )}
    >
      <div className={cn('flex min-h-20 items-center border-b border-sidebar-border', collapsed ? 'justify-center px-2' : 'px-3')}>
        {collapsed ? (
          <span
            role="img"
            aria-label={hospitalName}
            title={hospitalName}
            className="flex size-11 shrink-0 items-center justify-center border border-sidebar-border bg-sidebar-primary text-sidebar-primary-foreground"
          >
            <span className="text-xs font-bold tracking-tight" aria-hidden="true">{hospitalInitials(hospitalName)}</span>
          </span>
        ) : (
          <div data-testid="institutional-desktop-identity" className="min-w-0 text-sidebar-accent-foreground [&_.institutional-logo-box]:border-sidebar-border [&_strong]:text-inherit">
            <InstitutionalIdentity
              hospitalName={hospitalName}
              location="Tocoa, Colón, Honduras"
              logoUrl={logoUrl}
              compact
            />
          </div>
        )}
      </div>

      {sections.length > 0 ? (
        <nav aria-label="Navegación principal" data-scroll-when-needed="true" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3 [scrollbar-gutter:stable]">
          {sections.map((section) => (
            <section key={section.id} aria-labelledby={`institutional-rail-${section.id}`} className="mb-5">
              <h2 id={`institutional-rail-${section.id}`} className={cn('mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/85', collapsed && 'sr-only')}>
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
                        'group relative flex min-h-11 items-center border border-transparent text-sm font-medium outline-none transition-all',
                        collapsed ? 'justify-center px-2' : 'gap-3 px-3',
                        active
                          ? 'border-sidebar-primary/30 bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground/80 hover:translate-x-0.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      )}
                    >
                      <Icon className="text-lg shrink-0" aria-hidden="true" />
                      {!collapsed ? <span>{item.label}</span> : <span className="sr-only">{item.label}</span>}
                    </Link>
                  );

                  return (
                    <li key={item.id}>
                      {collapsed ? (
                        <Tooltip title={item.label} placement="right" mouseEnterDelay={0.4}>
                          {link}
                        </Tooltip>
                      ) : link}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>
      ) : (
        <p className="m-3 border border-sidebar-border bg-sidebar-accent p-3 text-xs text-sidebar-foreground/75">
          No hay módulos de navegación disponibles.
        </p>
      )}

      <div className="mt-auto border-t border-sidebar-border p-3">
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined className="text-lg text-sidebar-accent-foreground" /> : <MenuFoldOutlined className="text-lg text-sidebar-accent-foreground" />}
          className="!size-11 shrink-0 hover:bg-sidebar-accent text-sidebar-foreground"
          aria-label={collapsed ? 'Expandir navegación' : 'Reducir navegación'}
          onClick={onToggleCollapsed}
        />
      </div>
    </aside>
  );
}

function hospitalInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
