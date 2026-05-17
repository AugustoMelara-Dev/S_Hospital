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
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="presentation">
      <section
        aria-labelledby="confirm-dialog-title"
        aria-modal="true"
        className="w-full max-w-lg rounded-lg border border-border bg-card p-5 text-card-foreground shadow-lg"
        role="dialog"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h2 id="confirm-dialog-title" className="text-lg font-semibold">
              {title}
            </h2>
            <div className="text-sm text-muted-foreground">{children}</div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button type="button" variant={danger ? 'danger' : 'default'} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
