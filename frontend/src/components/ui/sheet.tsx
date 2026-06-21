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
        <SheetPrimitive.Overlay data-slot="sheet-overlay" data-sheet-overlay className="fixed inset-0 z-50 bg-foreground/55" />
        <SheetPrimitive.Content
          data-slot="sheet-content"
          data-sheet-content
          className="fixed right-0 top-0 z-50 flex h-full w-[calc(100vw-1.5rem)] max-w-lg flex-col overflow-hidden rounded-l-lg border-l border-border bg-card text-card-foreground shadow-xl"
        >
          <header data-slot="sheet-header" className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <SheetPrimitive.Title data-slot="sheet-title" className="truncate text-lg font-semibold">
                {title}
              </SheetPrimitive.Title>
              <SheetPrimitive.Description data-slot="sheet-description" className={description ? 'mt-1 text-sm text-muted-foreground' : 'sr-only'}>
                {description ?? `Panel lateral: ${title}`}
              </SheetPrimitive.Description>
            </div>
            <SheetPrimitive.Close asChild>
              <Button type="button" variant="ghost" size="sm" aria-label="Cerrar panel">
                <X data-icon aria-hidden="true" />
              </Button>
            </SheetPrimitive.Close>
          </header>
          <div data-slot="sheet-body" className="overflow-y-auto p-5">{children}</div>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </SheetPrimitive.Root>
  );
}

Sheet.Header = function SheetHeader({ className, ...props }: { className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="sheet-header" className={cn('flex flex-col gap-1.5', className)} {...props} />;
};

Sheet.Title = function SheetTitle({ className, children, ...props }: { className?: string; children?: ReactNode } & React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 data-slot="sheet-title" className={cn('text-lg font-semibold leading-none', className)} {...props}>{children}</h2>;
};

Sheet.Description = function SheetDescription({ className, ...props }: { className?: string } & React.HTMLAttributes<HTMLParagraphElement>) {
  return <p data-slot="sheet-description" className={cn('text-sm text-muted-foreground', className)} {...props} />;
};
