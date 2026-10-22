/**
 * Frontera canónica de dinero y cantidades.
 *
 * Un solo tipo y un solo camino por concepto:
 *
 *  - `Cents`            → dinero en centavos enteros. Único representante
 *                         de un importe cuando se hacen cuentas.
 *  - `QuantityUnits`    → cantidad en centésimas de unidad (2 decimales),
 *                         entera. Nunca floats.
 *  - `ExchangeDecimal`  → texto decimal plano ("1029.25") para la API y
 *                         para el estado de negocio (estimados, montos de
 *                         entrada). Nunca lleva separador de miles ni
 *                         prefijo "L".
 *  - `LocalizedMoney`   → texto localizado ("L 1,029.25"). Solo lo
 *                         producen los formateadores, en la última capa.
 *
 * Reglas duras:
 *  - Un valor no disponible (`null`/`undefined`/no finito) se devuelve
 *    como `null`, JAMÁS como "L 0.00". Cero legítimo y "no disponible"
 *    no son lo mismo; la capa que presenta decide (p. ej. "No disponible").
 *  - Un texto localizado (con coma de miles o prefijo "L") es inválido
 *    como entrada de dinero: es un error de frontera, no un cero.
 *  - Nada de `Number(x) || 0` ni `?? 0`: un dato mal formado no se
 *    disfraza de cero.
 *
 * Display policy (DECISIONS.md):
 *  - UI:      "L 1,234.50"  → formatLempirasUIFromCents (única función UI)
 *  - Recibo:  "L. 1,234.50" → formatLempirasFromCents (superficie de
 *             recibo, consumida por hs-receipts)
 */

import { formatLempirasReceipt, formatLempirasUI } from './money';

export { finiteNumber, formatLempirasReceipt, formatLempirasUI } from './money';

declare const centsBrand: unique symbol;
declare const quantityBrand: unique symbol;
declare const exchangeBrand: unique symbol;
declare const localizedBrand: unique symbol;

/** Dinero en centavos enteros. */
export type Cents = number & { readonly [centsBrand]: 'Cents' };
/** Cantidad en centésimas de unidad (2 decimales). */
export type QuantityUnits = number & { readonly [quantityBrand]: 'QuantityUnits' };
/** Decimal de intercambio: "1029.25". Sin separador de miles ni prefijo. */
export type ExchangeDecimal = string & { readonly [exchangeBrand]: 'ExchangeDecimal' };
/** Texto localizado de dinero: "L 1,029.25". Solo salida de formato. */
export type LocalizedMoney = string & { readonly [localizedBrand]: 'LocalizedMoney' };

const MONEY_INPUT_RE = /^\d+(\.\d{1,2})?$/;
const QUANTITY_INPUT_RE = /^\d+(\.\d{1,2})?$/;

/**
 * Convierte dinero entrante (decimal de intercambio o número) a centavos.
 * Devuelve `null` para cualquier dato mal formado o no disponible.
 * Rechaza deliberadamente textos localizados ("1,029.25", "L 1,029.25"):
 * esos no son una entrada válida, son un error de frontera.
 */
export function parseCents(value: string | number | null | undefined): Cents | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }

    return Math.round(value * 100) as Cents;
  }

  const trimmed = value.trim();

  if (trimmed === '' || !MONEY_INPUT_RE.test(trimmed)) {
    return null;
  }

  return Math.round(Number(trimmed) * 100) as Cents;
}

/**
 * Reetiqueta un entero de centavos que YA viene en centavos (p. ej. los
 * `*_cents` de la prevalidación del servidor). No multiplica por 100: no es
 * una entrada de intercambio como `parseCents`, es un entero ya calculado.
 */
export function asCents(value: number | null | undefined): Cents | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  return Math.trunc(value) as Cents;
}

/** Igual que `parseCents`, pero exige estrictamente un importe > 0. */
export function parsePositiveCents(value: string | number | null | undefined): Cents | null {
  const cents = parseCents(value);

  if (cents === null || cents <= 0) {
    return null;
  }

  return cents;
}

/**
 * Serializa centavos al decimal de intercambio que espera la API y el
 * estado de negocio (p. ej. "1029.25"). No es una representación localizada.
 */
export function toExchangeDecimal(cents: number): ExchangeDecimal {
  return (Math.trunc(cents) / 100).toFixed(2) as ExchangeDecimal;
}

/**
 * ÚNICA función de formato de dinero para la UI: "L 1,029.25".
 * Un importe no disponible devuelve `null`; la capa de presentación decide
 * cómo mostrarlo (nunca como "L 0.00").
 */
export function formatLempirasUIFromCents(cents: number | null | undefined): LocalizedMoney | null {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) {
    return null;
  }

  return formatLempirasUI(Math.trunc(cents) / 100) as LocalizedMoney;
}

/**
 * Formato de recibo institucional "L. 1,234.50". Superficie de recibo
 * (hs-receipts); conserva su contrato previo.
 */
export function formatLempirasFromCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) {
    return 'L. 0.00';
  }

  return formatLempirasReceipt(Math.trunc(cents) / 100);
}

/**
 * Convierte cantidad entrante a centésimas de unidad (entero).
 * Rechaza cero, negativos y texto mal formado con `null`.
 */
export function parseQuantityUnits(value: string | number | null | undefined): QuantityUnits | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }

    return Math.round(value * 100) as QuantityUnits;
  }

  const trimmed = value.trim();

  if (trimmed === '' || !QUANTITY_INPUT_RE.test(trimmed)) {
    return null;
  }

  const units = Math.round(Number(trimmed) * 100);

  return units > 0 ? (units as QuantityUnits) : null;
}

/**
 * Formatea cantidades canónicas (centésimas) para la UI: "2.50".
 * Devuelve `''` cuando la cantidad no está disponible.
 */
export function formatQuantityUnits(units: number | null | undefined, fractionDigits = 2): string {
  if (units === null || units === undefined || !Number.isFinite(units)) {
    return '';
  }

  return (Math.trunc(units) / 100).toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/**
 * Formatea un conteo decimal agregado del servidor (reportes: "Cantidad").
 * Concepto distinto a `QuantityUnits`: aquí no hay centésimas enteras.
 */
export function formatDecimalQuantity(value: number | string | null | undefined, fractionDigits = 2): string {
  if (value === null || value === undefined) {
    return '';
  }

  const numeric = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    return '';
  }

  return numeric.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}
