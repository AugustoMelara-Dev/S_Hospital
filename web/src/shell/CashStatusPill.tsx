import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { formatTime } from '@/lib/dates';
import { qk } from '@/api/queryClient';
import type { CashSession } from '@/api/types';
import { usePermissions } from '@/auth/hooks';
import { ShiftTile } from '@/ui/ShiftTile';
import { NO_SHIFT, SHIFT_STEP_LABEL } from '@/ui/shift';
import { useShiftSteps } from '@/features/caja/arqueoDraft';
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

/** Below 640px the chip shows only the brick; the words stay for assistive tech. */
const chip =
  'flex h-10 shrink-0 items-center gap-2.5 rounded-[var(--radius-md)] border border-junta bg-ground pr-3 pl-2 text-left max-[639px]:w-10 max-[639px]:justify-center max-[639px]:gap-0 max-[639px]:px-0';

function Lines({ title, sub }: { title: ReactNode; sub: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-col max-[639px]:sr-only">
      <span className="truncate text-[13px] leading-4 font-semibold text-ink">{title}</span>
      <span className="truncate text-[12px] leading-4 text-ink-2">{sub}</span>
    </span>
  );
}

/**
 * The shift chip in the top bar: the shift brick filling quarter by quarter
 * (Apertura → Cobros → Arqueo → Cierre) plus the register and what comes next.
 */
export function CashStatusPill() {
  const { can } = usePermissions();
  const enabled = can('cash.view');
  const { data, isPending, isError } = useCurrentCashSession(enabled);
  const { steps, next } = useShiftSteps(data);
  if (!enabled) return null;

  if (isPending) return <Skeleton className="h-10 w-[248px] rounded-[var(--radius-md)] max-[639px]:w-10" />;

  if (isError) {
    return (
      <Link to="/caja" className={cn(chip, 'pressable hover:border-junta-strong')}>
        <ShiftTile steps={NO_SHIFT} decorative />
        <Lines title="Estado de caja no disponible" sub="Ver caja" />
      </Link>
    );
  }

  const open = data && data.status === 'open';
  if (open) {
    const name = data.cash_register?.name || 'Caja';
    return (
      <Link to="/caja" className={cn(chip, 'pressable hover:border-junta-strong')}>
        <ShiftTile steps={steps} />
        <Lines
          title={
            <>
              {name} · abierta <span className="num">{formatTime(data.opened_at)}</span>
            </>
          }
          sub={next ? `Sigue: ${SHIFT_STEP_LABEL[next]}` : 'Turno completo'}
        />
      </Link>
    );
  }

  return (
    <div className={chip}>
      <ShiftTile steps={NO_SHIFT} />
      <Lines
        title="Sin caja abierta"
        sub={
          can('cash.open') ? (
            <Link to="/caja" className="font-semibold text-slate underline-offset-2 hover:underline">
              Abrir caja
            </Link>
          ) : (
            'Turno sin iniciar'
          )
        }
      />
    </div>
  );
}
