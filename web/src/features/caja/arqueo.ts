import type { CashBreakdown } from '@/api/types';

/** Bills accepted in the count (SPEC §5.7), largest first. */
export const DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1] as const;
export type Denomination = (typeof DENOMINATIONS)[number];
export type DenominationKey = keyof CashBreakdown['bills'];

export type ArqueoState = {
  /** Count of bills per denomination (whole numbers ≥ 0). */
  counts: Partial<Record<Denomination, number>>;
  /** "Monedas y otros" in cents, or null when empty. */
  coinsCents: number | null;
  /** The operator explicitly confirmed an empty drawer. */
  confirmedZero: boolean;
};

export const EMPTY_ARQUEO: ArqueoState = { counts: {}, coinsCents: null, confirmedZero: false };

/** Subtotal of one denomination row in cents (integer math only). */
export function denominationSubtotal(denomination: Denomination, count: number | undefined): number {
  return denomination * 100 * (count ?? 0);
}

/** Total counted in cents: Σ bills × value + coins. */
export function arqueoTotal(state: Pick<ArqueoState, 'counts' | 'coinsCents'>): number {
  let total = 0;
  for (const d of DENOMINATIONS) total += denominationSubtotal(d, state.counts[d]);
  return total + (state.coinsCents ?? 0);
}

/** True when the count can be used for closing (non-zero, or zero explicitly confirmed). */
export function arqueoReady(state: ArqueoState): boolean {
  return arqueoTotal(state) > 0 || state.confirmedZero;
}

/** Breakdown payload for POST /cash-sessions/{id}/close (sums to counted_cents). */
export function toBreakdown(state: Pick<ArqueoState, 'counts' | 'coinsCents'>): CashBreakdown {
  const bills: CashBreakdown['bills'] = {};
  for (const d of DENOMINATIONS) {
    const n = state.counts[d] ?? 0;
    if (n > 0) bills[String(d) as DenominationKey] = n;
  }
  return { bills, coins_cents: state.coinsCents ?? 0 };
}

export type DifferenceKind = 'overage' | 'shortage' | 'balanced';

/** difference = counted − expected (SPEC §5.7). */
export function differenceCents(countedCents: number, expectedCents: number): number {
  return countedCents - expectedCents;
}

export function differenceKind(diffCents: number): DifferenceKind {
  if (diffCents > 0) return 'overage';
  if (diffCents < 0) return 'shortage';
  return 'balanced';
}

export const DIFFERENCE_LABEL: Record<DifferenceKind, string> = {
  overage: 'Sobrante',
  shortage: 'Faltante',
  balanced: 'Cuadra',
};

export const DIFFERENCE_TONE = { overage: 'warn', shortage: 'danger', balanced: 'ok' } as const;

/** Parses a bill count typed by the user: digits only, max 6 digits; empty → undefined. */
export function parseCount(text: string): number | undefined | null {
  const t = text.trim();
  if (t === '') return undefined;
  if (!/^\d{1,6}$/.test(t)) return null;
  return Number(t);
}
