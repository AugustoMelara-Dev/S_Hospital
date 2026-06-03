import { STRINGS, type Strings } from './es-HN';

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function lookupPath(root: AnyRecord, path: string): unknown {
  const segments = path.split('.');
  let cursor: unknown = root;
  for (const segment of segments) {
    if (!isRecord(cursor)) {
      return undefined;
    }
    cursor = cursor[segment];
  }
  return cursor;
}

/**
 * Look up a user-visible string by dotted path.
 *
 * Examples:
 *   t()                            -> STRINGS (dictionary)
 *   t('invoices.payment.title')    -> 'Registrar pago'
 *   t('invoices.missing.key')      -> 'invoices.missing.key' (safe fallback)
 *
 * The helper never throws so a missing translation never breaks the
 * cashier screen; the key is rendered verbatim and surfaces in QA.
 */
export function t(): Strings;
export function t(key: string): string;
export function t(key?: string): Strings | string {
  if (key === undefined) {
    return STRINGS;
  }
  const value = lookupPath(STRINGS as unknown as AnyRecord, key);
  return typeof value === 'string' ? value : key;
}

export { STRINGS };
export type { Strings };
