import { SidebarNavItem } from './SidebarNavItem';
import { type AppNavigationItem } from '../../navigation/appNavigation';

type SidebarSectionProps = {
  activeItem: AppNavigationItem | undefined;
  collapsed?: boolean;
  items: AppNavigationItem[];
  label: string;
  onNavigate?: () => void;
  sectionId: string;
};

export function SidebarSection({
  activeItem,
  collapsed = false,
  items,
  label,
  onNavigate,
  sectionId,
}: SidebarSectionProps) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby={sectionId} className="flex flex-col gap-1.5">
      {!collapsed ? (
        <h2
          id={sectionId}
          className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/80"
        >
          {label}
        </h2>
      ) : (
        <span id={sectionId} className="sr-only">
          {label}
        </span>
      )}
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.path}>
            <SidebarNavItem
              item={item}
              isActive={activeItem?.path === item.path}
              onNavigate={onNavigate}
              collapsed={collapsed}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
