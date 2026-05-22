import toast, { Toaster as HotToaster } from 'react-hot-toast';

export { toast };

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
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.error(message),
  info: (message: string) => toast(message, { icon: 'ℹ️' }),
  warning: (message: string) => toast(message, { icon: '⚠️' }),
  loading: (message: string) => toast.loading(message),
  dismiss: (id?: string) => toast.dismiss(id),
  promise: <T,>(
    promise: Promise<T>,
    msgs: { loading: string; success: string; error: string },
  ) => toast.promise(promise, msgs),
};
