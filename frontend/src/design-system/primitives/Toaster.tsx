import { Toaster as SonnerToaster, toast } from 'sonner';
import { type CSSProperties } from 'react';

const TOAST_DEDUPE_WINDOW_MS = 5000;

type ToastKind = 'success' | 'error' | 'info' | 'warning';
type ToastId = string | number;

const recentToasts = new Map<string, { id: ToastId; shownAt: number }>();

function toastKey(kind: ToastKind, message: string): string {
  const normalizedMessage = message.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 120);
  return `${kind}:${normalizedMessage}`;
}

function showDedupedToast(
  kind: ToastKind,
  message: string,
  show: (message: string, id: ToastId) => ToastId,
): ToastId {
  const key = toastKey(kind, message);
  const now = Date.now();
  const recentToast = recentToasts.get(key);

  if (recentToast && now - recentToast.shownAt < TOAST_DEDUPE_WINDOW_MS) {
    return recentToast.id;
  }

  const id = show(message, key);
  recentToasts.set(key, { id, shownAt: now });

  if (typeof globalThis.setTimeout === 'function') {
    globalThis.setTimeout(() => {
      if (recentToasts.get(key)?.shownAt === now) {
        recentToasts.delete(key);
      }
    }, TOAST_DEDUPE_WINDOW_MS);
  }

  return id;
}

const toastStyle = {
  background: 'var(--color-surface)',
  color: 'var(--color-ink)',
  border: '1px solid var(--color-line)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-panel)',
  fontFamily: 'var(--font-sans)',
} satisfies CSSProperties;

export function ClinicalToaster() {
  return (
    <SonnerToaster
      closeButton
      containerAriaLabel="Notificaciones"
      duration={4000}
      gap={8}
      position="top-right"
      toastOptions={{
        classNames: {
          closeButton: 'min-h-11 min-w-11 touch-manipulation',
        },
        closeButtonAriaLabel: 'Cerrar notificación',
        style: toastStyle,
      }}
      visibleToasts={2}
    />
  );
}

export const notify = {
  success: (message: string): ToastId =>
    showDedupedToast('success', message, (text, id) => toast.success(text, { id })),
  error: (message: string): ToastId =>
    showDedupedToast('error', message, (text, id) => toast.error(text, { id })),
  info: (message: string): ToastId =>
    showDedupedToast('info', message, (text, id) => toast.info(text, { id })),
  warning: (message: string): ToastId =>
    showDedupedToast('warning', message, (text, id) => toast.warning(text, { id })),
  loading: (message: string): ToastId => toast.loading(message),
  dismiss: (id?: ToastId): void => {
    toast.dismiss(id);
  },
  promise: <T,>(
    promise: Promise<T>,
    messages: { loading: string; success: string; error: string },
  ): Promise<T> => {
    toast.promise(promise, messages);
    return promise;
  },
};
