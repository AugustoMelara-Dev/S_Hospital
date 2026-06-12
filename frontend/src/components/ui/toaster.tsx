import toast, { Toaster as HotToaster } from 'react-hot-toast';

export { toast };

const MAX_VISIBLE_TOASTS = 2;
const TOAST_DEDUPE_WINDOW_MS = 5000;
const visibleToastIds: string[] = [];
const recentToastTimes = new Map<string, number>();

type ToastKind = 'success' | 'error' | 'info' | 'warning';

function toastKey(kind: ToastKind, message: string): string {
  return `${kind}:${message.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 120)}`;
}

function rememberVisibleToast(id: string): void {
  const previousIndex = visibleToastIds.indexOf(id);
  if (previousIndex >= 0) {
    visibleToastIds.splice(previousIndex, 1);
  }

  visibleToastIds.push(id);

  while (visibleToastIds.length > MAX_VISIBLE_TOASTS) {
    const staleToastId = visibleToastIds.shift();
    if (staleToastId) {
      toast.dismiss(staleToastId);
    }
  }
}

function showDedupedToast(
  kind: ToastKind,
  message: string,
  show: (message: string, id: string) => string,
): string {
  const key = toastKey(kind, message);
  const now = Date.now();
  const lastShownAt = recentToastTimes.get(key) ?? 0;

  if (now - lastShownAt < TOAST_DEDUPE_WINDOW_MS) {
    return key;
  }

  recentToastTimes.set(key, now);
  window.setTimeout(() => recentToastTimes.delete(key), TOAST_DEDUPE_WINDOW_MS);
  const id = show(message, key);
  rememberVisibleToast(id);

  return id;
}

/**
 * Preconfigured application toaster.
 * Dark-mode aware, positioned top-right, with professional styling.
 */
export function Toaster() {
  return (
    <HotToaster
      position="top-right"
      containerClassName="hospital-toaster"
      gutter={8}
      toastOptions={{
        duration: 4000,
        className: 'font-sans',
        ariaProps: {
          role: 'status',
          'aria-live': 'polite',
        },
        style: {
          background: 'var(--color-card)',
          color: 'var(--color-card-foreground)',
          border: '1px solid var(--color-border)',
          borderRadius: '0.75rem',
          padding: '12px 16px',
          fontSize: '14px',
          fontWeight: 500,
          boxShadow: 'var(--shadow-lg)',
          maxWidth: 'min(420px, calc(100vw - 24px))',
        },
        success: {
          iconTheme: {
            primary: 'var(--color-success)',
            secondary: 'var(--color-card)',
          },
          duration: 3000,
        },
        error: {
          iconTheme: {
            primary: 'var(--color-destructive)',
            secondary: 'var(--color-card)',
          },
          duration: 5000,
        },
      }}
    />
  );
}

/** Convenience helpers */
export const notify = {
  success: (message: string) =>
    showDedupedToast('success', message, (text, id) => toast.success(text, { id })),
  error: (message: string) =>
    showDedupedToast('error', message, (text, id) => toast.error(text, { id })),
  info: (message: string) =>
    showDedupedToast('info', message, (text, id) => toast(text, { id, icon: 'i' })),
  warning: (message: string) =>
    showDedupedToast('warning', message, (text, id) => toast(text, { id, icon: '!' })),
  loading: (message: string) => toast.loading(message),
  dismiss: (id?: string) => toast.dismiss(id),
  promise: <T,>(
    promise: Promise<T>,
    msgs: { loading: string; success: string; error: string },
  ) => toast.promise(promise, msgs),
};
