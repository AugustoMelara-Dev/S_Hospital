import { useId, type ReactNode } from 'react';
import { ArrowRight, Eraser } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Badge, Button, Money, MoneyInput, type GlyphShape } from '@/ui';
import {
  arqueoReady,
  arqueoTotal,
  DENOMINATIONS,
  denominationSubtotal,
  DIFFERENCE_LABEL,
  DIFFERENCE_TONE,
  differenceCents,
  differenceKind,
  EMPTY_ARQUEO,
  parseCount,
  type ArqueoState,
  type DifferenceKind,
} from './arqueo';

export type ArqueoTabProps = {
  value: ArqueoState;
  onChange: (next: ArqueoState) => void;
  expectedCents: number;
  onContinue?: () => void;
  readOnly?: boolean;
};

/** Difference state by shape and label: Cuadra ■, Sobrante ◆, Faltante ☐. */
export const DIFFERENCE_SHAPE: Record<DifferenceKind, GlyphShape> = { balanced: 'filled', overage: 'diamond', shortage: 'hollow' };

/**
 * Denomination counter laid out as the "ladrillo" floor: one square-ish tile per
 * bill (L 500 … L 1) plus "Monedas y otros", separated by juntas; each tile holds
 * the denomination, the quantity and its subtotal. The result row below compares
 * expected and counted cash.
 */
