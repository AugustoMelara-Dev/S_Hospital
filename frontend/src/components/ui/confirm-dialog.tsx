import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { type ReactNode } from 'react';
import { Button } from './button';

type ConfirmDialogProps = {
  cancelLabel?: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
};

export function ConfirmDialog({
  cancelLabel = 'Cancelar',
  children,
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm,
  open,
  title,
}: ConfirmDialogProps) {
  return (
    <AlertDialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onCancel();
        }
      }}
    >
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/45" />
        <AlertDialogPrimitive.Content
          role="dialog"
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-lg"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <AlertDialogPrimitive.Title className="text-lg font-semibold">
                {title}
              </AlertDialogPrimitive.Title>
              <AlertDialogPrimitive.Description asChild>
                <div className="text-sm text-muted-foreground">{children}</div>
              </AlertDialogPrimitive.Description>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <AlertDialogPrimitive.Cancel asChild>
                <Button type="button" variant="secondary" onClick={onCancel}>
                  {cancelLabel}
                </Button>
              </AlertDialogPrimitive.Cancel>
              <AlertDialogPrimitive.Action asChild>
                <Button type="button" variant={danger ? 'danger' : 'default'} onClick={onConfirm}>
                  {confirmLabel}
                </Button>
              </AlertDialogPrimitive.Action>
            </div>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
