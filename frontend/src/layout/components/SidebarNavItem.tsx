import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { type AppNavigationItem } from '../../navigation/appNavigation';

type SidebarNavItemProps = {
  collapsed?: boolean;
  isActive: boolean;
  item: AppNavigationItem;
  onNavigate?: () => void;
};

export function SidebarNavItem({ collapsed = false, isActive, item, onNavigate }: SidebarNavItemProps) {
  const Icon = item.icon;
  const labelNode = collapsed ? (
    <span className="sr-only">{item.label}</span>
  ) : (
    <span className="min-w-0 truncate">{item.label}</span>
  );

  return (
    <NavLink
      aria-current={isActive ? 'page' : undefined}
      data-active={isActive ? 'true' : 'false'}
      data-slot="sidebar-nav-item"
      title={collapsed ? item.label : undefined}
      className={cn(
        'group relative flex min-h-11 items-center gap-3 border outline-none transition-colors duration-100',
        collapsed ? 'justify-center px-0' : 'px-3 py-2.5',
        'text-sm font-medium',
        'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
        isActive
          ? 'border-sidebar-primary/60 bg-sidebar-primary/10 text-sidebar-accent-foreground'
          : 'border-transparent text-sidebar-foreground/78 hover:border-sidebar-border hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground',
      )}
      to={item.path}
      onClick={onNavigate}
    >
      {!collapsed ? (
        <span
          aria-hidden="true"
          className={cn(
            'absolute left-1 top-1/2 h-7 w-1 -translate-y-1/2 bg-transparent transition-colors',
            isActive && 'bg-sidebar-primary',
          )}
        />
      ) : null}
      <Icon
        data-icon="inline-start"
        className={cn('size-5 shrink-0', isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/62 group-hover:text-sidebar-primary')}
        aria-hidden="true"
      />
      {labelNode}
      {isActive && !collapsed ? <span className="ml-auto h-2 w-2 shrink-0 bg-sidebar-primary" aria-hidden="true" /> : null}
    </NavLink>
  );
}
