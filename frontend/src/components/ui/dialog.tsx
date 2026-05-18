import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { type ReactNode } from 'react';
import { Button } from './button';
import { cn } from '../../lib/utils';

type DialogProps = {
  children: ReactNode;
  description?: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  size?: 'md' | 'lg' | 'xl' | 'fullscreen';
  title: string;
};

const sizes = {
  md: 'max-w-lg',
  lg: 'max-w-3xl',
  xl: 'max-w-6xl',
  fullscreen: 'max-w-[min(96rem,calc(100vw-2rem))]',
};

export function Dialog({
  children,
  description,
  onOpenChange,
  open,
  size = 'md',
  title,
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay data-dialog-overlay className="fixed inset-0 z-50 bg-slate-950/55" />
        <DialogPrimitive.Content
          data-dialog-content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-2rem)] w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-xl',
            sizes[size],
          )}
        >
          <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="truncate text-lg font-semibold">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="ghost" size="sm" aria-label="Cerrar modal">
                <X aria-hidden="true" />
              </Button>
            </DialogPrimitive.Close>
          </header>
          <div className="overflow-y-auto p-5">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
