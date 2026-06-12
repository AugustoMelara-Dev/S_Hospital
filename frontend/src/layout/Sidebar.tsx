import {
  ShieldCheck,
  User,
} from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { NavLink } from 'react-router-dom';
import { useFiscalSettings } from '../hooks/useFiscalSettings';
import { type AuthUser, type CashSession } from '../lib/api';
import { displayHospitalName } from '../lib/hospital-name';
import { cn } from '../lib/utils';
import { type AppNavigationItem } from '../navigation/appNavigation';

interface SidebarProps {
  user: AuthUser;
  cashSession: CashSession | null;
  visibleNavigation: AppNavigationItem[];
  activeItem: AppNavigationItem | undefined;
  logoUrl?: string | null;
}

export function SidebarContent({
  user,
  cashSession,
  visibleNavigation,
  activeItem,
  logoUrl,
}: SidebarProps) {
  const { data: fiscal } = useFiscalSettings();
  const hospitalName = displayHospitalName(fiscal?.hospital_name);
  const roleLabel = user.roles.length > 0 ? user.roles.join(', ') : 'Sin rol';
  const cashLabel = cashSession?.status === 'open' ? `Caja #${cashSession.id} abierta` : 'Sin caja abierta';

  return (
    <div className="flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 border-b border-sidebar-border p-5">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="size-10 shrink-0 rounded-md bg-card object-contain p-1" />
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <ShieldCheck data-icon="inline-start" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" title={hospitalName}>
            {hospitalName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{cashLabel}</p>
        </div>
      </div>

      <nav aria-label="Navegacion principal" className="flex-1 overflow-y-auto p-3">
        <ul className="flex flex-col gap-1">
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem?.path === item.path;

            return (
              <li key={item.path}>
                <NavLink
                  className={cn(
                    'flex min-h-10 items-center gap-3 rounded-md border border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors',
                    isActive
                      ? 'border-border bg-muted text-foreground shadow-sm'
                      : 'hover:border-border hover:bg-muted/70 hover:text-foreground',
                  )}
                  to={item.path}
                >
                  <Icon data-icon="inline-start" aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 rounded-md border border-border bg-muted/50 p-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground">
            <User data-icon="inline-start" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
          </div>
        </div>
        <div className="mt-4 border-t border-border pt-3 text-[10px] text-muted-foreground">
          <span>Operacion en red local</span>
        </div>
      </div>
    </div>
  );
}

interface MobileSidebarProps extends SidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileSidebar({
  open,
  onOpenChange,
  user,
  cashSession,
  visibleNavigation,
  activeItem,
  logoUrl,
}: MobileSidebarProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/45 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-0 top-0 z-50 h-full w-72 bg-sidebar shadow-lg transition-transform duration-200 ease-out data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0">
          <DialogPrimitive.Title className="sr-only">Navegacion principal</DialogPrimitive.Title>
          <SidebarContent
            user={user}
            cashSession={cashSession}
            visibleNavigation={visibleNavigation}
            activeItem={activeItem}
            logoUrl={logoUrl}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
