import { useId, type ReactNode } from 'react';
import { ArrowRight, Eraser } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Badge, Button, Field, Money, MoneyInput } from '@/ui';
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
} from './arqueo';

export type ArqueoTabProps = {
  value: ArqueoState;
  onChange: (next: ArqueoState) => void;
  expectedCents: number;
  onContinue?: () => void;
  readOnly?: boolean;
};

/** Denomination counter: bills × count, coins, and live difference against expected cash. */
export function ArqueoTab({ value, onChange, expectedCents, onContinue, readOnly }: ArqueoTabProps) {
  const id = useId();
  const total = arqueoTotal(value);
  const ready = arqueoReady(value);

  function setCount(d: (typeof DENOMINATIONS)[number], text: string) {
    const n = parseCount(text);
    if (n === null) return;
    const counts = { ...value.counts };
    if (n === undefined) delete counts[d];
    else counts[d] = n;
    onChange({ ...value, counts, confirmedZero: false });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-[var(--radius-md)] border border-line bg-surface">
        <table className="w-full border-collapse text-[13.5px]">
          <caption className="sr-only">Conteo de billetes por denominación</caption>
          <thead>
            <tr className="border-b border-line bg-surface-2/60 text-[12px] text-ink-2">
              <th scope="col" className="h-9 px-3 text-left font-medium">
                Denominación
              </th>
              <th scope="col" className="h-9 w-[140px] px-3 text-right font-medium">
                Cantidad
              </th>
              <th scope="col" className="h-9 w-[160px] px-3 text-right font-medium">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {DENOMINATIONS.map((d) => {
              const count = value.counts[d];
              const inputId = `${id}-d${d}`;
              return (
                <tr key={d} className="border-b border-line last:border-0">
                  <th scope="row" className="px-3 py-1.5 text-left font-normal">
                    <label htmlFor={inputId} className="num text-ink">
                      L {d}
                    </label>
                  </th>
                  <td className="px-3 py-1.5 text-right">
                    <input
                      id={inputId}
                      inputMode="numeric"
                      autoComplete="off"
                      aria-label={`Cantidad de billetes de L ${d}`}
                      className="control num ml-auto h-8 min-h-8 w-[96px] text-right"
                      value={count === undefined ? '' : String(count)}
                      placeholder="0"
                      readOnly={readOnly}
                      onChange={(e) => setCount(d, e.target.value)}
                      onFocus={(e) => e.target.select()}
                    />
                  </td>
                  <td className={cn('num px-3 py-1.5 text-right', count ? 'text-ink' : 'text-ink-3')}>
                    <Money cents={denominationSubtotal(d, count)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="border-t border-line px-3 py-3">
          <Field label="Monedas y otros" hint="Monedas y fracciones que no son billetes.">
            <MoneyInput
              value={value.coinsCents}
              readOnly={readOnly}
              onValueChange={(c) => onChange({ ...value, coinsCents: c, confirmedZero: false })}
              className="max-w-[200px]"
            />
          </Field>
        </div>
      </div>

      <ArqueoSummary
        totalCents={total}
        expectedCents={expectedCents}
        ready={ready}
        footer={
          readOnly ? null : (
            <div className="flex flex-col gap-2">
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
                <Button variant="primary" rightIcon={<ArrowRight />} disabled={!ready} onClick={onContinue}>
                  Continuar al cierre
                </Button>
              )}
            </div>
          )
        }
      />
    </div>
  );
}

export function ArqueoSummary({
  totalCents,
  expectedCents,
  ready = true,
  footer,
}: {
  totalCents: number;
  expectedCents: number;
  ready?: boolean;
  footer?: ReactNode;
}) {
  const diff = differenceCents(totalCents, expectedCents);
  const kind = differenceKind(diff);
  return (
    <aside className="flex flex-col gap-4 self-start rounded-[var(--radius-md)] border border-line bg-surface p-4" aria-label="Resultado del arqueo">
      <dl className="flex flex-col gap-2.5 text-[13.5px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-2">Efectivo esperado</dt>
          <dd>
            <Money cents={expectedCents} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-2">Total contado</dt>
          <dd className="text-[18px] font-semibold" aria-live="polite">
            <Money cents={totalCents} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line pt-2.5">
          <dt className="text-ink-2">Diferencia</dt>
          <dd className="flex items-center gap-2" aria-live="polite" data-testid="arqueo-diferencia">
            {ready ? (
              <>
                <Badge tone={DIFFERENCE_TONE[kind]} dot>
                  {DIFFERENCE_LABEL[kind]}
                </Badge>
                <Money
                  cents={diff}
                  signed
                  className={cn('font-semibold', kind === 'shortage' && 'text-danger', kind === 'overage' && 'text-warn', kind === 'balanced' && 'text-ok')}
                />
              </>
            ) : (
              <span className="text-[13px] text-ink-3">Sin conteo</span>
            )}
          </dd>
        </div>
      </dl>
      {footer}
    </aside>
  );
}
