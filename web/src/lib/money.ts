/**
 * Money helpers. Money is ALWAYS integer cents (SPEC §2). Never use floats
 * for amounts: parsing works on the decimal string, not on parseFloat.
 */

const CURRENCY = 'L';

function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function assertCents(cents: number): void {
  if (!Number.isSafeInteger(cents)) {
    throw new TypeError(`Monto inválido (se esperaban centavos enteros): ${String(cents)}`);
  }
}

/** Plain amount without currency: 123450 → "1,234.50". */
export function formatAmount(cents: number): string {
  assertCents(cents);
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const text = `${groupThousands(String(whole))}.${String(frac).padStart(2, '0')}`;
  return negative ? `-${text}` : text;
}

/** 123400 → "L 1,234.00"; -500 → "-L 5.00". `null`/`undefined` → "No disponible". */
export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return 'No disponible';
  const amount = formatAmount(Math.abs(cents));
  return cents < 0 ? `-${CURRENCY} ${amount}` : `${CURRENCY} ${amount}`;
}

/**
 * Parses user input like "1,234.50", "L 1234.5", "  25 " into integer cents.
 * Returns `null` for empty or invalid input (more than 2 decimals, letters,
 * negative numbers, multiple dots).
 */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.replace(/^\s*L\s*/i, '').replace(/[\s,]/g, '');
  if (cleaned === '' || cleaned === '.') return null;
  const match = /^(\d*)(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match) return null;
  const whole = match[1] === '' || match[1] === undefined ? '0' : match[1];
  const frac = (match[2] ?? '').padEnd(2, '0');
  if (whole.length > 13) return null;
  const cents = Number(whole) * 100 + Number(frac);
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Cents → editable text for an input: 123450 → "1,234.50"; 0 → "0.00". */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '';
  return formatAmount(cents);
}

/** Quantity helpers (quantity_hundredths: 1.5 units = 150). */
export function parseQuantityToHundredths(input: string): number | null {
  const cleaned = input.replace(/[\s,]/g, '');
  if (cleaned === '') return null;
  const match = /^(\d*)(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match) return null;
  const whole = match[1] === '' || match[1] === undefined ? '0' : match[1];
  if (whole.length > 7) return null;
  const value = Number(whole) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return value;
}

/** 150 → "1.5"; 100 → "1"; 125 → "1.25". */
export function formatHundredths(hundredths: number): string {
  const whole = Math.floor(hundredths / 100);
  const frac = hundredths % 100;
  if (frac === 0) return String(whole);
  return `${whole}.${String(frac).padStart(2, '0').replace(/0$/, '')}`;
}

/** Basis points → "15 %". */
export function formatRateBp(bp: number): string {
  const whole = Math.floor(bp / 100);
  const frac = bp % 100;
  const text = frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, '0').replace(/0$/, '')}`;
  return `${text} %`;
}
