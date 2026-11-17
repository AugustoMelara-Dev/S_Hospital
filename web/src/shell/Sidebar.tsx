import { NavLink, useNavigate } from 'react-router';
import { ChevronsUpDown, KeyRound, LogOut } from 'lucide-react';
import { cn } from '@/lib/cn';
import { NAV_ITEMS, type NavItem } from '@/app/nav';
import { useAuth, useMe, usePermissions } from '@/auth/hooks';
import { BrandTile } from '@/ui/BrandTile';
import { Kbd } from '@/ui/Kbd';
import { Menu } from '@/ui/Menu';
import { useBranding } from './useBranding';

/**
 * Below 1100px the rail collapses to a 64px icon rail with tooltips.
 * Class names are written out literally (min-[1100px]:…) so Tailwind can see them.
 */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase();
}

/** Tooltip shown only on the collapsed rail (the label is still the link's accessible name). */
function RailTip({ children }: { children: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute top-1/2 left-[calc(100%+10px)] z-50 hidden -translate-y-1/2 rounded-[3px] bg-ink px-2 py-1',
        'text-[12px] leading-4 font-semibold whitespace-nowrap text-surface shadow-pop',
        'group-hover:block group-focus-visible:block',
        'min-[1100px]:!hidden',
      )}
    >
      {children}
    </span>
  );
}

function Item({ item, kbd }: { item: NavItem; kbd?: string }) {
  const Icon = item.icon;
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.to === '/'}
        aria-keyshortcuts={kbd}
        className={({ isActive }) =>
          cn(
            'group relative flex h-9 items-center justify-center gap-3 rounded-[4px] text-[14px] leading-5',
            'min-[1100px]:justify-start min-[1100px]:px-3',
            'transition-colors duration-[120ms] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-rail-ink',
            isActive ? 'bg-ground font-semibold text-ink' : 'font-medium text-rail-ink hover:bg-rail-hover',
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon className={cn('size-4 shrink-0', isActive && 'text-oxide')} strokeWidth={1.6} aria-hidden="true" />
            <span className={cn('sr-only truncate', 'min-[1100px]:not-sr-only min-[1100px]:flex-1')}>{item.label}</span>
            {kbd && (
              <Kbd tone="rail" className={cn('hidden', 'min-[1100px]:inline-flex', isActive && 'border-junta text-ink-2')}>
                {kbd}
              </Kbd>
            )}
            <RailTip>{item.label}</RailTip>
          </>
        )}
      </NavLink>
    </li>
  );
}

function UserBlock() {
  const me = useMe();
  const { logout } = useAuth();
  const navigate = useNavigate();
  return (
    <Menu
      side="top"
      align="start"
      trigger={(p) => (
        <button
          {...p}
          type="button"
          aria-label={`${me.name}, ${me.role.name}. Opciones de cuenta`}
          className={cn(
            'group relative flex h-12 w-full items-center justify-center gap-2.5 rounded-[4px] text-left',
            'min-[1100px]:justify-start min-[1100px]:px-2',
            'hover:bg-rail-hover aria-expanded:bg-rail-hover focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-rail-ink',
          )}
        >
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-rail-line text-[12px] font-semibold text-rail-ink"
          >
            {initials(me.name)}
          </span>
          <span className={cn('hidden min-w-0 flex-1 flex-col', 'min-[1100px]:flex')} aria-hidden="true">
            <span className="truncate text-[13px] leading-4 font-medium text-rail-ink">{me.name}</span>
            <span className="truncate text-[12px] leading-4 text-rail-muted">{me.role.name}</span>
          </span>
          <ChevronsUpDown className={cn('hidden size-3.5 shrink-0 text-rail-muted', 'min-[1100px]:block')} strokeWidth={1.6} aria-hidden="true" />
          <RailTip>{me.name}</RailTip>
        </button>
      )}
      items={[
        {
          type: 'label',
          label: (
            <span className="flex flex-col">
              <span className="font-semibold text-ink">{me.name}</span>
              <span>
                @{me.username} · {me.role.name}
              </span>
            </span>
          ),
        },
        { type: 'separator' },
        { label: 'Cambiar contraseña', icon: <KeyRound />, onSelect: () => navigate('/cambiar-clave') },
        { type: 'separator' },
        { label: 'Salir', icon: <LogOut />, danger: true, onSelect: () => void logout() },
      ]}
    />
  );
}

export function Sidebar() {
  const { can } = usePermissions();
  const { data: branding } = useBranding();
  const visible = NAV_ITEMS.filter((n) => !n.perms || can(n.perms));
  const main = visible.filter((n) => n.group === 'main');
  const admin = visible.filter((n) => n.group === 'admin');
  const help = visible.filter((n) => n.group === 'help');

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex w-[var(--rail-w-collapsed)] flex-col bg-rail text-rail-ink',
        'min-[1100px]:w-[var(--rail-w)]',
      )}
    >
      <div className={cn('flex h-[var(--topbar-h)] shrink-0 items-center justify-center gap-3 border-b border-rail-line', 'min-[1100px]:justify-start min-[1100px]:px-4')}>
        <BrandTile size={32} label="S_Hospital" />
        <div className={cn('hidden min-w-0 flex-col', 'min-[1100px]:flex')}>
          <span className="text-[16px] leading-5 font-bold tracking-[-0.01em]">S_Hospital</span>
          {branding?.hospital_name && <span className="truncate text-[12px] leading-4 text-rail-muted">{branding.hospital_name}</span>}
        </div>
      </div>

      <nav
        aria-label="Navegación principal"
        className={cn('flex min-h-0 flex-1 flex-col px-2 pt-3 pb-2', 'max-[1099px]:overflow-visible min-[1100px]:overflow-y-auto min-[1100px]:px-3')}
      >
        <ul className="flex flex-col gap-0.5">
          {main.map((n) => (
            <Item key={n.to} item={n} />
          ))}
        </ul>
        {admin.length > 0 && (
          <div className="flex flex-col" role="group" aria-labelledby="nav-admin-label">
            <div
              id="nav-admin-label"
              className={cn(
                'mx-2 mt-3 mb-1.5 border-t border-rail-line pt-3 text-[11px] leading-4 font-semibold tracking-[0.06em] text-rail-dim uppercase',
                'min-[1100px]:mx-0 min-[1100px]:mt-0 min-[1100px]:border-t-0 min-[1100px]:px-3 min-[1100px]:pt-4',
              )}
            >
              <span className={cn('sr-only', 'min-[1100px]:not-sr-only')}>Administración</span>
            </div>
            <ul className="flex flex-col gap-0.5">
              {admin.map((n) => (
                <Item key={n.to} item={n} />
              ))}
            </ul>
          </div>
        )}
        <ul className="mt-auto flex flex-col gap-0.5 border-t border-rail-line pt-3">
          {help.map((n) => (
            <Item key={n.to} item={n} kbd={n.to === '/ayuda' ? 'F1' : undefined} />
          ))}
        </ul>
      </nav>
      <div className={cn('shrink-0 px-2 pb-3', 'min-[1100px]:px-3')}>
        <UserBlock />
      </div>
    </aside>
  );
}
