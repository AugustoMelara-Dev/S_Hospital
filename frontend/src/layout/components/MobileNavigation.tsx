import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { type RefObject } from 'react';
import { Button } from '../../components/ui/button';
import { type AuthUser, type CashSession } from '../../lib/api';
import { type AppNavigationItem } from '../../navigation/appNavigation';
import { SidebarContent } from '../Sidebar';

type MobileNavigationProps = {
  activeItem: AppNavigationItem | undefined;
  cashSession: CashSession | null;
  logoUrl?: string | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  user: AuthUser;
  visibleNavigation: AppNavigationItem[];
};

export function MobileNavigation({
  activeItem,
  cashSession,
  logoUrl,
  onOpenChange,
  open,
  triggerRef,
  user,
  visibleNavigation,
}: MobileNavigationProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-slot="mobile-navigation-overlay"
          className="fixed inset-0 z-50 bg-foreground/45 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          data-slot="mobile-navigation-content"
          className="fixed left-0 top-0 z-50 h-full w-[min(20rem,calc(100vw-1rem))] bg-sidebar text-sidebar-foreground shadow-xl outline-none transition-transform duration-200 ease-out data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0 motion-reduce:transition-none"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
        >
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
              <X data-icon aria-hidden="true" />
            </Button>
          </DialogPrimitive.Close>
          <SidebarContent
            user={user}
            cashSession={cashSession}
            visibleNavigation={visibleNavigation}
            activeItem={activeItem}
            logoUrl={logoUrl}
            onNavigate={() => onOpenChange(false)}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

