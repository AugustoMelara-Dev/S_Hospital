import { PanelLeftCloseIcon, PanelLeftOpenIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
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
    <Sidebar
      collapsible="icon"
      data-testid="institutional-rail"
      data-audit-panel="navigation"
      data-collapsed={collapsed ? 'true' : 'false'}
      data-expanded-width="256"
      className="print-hidden"
    >
      <SidebarHeader className="min-h-20 justify-center border-b border-sidebar-border px-3">
        {collapsed ? (
          <span
            role="img"
            aria-label={hospitalName}
            title={hospitalName}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
          >
            <span className="text-xs font-bold tracking-tight" aria-hidden="true">{hospitalInitials(hospitalName)}</span>
          </span>
        ) : (
          <div data-testid="institutional-desktop-identity" className="min-w-0 text-sidebar-accent-foreground [&_.institutional-logo-box]:border-sidebar-border [&_strong]:text-inherit">
            <InstitutionalIdentity hospitalName={hospitalName} location="Tocoa, Colón, Honduras" logoUrl={logoUrl} compact />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent data-scroll-when-needed="true" className="px-2 py-3">
        {sections.length > 0 ? (
          <nav aria-label="Navegación principal">
            {sections.map((section) => (
              <SidebarGroup key={section.id} className="px-0 py-2">
                <SidebarGroupLabel id={`institutional-rail-${section.id}`}>{section.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const active = activeItem?.id === item.id;
                      return (
                        <SidebarMenuItem key={item.id}>
                          <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                            <Link to={item.path} aria-current={active ? 'page' : undefined}>
                              <Icon aria-hidden="true" />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </nav>
        ) : (
          <p className="m-3 rounded-lg bg-sidebar-accent p-3 text-xs text-sidebar-foreground/75">
            No hay módulos de navegación disponibles.
          </p>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={collapsed ? 'Expandir navegación' : 'Reducir navegación'}
          onClick={onToggleCollapsed}
          className={cn('size-11 text-sidebar-foreground', !collapsed && 'self-start')}
        >
          {collapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

function hospitalInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 4).map((part) => part[0]?.toUpperCase()).join('');
}
