import { NavLink } from 'react-router';
import { cn } from '@/lib/cn';
import { NAV_ITEMS, type NavItem } from '@/app/nav';
import { usePermissions } from '@/auth/hooks';
import { BrandMark } from './BrandMark';

function Item({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.to === '/'}
        title={item.label}
        className={({ isActive }) =>
          cn(
            'group relative mx-1.5 flex flex-col items-center gap-1 rounded-[var(--radius-md)] px-1 pt-2 pb-1.5 text-[10.5px] leading-none font-medium',
            'transition-colors duration-[120ms]',
            isActive ? 'bg-brand-soft text-brand' : 'text-ink-3 hover:bg-surface-2 hover:text-ink',
          )
        }
      >
        {({ isActive }) => (
          <>
            <span
              aria-hidden="true"
              className={cn(
                'absolute top-2 bottom-2 -left-1.5 w-[3px] rounded-r-full bg-brand transition-opacity duration-[120ms]',
                isActive ? 'opacity-100' : 'opacity-0',
              )}
            />
            <Icon className="size-5" strokeWidth={isActive ? 2 : 1.75} aria-hidden="true" />
            <span className="max-w-full truncate">{item.short}</span>
          </>
        )}
      </NavLink>
    </li>
  );
}

export function Sidebar() {
  const { can } = usePermissions();
  const visible = NAV_ITEMS.filter((n) => !n.perms || can(n.perms));
  const main = visible.filter((n) => n.group === 'main');
  const admin = visible.filter((n) => n.group === 'admin');
  const help = visible.filter((n) => n.group === 'help');

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-y-0 left-0 z-30 flex w-[var(--sidebar-w)] flex-col border-r border-line bg-surface"
    >
      <div className="flex h-[var(--topbar-h)] shrink-0 items-center justify-center border-b border-line">
        <BrandMark className="size-8" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-2">
        <ul className="flex flex-col gap-0.5">
          {main.map((n) => (
            <Item key={n.to} item={n} />
          ))}
        </ul>
        {admin.length > 0 && (
          <div className="mt-3 flex flex-col gap-0.5" role="group" aria-labelledby="nav-admin-label">
            <div id="nav-admin-label" className="mx-3 mb-1 border-t border-line pt-2.5 text-center text-[9.5px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
              <span className="sr-only">Administración</span>
              <span aria-hidden="true">Admin</span>
            </div>
            <ul className="flex flex-col gap-0.5">
              {admin.map((n) => (
                <Item key={n.to} item={n} />
              ))}
            </ul>
          </div>
        )}
        <ul className="mt-auto flex flex-col gap-0.5 pt-3">
          {help.map((n) => (
            <Item key={n.to} item={n} />
          ))}
        </ul>
      </div>
    </nav>
  );
}
