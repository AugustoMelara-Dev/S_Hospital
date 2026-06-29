import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { useId, useState, type ReactNode } from 'react';
import { Button } from './button';
import { Textarea } from './textarea';

type ConfirmDialogProps = {
  cancelLabel?: string;
  children: ReactNode;
  confirmLabel: string;
  confirmDisabled?: boolean;
  danger?: boolean;
  cancelDisabled?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string | null) => void;
  open: boolean;
  reasonHelpText?: string;
  requireReasonTextarea?: boolean;
  requireReasonMinLength?: number;
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
  reasonHelpText,
  requireReasonTextarea = false,
  requireReasonMinLength = 10,
  title,
}: ConfirmDialogProps) {
  const reasonId = useId();
  const errorId = useId();
  const [reason, setReason] = useState('');
  const trimmedReason = reason.trim();
  const meetsLength = !requireReasonTextarea || trimmedReason.length >= requireReasonMinLength;
  const canConfirm = !confirmDisabled && meetsLength;

  return (
    <AlertDialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !cancelDisabled) {
          setReason('');
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
                Revise la informacion del dialogo antes de confirmar esta accion.
              </AlertDialogPrimitive.Description>
              <div className="text-sm text-muted-foreground">{children}</div>
            </div>

            {requireReasonTextarea ? (
              <div data-slot="confirm-dialog-reason" className="flex flex-col gap-2">
                <label htmlFor={reasonId} className="text-sm font-medium leading-tight text-foreground">
                  Motivo <span className="text-destructive" aria-hidden="true">*</span>
                </label>
                <Textarea
                  id={reasonId}
                  name="confirm-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  required
                  aria-required="true"
                  aria-describedby={`${reasonId}-help ${meetsLength ? '' : errorId}`.trim()}
                  aria-invalid={!meetsLength}
                  placeholder="Describa el motivo de esta accion. Quedara registrado en auditoria."
                />
                <p id={`${reasonId}-help`} className="text-xs leading-5 text-muted-foreground">
                  {reasonHelpText ?? `Minimo ${requireReasonMinLength} caracteres. Esta accion no podra deshacerse.`}
                </p>
                {!meetsLength ? (
                  <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
                    Ingrese al menos {requireReasonMinLength} caracteres antes de continuar.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div data-slot="confirm-dialog-footer" className="flex flex-wrap justify-end gap-2">
              <AlertDialogPrimitive.Cancel asChild>
                <Button type="button" variant="secondary" onClick={onCancel} disabled={cancelDisabled}>
                  {cancelLabel}
                </Button>
              </AlertDialogPrimitive.Cancel>
              <Button
                type="button"
                variant={danger ? 'danger' : 'default'}
                onClick={() => {
                  const value = requireReasonTextarea ? trimmedReason : null;
                  setReason('');
                  onConfirm(value);
                }}
                disabled={!canConfirm}
                aria-disabled={!canConfirm}
              >
                {confirmLabel}
              </Button>
            </div>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
