import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Menu, X } from 'lucide-react';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';
import { type AppNavigationItem } from '../../navigation/appNavigation';

type ClinicalMobileNavProps = {
  activeItem: AppNavigationItem | undefined;
  navigation: readonly AppNavigationItem[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function ClinicalMobileNav({ activeItem, navigation, onOpenChange, open }: ClinicalMobileNavProps) {
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const dockItems = navigation.slice(0, 4);
  const remainingItems = navigation.slice(4);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <nav
        aria-label="Accesos móviles"
        className="print-hidden fixed inset-x-0 bottom-0 z-30 flex min-h-16 items-stretch border-t border-border bg-card px-1 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {dockItems.length === 0 ? (
          <p className="flex flex-1 items-center justify-center px-4 text-center text-xs text-muted-foreground">
            No hay destinos móviles disponibles.
          </p>
        ) : null}
        {dockItems.map((item) => {
          const Icon = item.icon;
          const active = activeItem?.id === item.id;
          return (
            <Link
              key={item.id}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              className={cn('flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 py-2 text-[10px] font-medium', active ? 'text-secondary' : 'text-muted-foreground')}
            >
              <Icon className="size-5" aria-hidden="true" />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
        {remainingItems.length > 0 ? (
          <DialogPrimitive.Trigger asChild>
            <button ref={moreButtonRef} type="button" className="flex min-w-14 flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-[10px] font-medium text-muted-foreground" aria-label="Más destinos">
              <Menu className="size-5" aria-hidden="true" />
              <span>Más</span>
            </button>
          </DialogPrimitive.Trigger>
        ) : null}
      </nav>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/55" />
        <DialogPrimitive.Content
          className="fixed inset-x-0 bottom-0 z-50 max-h-[75dvh] rounded-t-xl border border-border bg-card p-4 text-card-foreground shadow-xl outline-none transition-transform data-[state=closed]:translate-y-full data-[state=open]:translate-y-0 motion-reduce:transition-none"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            moreButtonRef.current?.focus();
          }}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="text-lg font-semibold">Más destinos</DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-muted-foreground">Pantallas permitidas para su usuario.</DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Cerrar destinos">
                <X aria-hidden="true" />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {remainingItems.map((item) => {
              const Icon = item.icon;
              const active = activeItem?.id === item.id;
              return (
                <li key={item.id}>
                  <Link
                    to={item.path}
                    onClick={() => onOpenChange(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn('flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 text-sm font-medium', active ? 'border-secondary bg-secondary/10 text-secondary' : 'border-border')}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
