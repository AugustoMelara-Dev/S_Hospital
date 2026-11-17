import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { formatTime } from '@/lib/dates';
import { qk } from '@/api/queryClient';
import type { CashSession } from '@/api/types';
import { usePermissions } from '@/auth/hooks';
import { Skeleton } from '@/ui/Skeleton';

/** Current cash session of the logged-in user (polled every 15 s). */
export function useCurrentCashSession(enabled = true) {
  return useQuery({
    queryKey: qk.currentCash,
    queryFn: () => api.get<CashSession | null>('/cash-sessions/current'),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    enabled,
  });
}

export function CashStatusPill() {
  const { can } = usePermissions();
  const enabled = can('cash.view');
  const { data, isPending, isError } = useCurrentCashSession(enabled);
  if (!enabled) return null;

  if (isPending) return <Skeleton className="h-8 w-48 rounded-full" />;

  const open = !isError && data && data.status === 'open';
  const pill =
    'pressable inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap';

  if (isError) {
    return (
      <Link to="/caja" className={cn(pill, 'border-line bg-surface text-ink-2')}>
        <span aria-hidden="true" className="size-2 rounded-full bg-ink-3" />
        Estado de caja no disponible
      </Link>
    );
  }

  if (open) {
    return (
      <Link
        to="/caja"
        className={cn(pill, 'border-ok/30 bg-ok-soft text-ok hover:border-ok/50')}
        title={data.cash_register?.name ? `${data.cash_register.name} · ver caja` : 'Ver caja'}
      >
        <span aria-hidden="true" className="relative flex size-2">
          <span className="absolute inset-0 rounded-full bg-ok opacity-40 motion-safe:animate-ping" style={{ animationDuration: '2.4s' }} />
          <span className="relative size-2 rounded-full bg-ok" />
        </span>
        <span>
          Caja abierta · desde <span className="num">{formatTime(data.opened_at)}</span>
        </span>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className={cn(pill, 'pointer-events-none border-warn/30 bg-warn-soft text-warn')}>
        <span aria-hidden="true" className="size-2 rounded-full bg-warn" />
        Sin caja abierta
      </span>
      {can('cash.open') && (
        <Link
          to="/caja"
          className="pressable inline-flex h-8 items-center rounded-[var(--radius-sm)] bg-brand px-3 text-[13px] font-medium text-brand-ink hover:bg-brand-hover"
        >
          Abrir caja
        </Link>
      )}
    </div>
  );
}
