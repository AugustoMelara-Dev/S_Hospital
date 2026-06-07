import toast, { Toaster as HotToaster } from 'react-hot-toast';

export { toast };

const MAX_VISIBLE_TOASTS = 3;
const STATUS_TOAST_ID = 'hospital-status-toast';
const activeToastIds: string[] = [];

function trackToast(id: string) {
  const existingIndex = activeToastIds.indexOf(id);
  if (existingIndex >= 0) {
    activeToastIds.splice(existingIndex, 1);
  }

  activeToastIds.push(id);

  while (activeToastIds.length > MAX_VISIBLE_TOASTS) {
    const staleId = activeToastIds.shift();
    if (staleId) {
      toast.dismiss(staleId);
    }
  }

  return id;
}

function dismissTrackedToast(id?: string) {
  if (id) {
    const existingIndex = activeToastIds.indexOf(id);
    if (existingIndex >= 0) {
      activeToastIds.splice(existingIndex, 1);
    }
    toast.dismiss(id);
    return;
  }

  activeToastIds.splice(0, activeToastIds.length);
  toast.dismiss();
}

/**
 * Preconfigured application toaster.
 * Dark-mode aware, positioned top-right, with professional styling.
 */
export function Toaster() {
  return (
    <HotToaster
      position="top-right"
      gutter={8}
      toastOptions={{
        duration: 4000,
        className: 'font-sans',
        style: {
          background: 'var(--color-card)',
          color: 'var(--color-card-foreground)',
          border: '1px solid var(--color-border)',
          borderRadius: '0.75rem',
          padding: '12px 16px',
          fontSize: '14px',
          fontWeight: 500,
          boxShadow: 'var(--shadow-lg)',
          maxWidth: '420px',
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
  success: (message: string) => trackToast(toast.success(message)),
  error: (message: string) => trackToast(toast.error(message)),
  info: (message: string) => trackToast(toast(message, { icon: 'i' })),
  warning: (message: string) => trackToast(toast(message, { icon: '!' })),
  loading: (message: string) => trackToast(toast.loading(message)),
  status: (message: string, level: 'success' | 'error' | 'info' = 'info') => {
    if (level === 'success') {
      return trackToast(toast.success(message, { id: STATUS_TOAST_ID }));
    }

    if (level === 'error') {
      return trackToast(toast.error(message, { id: STATUS_TOAST_ID }));
    }

    return trackToast(toast(message, { id: STATUS_TOAST_ID, icon: 'i' }));
  },
  dismiss: (id?: string) => dismissTrackedToast(id),
  promise: <T,>(
    promise: Promise<T>,
    msgs: { loading: string; success: string; error: string },
  ) => toast.promise(promise, msgs),
};
