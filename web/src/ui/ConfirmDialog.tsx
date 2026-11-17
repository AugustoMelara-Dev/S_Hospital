import { useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { Field } from './Field';
import { Textarea } from './Textarea';

export type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** Extra content (e.g. a summary of what will change). */
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  /** Ask for a reason (≥ minLength chars, default 5). */
  reason?: { label: string; placeholder?: string; hint?: ReactNode; minLength?: number };
  /** May be async; the dialog shows a loading state and stays open on error. */
  onConfirm: (reason: string) => unknown;
  /** Server/business error shown above the actions. */
  error?: string | null;
  loading?: boolean;
};

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  children,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'primary',
  reason,
  onConfirm,
  error,
  loading: loadingProp,
}: ConfirmDialogProps) {
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setText('');
      setTouched(false);
    }
  }

  const min = reason?.minLength ?? 5;
  const trimmed = text.trim();
  const reasonError = reason && trimmed.length < min ? `Escriba un motivo de al menos ${min} caracteres.` : null;
  const loading = loadingProp ?? busy;

  async function submit() {
    setTouched(true);
    if (reasonError) return;
    setBusy(true);
    try {
      await onConfirm(trimmed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      dismissible={!loading}
      onSubmit={() => void submit()}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button type="submit" variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {children}
        {reason && (
          <Field label={reason.label} required hint={reason.hint} error={touched ? reasonError : null}>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={reason.placeholder}
              maxLength={255}
              rows={3}
            />
          </Field>
        )}
        {error && (
          <p role="alert" className="rounded-[var(--radius-sm)] border border-danger/40 bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