export function ArqueoTab({ value, onChange, expectedCents, onContinue, readOnly }: ArqueoTabProps) {
  const id = useId();
  const total = arqueoTotal(value);
  const ready = arqueoReady(value);
  const coinsId = `${id}-coins`;

  function setCount(d: (typeof DENOMINATIONS)[number], text: string) {
    const n = parseCount(text);
    if (n === null) return;
    const counts = { ...value.counts };
    if (n === undefined) delete counts[d];
    else counts[d] = n;
    onChange({ ...value, counts, confirmedZero: false });
  }

  return (
    <section aria-labelledby={`${id}-title`} className="overflow-hidden rounded-[var(--radius-md)] border border-junta bg-surface">
      <header className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-junta px-4 py-2.5">
        <h3 id={`${id}-title`} className="text-[15px] leading-5 font-bold text-ink">
          Conteo de efectivo
        </h3>
        <p className="text-[12.5px] leading-4 text-ink-2">Cantidad de billetes por denominación. Solo el efectivo entra en el arqueo.</p>
      </header>

      <div role="group" aria-label="Conteo de billetes por denominación" className="grid grid-cols-5 gap-px bg-junta xl:grid-cols-10">
        {DENOMINATIONS.map((d) => {
          const count = value.counts[d];
          const inputId = `${id}-d${d}`;
          const has = (count ?? 0) > 0;
          return (
            <div key={d} className={cn('flex min-h-[120px] flex-col gap-2 px-3 pt-3 pb-2.5', has ? 'bg-surface' : 'bg-surface-2')}>
              <label htmlFor={inputId} className="num text-[22px] leading-7 font-bold tracking-[-0.01em] text-ink">
                <span className="text-[14px] font-semibold text-ink-2">L</span> {d}
              </label>
              <input
                id={inputId}
                inputMode="numeric"
                autoComplete="off"
                aria-label={`Cantidad de billetes de L ${d}`}
                className="control num h-9 min-h-9 w-full text-right text-[16px]"
                value={count === undefined ? '' : String(count)}
                readOnly={readOnly}
                onChange={(e) => setCount(d, e.target.value)}
                onFocus={(e) => e.target.select()}
              />
              <span className={cn('num mt-auto text-right text-[13px] leading-4', has ? 'font-semibold text-ink' : 'text-ink-3')}>
                <Money cents={denominationSubtotal(d, count)} />
              </span>
            </div>
          );
        })}
        <div className={cn('flex min-h-[120px] flex-col gap-2 px-3 pt-3 pb-2.5', value.coinsCents ? 'bg-surface' : 'bg-surface-2')}>
          <label htmlFor={coinsId} className="flex h-7 items-end text-[12.5px] leading-[14px] font-semibold text-ink">
            Monedas y otros
          </label>
          <MoneyInput
            id={coinsId}
            value={value.coinsCents}
            readOnly={readOnly}
            onValueChange={(c) => onChange({ ...value, coinsCents: c, confirmedZero: false })}
            className="num h-9 min-h-9 w-full text-right text-[16px]"
          />
        </div>
      </div>

      <div className="grid border-t border-junta lg:grid-cols-[minmax(0,1fr)_auto]">
        <ArqueoSummary layout="row" totalCents={total} expectedCents={expectedCents} ready={ready} />
        {!readOnly && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-junta px-4 py-3 lg:border-t-0 lg:border-l">
            {total === 0 && (
              <Button
                variant={value.confirmedZero ? 'secondary' : 'ghost'}
                onClick={() => onChange({ ...EMPTY_ARQUEO, confirmedZero: true })}
                aria-pressed={value.confirmedZero}
              >
                {value.confirmedZero ? 'Conteo en cero confirmado' : 'Confirmar conteo en cero'}
              </Button>
            )}
            {total > 0 && (
              <Button variant="ghost" leftIcon={<Eraser />} onClick={() => onChange(EMPTY_ARQUEO)}>
                Limpiar conteo
              </Button>
            )}
            {onContinue && (
              <Button variant="primary" size="lg" rightIcon={<ArrowRight />} disabled={!ready} onClick={onContinue}>
                Continuar al cierre
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** Difference figure with its state badge (shape + label). */
export function DifferenceValue({ cents, className }: { cents: number; className?: string }) {
  const kind = differenceKind(cents);
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Badge tone={DIFFERENCE_TONE[kind]} shape={DIFFERENCE_SHAPE[kind]}>
        {DIFFERENCE_LABEL[kind]}
      </Badge>
      <Money cents={cents} signed className="font-semibold" />
    </span>
  );
}

export function ArqueoSummary({
  totalCents,
  expectedCents,
  ready = true,
  footer,
  layout = 'stack',
}: {
  totalCents: number;
  expectedCents: number;
  ready?: boolean;
  footer?: ReactNode;
  /** `row`: three junta cells side by side (under the tile grid); `stack`: a side panel. */
  layout?: 'row' | 'stack';
}) {
  const diff = differenceCents(totalCents, expectedCents);
  const diffNode = (
    <dd className="flex items-center gap-2" aria-live="polite" data-testid="arqueo-diferencia">
      {ready ? <DifferenceValue cents={diff} className="text-[18px] leading-6" /> : <span className="text-[13px] text-ink-3">Sin conteo</span>}
    </dd>
  );

  if (layout === 'row') {
    return (
      <aside aria-label="Resultado del arqueo" className="min-w-0">
        <dl className="grid h-full grid-cols-3 gap-px bg-junta">
          <div className="flex flex-col justify-center gap-1 bg-surface px-4 py-3">
            <dt className="text-[12px] leading-4 font-semibold text-ink-2">Efectivo esperado</dt>
            <dd className="num text-[18px] leading-6 font-semibold text-ink">
              <Money cents={expectedCents} />
            </dd>
          </div>
          <div className="flex flex-col justify-center gap-1 bg-surface px-4 py-3">
            <dt className="text-[12px] leading-4 font-semibold text-ink-2">Total contado</dt>
            <dd className="num text-[22px] leading-7 font-bold text-ink" aria-live="polite">
              <Money cents={totalCents} />
            </dd>
          </div>
          <div className="flex flex-col justify-center gap-1 bg-surface px-4 py-3">
            <dt className="text-[12px] leading-4 font-semibold text-ink-2">Diferencia</dt>
            {diffNode}
          </div>
        </dl>
        {footer}
      </aside>
    );
  }

  return (
    <aside
      className="flex flex-col self-start overflow-hidden rounded-[var(--radius-md)] border border-junta bg-surface"
      aria-label="Resultado del arqueo"
    >
      <dl className="flex flex-col text-[13.5px]">
        <div className="flex items-baseline justify-between gap-3 border-b border-junta px-4 py-2.5">
          <dt className="text-ink-2">Efectivo esperado</dt>
          <dd>
            <Money cents={expectedCents} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-b border-junta px-4 py-2.5">
          <dt className="text-ink-2">Total contado</dt>
          <dd className="text-[18px] font-semibold" aria-live="polite">
            <Money cents={totalCents} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <dt className="text-ink-2">Diferencia</dt>
          {diffNode}
        </div>
      </dl>
      {footer && <div className="border-t border-junta p-4">{footer}</div>}
    </aside>
  );
}
