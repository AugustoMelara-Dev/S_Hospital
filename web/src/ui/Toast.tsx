import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export type ToastItem = {
  id: number;
  tone: ToastTone;
  title: ReactNode;
  description?: ReactNode;
  /** ms; 0 keeps it until dismissed. Errors default to 8000. */
  duration: number;
  action?: { label: string; onClick: () => void };
};

type ToastInput = Omit<ToastItem, 'id' | 'tone' | 'duration'> & { duration?: number };

let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function push(tone: ToastTone, input: ToastInput | string): number {
  const base: ToastInput = typeof input === 'string' ? { title: input } : input;
  const id = ++seq;
  const duration = base.duration ?? (tone === 'error' ? 8000 : 5000);
  items = [...items.slice(-3), { ...base, id, tone, duration }];
  emit();
  return id;
}

export function dismissToast(id: number): void {
  items = items.filter((t) => t.id !== id);
  emit();
}

/**
 * Global toast API (no hooks needed): `toast.success('Caja abierta.')`.
 * Requires `<Toaster />` mounted once (done in App).
 */
export const toast = {
  success: (t: ToastInput | string) => push('success', t),
  error: (t: ToastInput | string) => push('error', t),
  info: (t: ToastInput | string) => push('info', t),
  warning: (t: ToastInput | string) => push('warning', t),
  dismiss: dismissToast,
  /** Test helper. */
  _clear: () => {
    items = [];
    emit();
  },
};

export function useToast() {
  return toast;
}

const ICONS: Record<ToastTone, ReactNode> = {
  success: <CircleCheck className="text-ok" strokeWidth={1.8} />,
  error: <CircleAlert className="text-danger" strokeWidth={1.8} />,
  info: <Info className="text-slate" strokeWidth={1.8} />,
  warning: <TriangleAlert className="text-warn" strokeWidth={1.8} />,
};

function ToastCard({ item }: { item: ToastItem }) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const remaining = useRef(item.duration);
  const startedAt = useRef(0);

  const start = () => {
    if (item.duration <= 0) return;
    startedAt.current = Date.now();
    timer.current = setTimeout(() => dismissToast(item.id), remaining.current);
  };
  const pause = () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = undefined;
    remaining.current -= Date.now() - startedAt.current;
  };

  useEffect(() => {
    start();
    const onVis = () => (document.hidden ? pause() : start());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <li
      onMouseEnter={pause}
      onMouseLeave={start}
      onFocus={pause}
      onBlur={start}
      className={cn(
        'anim-toast-in pointer-events-auto flex w-[380px] max-w-[calc(100vw-32px)] items-start gap-3 rounded-[var(--radius-md)]',
        'border border-junta bg-surface px-4 py-3 shadow-pop',
      )}
    >
      <span className="mt-[1px] shrink-0 [&_svg]:size-[18px]" aria-hidden="true">
        {ICONS[item.tone]}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-[14px] leading-5 font-semibold text-ink">{item.title}</p>
        {item.description && <p className="text-[13px] leading-[18px] text-ink-2">{item.description}</p>}
        {item.action && (
          <button
            type="button"
            className="mt-1 self-start text-[13px] font-semibold text-slate underline-offset-2 hover:underline"
            onClick={() => {
              item.action?.onClick();
              dismissToast(item.id);
            }}
          >
            {item.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label="Cerrar aviso"
        onClick={() => dismissToast(item.id)}
        className="-mt-0.5 -mr-1.5 flex size-7 shrink-0 items-center justify-center rounded-[3px] text-ink-2 hover:bg-surface-2 hover:text-ink"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </li>
  );
}

export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items,
    () => items,
  );
  return (
    <section aria-label="Notificaciones" className="pointer-events-none fixed right-4 bottom-4 z-[60]">
      <ol className="flex flex-col items-end gap-2" aria-live="polite" aria-relevant="additions">
        {list.map((t) => (
          <ToastCard key={t.id} item={t} />
        ))}
      </ol>
    </section>
  );
}
