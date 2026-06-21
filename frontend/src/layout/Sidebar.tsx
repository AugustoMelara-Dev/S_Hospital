import {
  CircleDollarSign,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { NavLink } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { usePublicBranding } from '../hooks/useFiscalSettings';
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
  const { data: fiscal } = usePublicBranding();
  const hospitalName = displayHospitalName(fiscal?.hospital_name);
  const roleLabel = user.roles.length > 0 ? user.roles.join(', ') : 'Sin rol';
  const cashLabel = cashSession?.status === 'open' ? `Caja #${cashSession.id} abierta` : 'Sin caja abierta';

  return (
    <div className="flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border p-5">
        <div className="flex items-center gap-3">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo institucional"
            width={40}
            height={40}
            className="size-10 shrink-0 rounded border border-border bg-card object-contain p-1"
          />
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded border border-border bg-muted text-primary">
            <ShieldCheck data-icon="inline-start" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Caja LAN
          </p>
          <p className="truncate text-sm font-semibold leading-tight" title={hospitalName}>
            {hospitalName}
          </p>
        </div>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded border border-border bg-muted px-3 py-2 text-xs font-semibold">
          <CircleDollarSign className="size-4 shrink-0 text-secondary" aria-hidden="true" />
          <span className="min-w-0 truncate">{cashLabel}</span>
        </div>
      </div>

      <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem?.path === item.path;

            return (
              <li key={item.path}>
                <NavLink
                  className={cn(
                    'flex min-h-10 items-center gap-3 rounded border border-transparent px-3 py-2 text-sm font-medium text-foreground/75 outline-none transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
                    isActive
                      ? 'border-border bg-muted text-foreground'
                      : 'hover:border-border hover:bg-muted/60 hover:text-foreground',
                  )}
                  to={item.path}
                >
                  <Icon data-icon="inline-start" className="size-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 truncate">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 rounded border border-border bg-muted p-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded border border-border bg-card text-muted-foreground">
            <User data-icon="inline-start" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
          </div>
        </div>
        <div className="mt-3 border-t border-sidebar-border pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
          <span>Operación local</span>
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
          <DialogPrimitive.Title className="sr-only">Navegación principal</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Menú lateral con accesos a los módulos disponibles para el usuario actual.
          </DialogPrimitive.Description>
          <DialogPrimitive.Close asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 z-10 border border-sidebar-border bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80"
              aria-label="Cerrar navegación"
            >
              <X aria-hidden="true" />
            </Button>
          </DialogPrimitive.Close>
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
