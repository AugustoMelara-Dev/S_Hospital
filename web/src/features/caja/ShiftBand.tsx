import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { SHIFT_STEP_LABEL, SHIFT_STEP_ORDER, ShiftTile, StatusGlyph, shiftLabel, type ShiftSteps } from '@/ui';

export type StageInfo = {
  /** Main figure of the stage (time, count, amount) or "—". */
  value: ReactNode;
  /** Short state line under the figure ("Completado", "2 bloqueos"…). */
  note: ReactNode;
  /** Overrides the default tone of the glyph (done → ok, pending → ink-3). */
  tone?: 'ok' | 'warn' | 'danger' | 'neutral';
};

export type ShiftBandProps = {
  steps: ShiftSteps;
  title: ReactNode;
  subtitle?: ReactNode;
  stages: Record<keyof ShiftSteps, StageInfo>;
  /** Trailing cell (status badge, action). */
  aside?: ReactNode;
  className?: string;
};

const TONE: Record<NonNullable<StageInfo['tone']>, string> = {
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
  neutral: 'text-ink-3',
};

/** A missing value: em dash in ink-3. */
export function Dash() {
  return <span className="text-ink-3">—</span>;
}

/**
 * The shift as one junta grid: a large shift brick (the four quarters) beside the
 * four stage cells Apertura → Cobros → Arqueo → Cierre with their figure and state.
 */
export function ShiftBand({ steps, title, subtitle, stages, aside, className }: ShiftBandProps) {
  return (
    <div
      role="group"
      aria-label={shiftLabel(steps)}
      className={cn(
        'grid gap-px overflow-hidden rounded-[var(--radius-md)] border border-junta bg-junta',
        'grid-cols-2 md:grid-cols-[minmax(280px,1.35fr)_repeat(4,minmax(0,1fr))]',
        aside && 'xl:grid-cols-[minmax(280px,1.35fr)_repeat(4,minmax(0,1fr))_auto]',
        className,
      )}
    >
      <div className="col-span-2 flex items-center gap-4 bg-surface px-4 py-3 md:col-span-1">
        <ShiftTile steps={steps} decorative className="size-16 border-junta-strong" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate text-[16px] leading-5 font-bold text-ink">{title}</p>
          {subtitle && <div className="text-[13px] leading-[18px] text-ink-2">{subtitle}</div>}
        </div>
      </div>
      {SHIFT_STEP_ORDER.map((k) => {
        const st = stages[k];
        const done = steps[k];
        return (
          <div key={k} className="flex min-w-0 flex-col justify-center gap-1 bg-surface px-4 py-3" data-stage={k} data-done={done}>
            <span className="flex items-center gap-2 text-[12px] leading-4 font-semibold text-ink-2">
              <StatusGlyph shape={done ? 'filled' : 'hollow'} className={cn('size-2.5', done ? 'text-ok' : TONE[st.tone ?? 'neutral'])} />
              {SHIFT_STEP_LABEL[k]}
            </span>
            <span className="num truncate text-[20px] leading-6 font-semibold text-ink">{st.value}</span>
            <span className={cn('truncate text-[12px] leading-4', st.tone && st.tone !== 'neutral' ? TONE[st.tone] : 'text-ink-3')}>{st.note}</span>
          </div>
        );
      })}
      {aside && <div className="col-span-2 flex items-center justify-end gap-2 bg-surface px-4 py-3 md:col-span-5 xl:col-span-1">{aside}</div>}
    </div>
  );
}
