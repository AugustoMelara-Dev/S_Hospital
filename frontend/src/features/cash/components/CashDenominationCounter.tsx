import { AdminChip, AdminPanel, AdminPanelHeader, AdminStat, MoneyText } from '@/design-system/admin/components';
import { parseCents } from '@/lib/moneyCents';
import type { CashClosingBreakdown } from '@/lib/api/types';
import { formatSignedCashCents } from '../cashMoney';
import { INPUT_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../cashUi';

export const HNL_BILL_DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1] as const;

export type HnlBillDenomination = (typeof HNL_BILL_DENOMINATIONS)[number];
export type DenominationCounts = Record<HnlBillDenomination, string>;

type CashDenominationCounterProps = {
  counts: DenominationCounts;
  expectedAmount: string | null;
  otherAmount: string;
  onConfirmZero: () => void;
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
  const parsedOther = /^\d+(\.\d{0,2})?$/.test(otherAmount.trim()) ? parseCents(otherAmount) : null;

  return billsTotal + (parsedOther !== null && parsedOther > 0 ? parsedOther : 0);
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

/**
 * Conteo en cero **confirmado** (no un conteo sin hacer): el operador registró
 * cantidades y el total es L 0.00, o declaró explícitamente que la gaveta no
 * tiene efectivo. Se distingue de `hasCashDenominationCount` falso, que
 * significa "todavía no conté".
 */
export function isZeroCashCountConfirmed(
  counts: DenominationCounts,
  otherAmount: string,
): boolean {
  return hasCashDenominationCount(counts, otherAmount)
    && cashDenominationTotalCents(counts, otherAmount) === 0;
}

export function cashDenominationBreakdown(
  counts: DenominationCounts,
  otherAmount: string,
): CashClosingBreakdown {
  const bills = Object.fromEntries(
    HNL_BILL_DENOMINATIONS.map((denomination) => [String(denomination), Number(counts[denomination] || 0)]),
  ) as CashClosingBreakdown['bills'];
  const parsedOther = /^\d+(\.\d{0,2})?$/.test(otherAmount.trim()) ? parseCents(otherAmount) : null;
  const otherCents = parsedOther !== null && parsedOther > 0 ? parsedOther : 0;

  return {
    bills,
    other_amount: cashCentsToDecimal(otherCents),
  };
}

/**
 * Arqueo de efectivo: una sola superficie reúne el efectivo esperado, el
 * conteo y la diferencia. El total contado es la región viva
 * ("Total contado por denominaciones"); sin conteo vale "Pendiente", nunca un
 * L 0.00 implícito. La diferencia solo se calcula cuando hay conteo y el
 * esperado es válido.
 */
export function CashDenominationCounter({
  counts,
  expectedAmount,
  otherAmount,
  onConfirmZero,
  onContinue,
  onCountChange,
  onOtherAmountChange,
  onReset,
}: CashDenominationCounterProps) {
  const totalCents = cashDenominationTotalCents(counts, otherAmount);
  const expectedCents = parseCents(expectedAmount);
  const differenceCents = expectedCents === null ? null : totalCents - expectedCents;
  const hasCounted = hasCashDenominationCount(counts, otherAmount);
  const zeroConfirmed = isZeroCashCountConfirmed(counts, otherAmount);
  const differenceKnown = hasCounted && differenceCents !== null;
  const countState = !hasCounted ? 'none' : zeroConfirmed ? 'zero-confirmed' : 'counted';

  const differenceLabel = !hasCounted
    ? 'Pendiente'
    : differenceCents === null
      ? 'No disponible'
      : formatSignedCashCents(differenceCents);
  const differenceHint = !hasCounted
    ? 'Ingrese el conteo para calcularla'
    : differenceCents === null
      ? 'Efectivo esperado no disponible'
      : differenceCents === 0
        ? 'El conteo coincide con el efectivo esperado'
        : differenceCents > 0
          ? 'Sobrante frente al efectivo esperado'
          : 'Faltante frente al efectivo esperado';

  return (
    <AdminPanel as="section" aria-labelledby="cash-arqueo-title" className="overflow-hidden" data-cash-count-state={countState}>
      <AdminPanelHeader
        id="cash-arqueo-title"
        title="Arqueo de efectivo"
        description="Cuente billetes y monedas. El efectivo esperado proviene de la apertura y de los cobros en efectivo."
      />

      <div className="grid border-b border-[var(--ui-line)] sm:grid-cols-3 sm:divide-x sm:divide-[var(--ui-line)]">
        <AdminStat label="Efectivo esperado" value={<MoneyText cents={expectedCents} />} />
        <AdminStat
          label="Total contado"
          value={
            <output
              aria-live="polite"
              aria-label="Total contado por denominaciones"
              className="tabular-nums"
            >
              <MoneyText cents={hasCounted ? totalCents : null} fallback="Pendiente" />
            </output>
          }
          hint="Suma de billetes y monedas"
        />
        <AdminStat
          label="Diferencia"
          value={differenceLabel}
          tone={differenceKnown && differenceCents !== 0 ? 'warn' : 'default'}
          hint={differenceHint}
        />
      </div>

      {/* Un conteo sin hacer y un conteo en cero confirmado no son lo mismo. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--ui-line)] bg-[var(--ui-surface-alt)] px-4 py-2.5 text-[length:var(--ui-text-xs)]">
        {countState === 'zero-confirmed' ? (
          <>
            <AdminChip tone="warn">Conteo en cero confirmado</AdminChip>
            <span className="text-[color:var(--ui-ink-soft)]">
              La gaveta se declara sin efectivo; la diferencia es el esperado completo.
            </span>
          </>
        ) : countState === 'counted' ? (
          <span className="text-[color:var(--ui-ink-soft)]">
            Conteo en curso: aún puede corregir cantidades antes de continuar.
          </span>
        ) : (
          <>
            <span className="text-[color:var(--ui-ink-soft)]">Conteo no realizado.</span>
            <span className="text-[color:var(--ui-ink-faint)]">
              Si la gaveta no tiene efectivo, confirme el conteo en cero.
            </span>
          </>
        )}
      </div>

      <div className="grid gap-4 px-4 py-4 sm:px-5">
        <div className="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
          {HNL_BILL_DENOMINATIONS.map((denomination) => {
            const count = counts[denomination];
            const hasCount = count !== '';
            const subtotalCents = /^\d+$/.test(count) ? Number(count) * denomination * 100 : 0;
            const inputId = `cash-denomination-${denomination}`;

            return (
              <div
                key={denomination}
                className="flex items-center gap-3 border-b border-[var(--ui-line)] py-2"
              >
                <label
                  htmlFor={inputId}
                  className="min-w-[4.5rem] flex-1 text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]"
                >
                  <span className="tabular-nums">L {denomination}</span>
                </label>
                {/* Un solo indicador de ausencia por fila: el placeholder «—»
                    del input (un «0» pintado parecía un conteo ya introducido;
                    0 ≠ no contado). Sin conteo el subtotal NO se pinta: dos
                    glifos idénticos se leían como una sola ausencia. */}
                <input
                  id={inputId}
                  aria-label={`Cantidad de billetes de L ${denomination}`}
                  inputMode="numeric"
                  autoComplete="off"
                  value={count}
                  placeholder="—"
                  className={`${INPUT_CLASS} w-20 text-right tabular-nums`}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (/^\d{0,5}$/.test(value)) onCountChange(denomination, value);
                  }}
                />
                <span className="w-24 text-right text-[length:var(--ui-text-sm)] tabular-nums text-[color:var(--ui-ink-soft)]">
                  <MoneyText cents={hasCount ? subtotalCents : null} fallback="" />
                </span>
              </div>
            );
          })}
        </div>

        <div className="grid gap-2 border-t border-[var(--ui-line)] pt-4 sm:flex sm:items-end sm:gap-4">
          <div className="min-w-0 flex-1">
            <label htmlFor="cash-denomination-other" className="block text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">
              Monedas y otros (L.)
            </label>
            <p className="mt-1 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
              Monedas o fracciones no representadas por billetes.
            </p>
          </div>
          <input
            id="cash-denomination-other"
            aria-label="Monedas y otros"
            inputMode="decimal"
            autoComplete="off"
            value={otherAmount}
            placeholder="0.00"
            className={`${INPUT_CLASS} h-11 text-right font-semibold tabular-nums sm:w-48`}
            onChange={(event) => {
              const value = event.target.value;
              if (/^\d{0,7}(\.\d{0,2})?$/.test(value)) onOtherAmountChange(value);
            }}
          />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-[var(--ui-line)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
          Al continuar, el total contado pasa al cierre como monto auditado.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={onConfirmZero}>
            Confirmar conteo en cero
          </button>
          <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={onReset}>Limpiar conteo</button>
          <button type="button" data-ui-press className={PRIMARY_BUTTON} disabled={!hasCounted} onClick={onContinue}>
            Continuar al cierre
          </button>
        </div>
      </div>
    </AdminPanel>
  );
}
