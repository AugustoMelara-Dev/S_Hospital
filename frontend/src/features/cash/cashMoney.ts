import { formatLempirasUIFromCents, parseCents, type Cents } from '@/lib/moneyCents';

/**
 * Etiqueta única para un importe de caja ausente o mal formado.
 * Cero legítimo se conserva; "no disponible" nunca se disfraza de `L 0.00`.
 */
export const CASH_AMOUNT_FALLBACK = 'No disponible';

/**
 * Normaliza un importe de caja (decimal de intercambio o número) a centavos.
 * Ausente o mal formado → `null`, nunca `0`; `'0.00'` sí es un cero legítimo.
 */
export function cashAmountCents(value: string | number | null | undefined): Cents | null {
  return parseCents(value ?? null);
}

/**
 * Normaliza un importe de caja **con signo** (decimal de intercambio o número)
 * a centavos enteros. A diferencia de `cashAmountCents`, acepta un signo
 * negativo inicial porque los movimientos de caja codifican reversos y
 * devoluciones como `"-17.25"` (ver `VoidPaymentAction`). Ausente o mal
 * formado → `null`, nunca `0`.
 */
export function cashSignedAmountCents(value: string | number | null | undefined): Cents | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return parseCents(value);
  }

  const trimmed = value.trim();
  const negative = trimmed.startsWith('-');
  const cents = parseCents(negative ? trimmed.slice(1) : trimmed);

  if (cents === null) {
    return null;
  }

  return (negative ? -cents : cents) as Cents;
}

/**
 * Formatea centavos en superficies que no pueden montar `MoneyText`
 * (CSV, mensajes de alerta). Ausente → "No disponible".
 */
export function formatCashCents(cents: number | null | undefined): string {
  return formatLempirasUIFromCents(cents) ?? CASH_AMOUNT_FALLBACK;
}

/**
 * Diferencia con signo humano a partir de centavos: "+ L 5.00", "- L 5.00".
 * Ausente → "No disponible"; cero legítimo → "L 0.00", nunca un faltante/sobrante
 * inventado.
 */
export function formatSignedCashCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) {
    return CASH_AMOUNT_FALLBACK;
  }

  if (cents === 0) {
    return formatCashCents(0);
  }

  const magnitude = formatLempirasUIFromCents(Math.abs(cents));

  if (magnitude === null) {
    return CASH_AMOUNT_FALLBACK;
  }

  return `${cents > 0 ? '+' : '-'} ${magnitude}`;
}
