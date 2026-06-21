import { SidebarNavItem } from './SidebarNavItem';
import { type AppNavigationItem } from '../../navigation/appNavigation';

type SidebarSectionProps = {
  activeItem: AppNavigationItem | undefined;
  items: AppNavigationItem[];
  label: string;
  onNavigate?: () => void;
  sectionId: string;
};

export function SidebarSection({ activeItem, items, label, onNavigate, sectionId }: SidebarSectionProps) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby={sectionId} className="flex flex-col gap-1.5">
      <h2
        id={sectionId}
        className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/48"
      >
        {label}
      </h2>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.path}>
            <SidebarNavItem
              item={item}
              isActive={activeItem?.path === item.path}
              onNavigate={onNavigate}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
