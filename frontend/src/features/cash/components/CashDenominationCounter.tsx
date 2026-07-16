import { Button, Input } from 'antd';
import { formatLempirasUI, parseCents } from '@/lib/money';
import type { CashClosingBreakdown } from '@/lib/api/types';

export const HNL_BILL_DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1] as const;

export type HnlBillDenomination = (typeof HNL_BILL_DENOMINATIONS)[number];
export type DenominationCounts = Record<HnlBillDenomination, string>;

type CashDenominationCounterProps = {
  counts: DenominationCounts;
  expectedAmount: string;
  otherAmount: string;
  onContinue: () => void;
  onCountChange: (denomination: HnlBillDenomination, value: string) => void;
  onOtherAmountChange: (value: string) => void;
  onReset: () => void;
};

export function createEmptyDenominationCounts(): DenominationCounts {
  return Object.fromEntries(
    HNL_BILL_DENOMINATIONS.map((denomination) => [denomination, '']),
  ) as DenominationCounts;
}

export function cashDenominationTotalCents(
  counts: DenominationCounts,
  otherAmount: string,
): number {
  const billsTotal = HNL_BILL_DENOMINATIONS.reduce((total, denomination) => {
    const rawCount = counts[denomination];
    const count = /^\d+$/.test(rawCount) ? Number(rawCount) : 0;

    return total + (Number.isSafeInteger(count) ? count * denomination * 100 : 0);
  }, 0);
  const otherCents = /^\d+(\.\d{0,2})?$/.test(otherAmount.trim())
    ? parseCents(otherAmount)
    : 0;

  return billsTotal + Math.max(0, otherCents);
}

export function cashCentsToDecimal(cents: number): string {
  return (Math.max(0, Math.trunc(cents)) / 100).toFixed(2);
}

export function hasCashDenominationCount(
  counts: DenominationCounts,
  otherAmount: string,
): boolean {
  return HNL_BILL_DENOMINATIONS.some((denomination) => counts[denomination] !== '')
    || otherAmount.trim() !== '';
}

export function cashDenominationBreakdown(
  counts: DenominationCounts,
  otherAmount: string,
): CashClosingBreakdown {
  const bills = Object.fromEntries(
    HNL_BILL_DENOMINATIONS.map((denomination) => [String(denomination), Number(counts[denomination] || 0)]),
  ) as CashClosingBreakdown['bills'];
  const otherCents = /^\d+(\.\d{0,2})?$/.test(otherAmount.trim()) ? parseCents(otherAmount) : 0;

  return {
    bills,
    other_amount: cashCentsToDecimal(otherCents),
  };
}

export function CashDenominationCounter({
  counts,
  expectedAmount,
  otherAmount,
  onContinue,
  onCountChange,
  onOtherAmountChange,
  onReset,
}: CashDenominationCounterProps) {
  const totalCents = cashDenominationTotalCents(counts, otherAmount);
  const expectedCents = parseCents(expectedAmount);
  const differenceCents = totalCents - expectedCents;
  const hasCounted = hasCashDenominationCount(counts, otherAmount);

  return (
    <section
      aria-labelledby="cash-denomination-counter-title"
      className="border border-operational-border bg-operational-surface"
    >
      <div className="border-b border-border bg-muted/40 px-4 py-4 sm:px-5">
        <h2 id="cash-denomination-counter-title" className="text-lg font-semibold tracking-tight">
          Conteo por denominaciones
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre el efectivo físico. El total se conserva al continuar al cierre.
        </p>
      </div>

      <div className="grid gap-4 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {HNL_BILL_DENOMINATIONS.map((denomination) => {
            const count = counts[denomination];
            const subtotal = /^\d+$/.test(count) ? Number(count) * denomination : 0;
            const inputId = `cash-denomination-${denomination}`;

            return (
              <div key={denomination} className="grid grid-cols-[minmax(0,1fr)_6.5rem] items-end gap-3 border-b border-border pb-3">
                <div className="min-w-0">
                  <label htmlFor={inputId} className="block text-sm font-semibold">
                    Billetes de L {denomination}
                  </label>
                  <p className="mt-1 truncate text-xs tabular-nums text-muted-foreground">
                    Subtotal {formatLempirasUI(subtotal)}
                  </p>
                </div>
                <Input
                  id={inputId}
                  aria-label={`Cantidad de billetes de L ${denomination}`}
                  inputMode="numeric"
                  autoComplete="off"
                  value={count}
                  placeholder="0"
                  className="min-h-11 text-right font-mono tabular-nums"
                  onChange={(event) => {
                    const value = event.target.value;
                    if (/^\d{0,5}$/.test(value)) onCountChange(denomination, value);
                  }}
                />
              </div>
            );
          })}
        </div>

        <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-end">
          <div>
            <label htmlFor="cash-denomination-other" className="block text-sm font-semibold">
              Monedas y otros (L.)
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              Use este campo para monedas o fracciones no representadas por billetes.
            </p>
          </div>
          <Input
            id="cash-denomination-other"
            aria-label="Monedas y otros"
            inputMode="decimal"
            autoComplete="off"
            value={otherAmount}
            placeholder="0.00"
            className="min-h-11 text-right font-mono tabular-nums"
            onChange={(event) => {
              const value = event.target.value;
              if (/^\d{0,7}(\.\d{0,2})?$/.test(value)) onOtherAmountChange(value);
            }}
          />
        </div>

        <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2 sm:items-end">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Efectivo esperado</dt>
            <dd className="text-right font-semibold tabular-nums">{formatLempirasUI(expectedAmount)}</dd>
            <dt className="text-muted-foreground">Diferencia preliminar</dt>
            <dd className="text-right font-semibold tabular-nums">
              {hasCounted ? formatLempirasUI(differenceCents / 100) : 'Pendiente'}
            </dd>
          </dl>
          <output
            aria-live="polite"
            aria-label="Total contado por denominaciones"
            className="border-l-2 border-primary pl-4 text-right"
          >
            <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total contado</span>
            <strong className="mt-1 block text-2xl tabular-nums">{formatLempirasUI(totalCents / 100)}</strong>
          </output>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button htmlType="button" onClick={onReset}>Limpiar conteo</Button>
          <Button htmlType="button" type="primary" disabled={!hasCounted} onClick={onContinue}>
            Continuar al cierre
          </Button>
        </div>
      </div>
    </section>
  );
}
