import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { type AppNavigationItem } from '../../navigation/appNavigation';

type SidebarNavItemProps = {
  item: AppNavigationItem;
  isActive: boolean;
  onNavigate?: () => void;
};

export function SidebarNavItem({ isActive, item, onNavigate }: SidebarNavItemProps) {
  const Icon = item.icon;

  return (
    <NavLink
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group relative flex min-h-11 items-center gap-3 rounded-md border px-3 py-2.5 text-sm font-medium outline-none transition-colors duration-100',
        'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
        isActive
          ? 'border-sidebar-primary/35 bg-sidebar-accent text-sidebar-accent-foreground'
          : 'border-transparent text-sidebar-foreground/78 hover:border-sidebar-border hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground',
      )}
      to={item.path}
      onClick={onNavigate}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute left-1 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-transparent transition-colors',
          isActive && 'bg-sidebar-primary',
        )}
      />
      <Icon
        data-icon="inline-start"
        className={cn('size-4 shrink-0', isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/62 group-hover:text-sidebar-primary')}
        aria-hidden="true"
      />
      <span className="min-w-0 truncate">{item.label}</span>
    </NavLink>
  );
}

