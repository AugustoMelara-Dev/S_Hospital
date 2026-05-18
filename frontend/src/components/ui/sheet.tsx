import * as SheetPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { type ReactNode } from 'react';
import { Button } from './button';
import { cn } from '../../lib/utils';

type SheetProps = {
  children: ReactNode;
  description?: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
};

export function Sheet({ children, description, onOpenChange, open, title }: SheetProps) {
  return (
    <SheetPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Overlay data-sheet-overlay className="fixed inset-0 z-50 bg-slate-950/55" />
        <SheetPrimitive.Content
          data-sheet-content
          className="fixed right-0 top-0 z-50 flex h-full w-[calc(100vw-1.5rem)] max-w-lg flex-col overflow-hidden rounded-l-lg border-l border-border bg-card text-card-foreground shadow-xl"
        >
          <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <SheetPrimitive.Title className="truncate text-lg font-semibold">
                {title}
              </SheetPrimitive.Title>
              {description ? (
                <SheetPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                  {description}
                </SheetPrimitive.Description>
              ) : null}
            </div>
            <SheetPrimitive.Close asChild>
              <Button type="button" variant="ghost" size="sm" aria-label="Cerrar panel">
                <X aria-hidden="true" />
              </Button>
            </SheetPrimitive.Close>
          </header>
          <div className="overflow-y-auto p-5">{children}</div>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </SheetPrimitive.Root>
  );
}

Sheet.Header = function SheetHeader({ className, ...props }: { className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5', className)} {...props} />;
};

Sheet.Title = function SheetTitle({ className, ...props }: { className?: string } & React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold leading-none', className)} {...props} />;
};

Sheet.Description = function SheetDescription({ className, ...props }: { className?: string } & React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
};