import { MenuIcon } from 'lucide-react';
import { type RefObject, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '../../lib/utils';
import { type AppNavigationItem } from '../../navigation/appNavigation';

type InstitutionalMobileNavProps = {
  activeItem: AppNavigationItem | undefined;
  navigation: readonly AppNavigationItem[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  triggerRef?: RefObject<HTMLButtonElement | null>;
};

export function InstitutionalMobileNav({ activeItem, navigation, onOpenChange, open, triggerRef }: InstitutionalMobileNavProps) {
  const dockItems = navigation.slice(0, 4);
  const remainingItems = navigation.slice(4);
  const wasOpen = useRef(open);

  useEffect(() => {
    if (wasOpen.current && !open) window.setTimeout(() => triggerRef?.current?.focus(), 0);
    wasOpen.current = open;
  }, [open, triggerRef]);

  return (
    <>
      <nav aria-label="Accesos móviles" className="print-hidden fixed inset-x-0 bottom-0 z-30 flex min-h-20 items-stretch border-t border-sidebar-border bg-sidebar px-1 pb-4 text-sidebar-foreground lg:hidden">
        {dockItems.length === 0 ? (
          <p className="flex flex-1 items-center justify-center px-4 text-center text-xs text-sidebar-foreground/70">No hay destinos móviles disponibles.</p>
        ) : null}
        {dockItems.map((item) => {
          const Icon = item.icon;
          const active = activeItem?.id === item.id;
          return (
            <Link
              key={item.id}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&_svg]:size-5',
                active ? 'bg-sidebar-accent text-sidebar-primary' : 'text-sidebar-foreground/65',
              )}
            >
              <Icon aria-hidden="true" />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
        {remainingItems.length > 0 ? (
          <Button
            ref={triggerRef}
            type="button"
            variant="ghost"
            className="h-auto min-h-11 min-w-14 flex-1 flex-col gap-1 rounded-lg px-2 py-2 text-xs text-sidebar-foreground/65 focus-visible:ring-inset"
            aria-label="Más destinos"
            onClick={() => onOpenChange(true)}
          >
            <MenuIcon aria-hidden="true" />
            <span>Más</span>
          </Button>
        ) : null}
      </nav>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="mobile-destinations-sheet">
          <SheetHeader>
            <SheetTitle>Más destinos</SheetTitle>
            <SheetDescription>Pantallas permitidas para su usuario.</SheetDescription>
          </SheetHeader>
          <ul className="grid gap-2 overflow-y-auto px-4 pb-4 sm:grid-cols-2">
            {remainingItems.map((item) => {
              const Icon = item.icon;
              const active = activeItem?.id === item.id;
              return (
                <li key={item.id}>
                  <Button asChild variant={active ? 'secondary' : 'ghost'} className="h-11 w-full justify-start">
                    <Link to={item.path} onClick={() => onOpenChange(false)} aria-current={active ? 'page' : undefined}>
                      <Icon aria-hidden="true" />
                      {item.label}
                    </Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
