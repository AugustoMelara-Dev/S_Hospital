import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { type ReactNode } from 'react';
import { Button } from './button';

type ConfirmDialogProps = {
  cancelLabel?: string;
  children: ReactNode;
  confirmLabel: string;
  confirmDisabled?: boolean;
  danger?: boolean;
  cancelDisabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
};

export function ConfirmDialog({
  cancelLabel = 'Cancelar',
  cancelDisabled = false,
  children,
  confirmDisabled = false,
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
        if (!nextOpen && !cancelDisabled) {
          onCancel();
        }
      }}
    >
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay data-slot="confirm-dialog-overlay" className="fixed inset-0 z-50 bg-foreground/45" />
        <AlertDialogPrimitive.Content
          data-slot="confirm-dialog-content"
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-lg"
        >
          <div data-slot="confirm-dialog-layout" className="flex flex-col gap-4">
            <div data-slot="confirm-dialog-header" className="flex flex-col gap-2">
              <AlertDialogPrimitive.Title data-slot="confirm-dialog-title" className="text-lg font-semibold">
                {title}
              </AlertDialogPrimitive.Title>
              <AlertDialogPrimitive.Description data-slot="confirm-dialog-description" className="sr-only">
                Revise la informacion antes de confirmar esta accion.
              </AlertDialogPrimitive.Description>
              <div className="text-sm text-muted-foreground">{children}</div>
            </div>

            <div data-slot="confirm-dialog-footer" className="flex flex-wrap justify-end gap-2">
              <AlertDialogPrimitive.Cancel asChild>
                <Button type="button" variant="secondary" onClick={onCancel} disabled={cancelDisabled}>
                  {cancelLabel}
                </Button>
              </AlertDialogPrimitive.Cancel>
              <Button type="button" variant={danger ? 'danger' : 'default'} onClick={onConfirm} disabled={confirmDisabled}>
                {confirmLabel}
              </Button>
            </div>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
