/**
 * Estimado PROVISIONAL de la cuenta del POS y disponibilidad de cobro.
 *
 * Frontera de dinero (R2-MONEY-FE):
 *  - Todo el cálculo ocurre en centavos enteros.
 *  - El resultado que viaja al estado de negocio son DECIMALES DE
 *    INTERCAMBIO ("1029.25"), nunca texto localizado ("1,029.25" /
 *    "L 1,029.25"). El formateo ocurre en la última capa.
 *  - Un precio o cantidad mal formados no se convierten en cero: se
 *    exponen como incidencia (`CartIssue`) y la disponibilidad queda
 *    `invalid`, lo que bloquea el cobro.
 *
 * El backend es la fuente de verdad fiscal: el total definitivo lo
 * confirma el servidor al emitir (`Invoice.total`). `computeSimpleEstimate`
 * solo previsualiza; no reemplaza la confirmación del servidor.
 */

import type { Service } from '../../../lib/api';
import {
  formatQuantityUnits,
  parseCents,
  parseQuantityUnits,
  toExchangeDecimal,
  type Cents,
  type ExchangeDecimal,
  type QuantityUnits,
} from '../../../lib/moneyCents';
import type { CartItem } from './cartTypes';

const ERYTHROPOIETIN_RULE = 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION';
const TAX_RATE_RE = /^\d+(\.\d{1,2})?$/;

export type InvoiceEstimate = {
  subtotal: ExchangeDecimal;
  exempt?: ExchangeDecimal;
  tax: ExchangeDecimal;
  total: ExchangeDecimal;
};

export type CartIssue = {
  kind: 'invalid_price' | 'invalid_quantity';
  serviceId: number;
  serviceName: string;
  raw: string;
  message: string;
};

export type CartUnavailableReason = 'tax_rate_missing' | 'tax_rate_invalid' | 'no_response';

/**
 * Estados de disponibilidad del total (mandato R2-MONEY-FE):
 *  - `estimated`    → total provisional confiable (cero legítimo incluido).
 *  - `calculating`  → aún no se conoce la tasa de impuesto.
 *  - `invalid`      → precio/cantidad mal formados (nunca cero).
 *  - `unavailable`  → falta el impuesto o no hay respuesta utilizable.
 *  - `disconnected` → no se pudo consultar la configuración al servidor.
 *  - `confirmed`    → el servidor ya emitió la factura; total confirmado.
 */
export type CartAvailability =
  | { status: 'estimated' }
  | { status: 'calculating'; message: string }
  | { status: 'invalid'; message: string; issues: CartIssue[] }
  | { status: 'unavailable'; reason: CartUnavailableReason; message: string }
  | { status: 'disconnected'; message: string }
  | { status: 'confirmed'; invoiceNumber: string };

export type CartAvailabilityOptions = {
  taxRate: string | null | undefined;
  settingsState: 'loading' | 'ready' | 'error';
  canMarkDialysisPrescription: boolean;
  /**
   * El POS no logró contactar al servidor local (ni caja ni catálogo). La
   * ausencia de respuesta no es un total cero: es un estado desconectado.
   */
  serverUnreachable?: boolean;
};

export function isCartChargeable(availability: CartAvailability): boolean {
  return availability.status === 'estimated';
}

export function cartAvailabilityBlockReason(availability: CartAvailability): string | null {
  switch (availability.status) {
    case 'estimated':
      return null;
    case 'confirmed':
      return 'Esta cuenta ya fue emitida.';
    case 'calculating':
      return availability.message;
    case 'invalid':
      return availability.message;
    case 'unavailable':
      return availability.message;
    case 'disconnected':
      return availability.message;
  }
}

/**
 * Evalúa si el total puede mostrarse/cobrarse. No recalcula importes: eso
 * lo hace `computeSimpleEstimate` (único cálculo de la frontera).
 */
export function resolveCartAvailability(
  items: CartItem[],
  options: CartAvailabilityOptions,
): CartAvailability {
  if (options.serverUnreachable === true) {
    return {
      status: 'disconnected',
      message: 'Sin conexión con el servidor local. No se puede calcular ni confirmar el total; reintente cuando el servidor responda.',
    };
  }

  if (options.settingsState === 'loading' && hasTaxableLines(items)) {
    return { status: 'calculating', message: 'Calculando el total; espere antes de emitir.' };
  }

  if (options.settingsState === 'error') {
    return {
      status: 'disconnected',
      message: 'Sin conexión con el servidor local; no se pudo confirmar el impuesto.',
    };
  }

  const issues = collectCartIssues(items);

  if (issues.length > 0) {
    return {
      status: 'invalid',
      message: 'Hay un importe o una cantidad mal formados. Corríjalos antes de emitir.',
      issues,
    };
  }

  if (items.length > 0 && hasTaxableLines(items) && parseTaxRateBasisPoints(options.taxRate) === null) {
    const missing = options.taxRate === null || options.taxRate === undefined || String(options.taxRate).trim() === '';

    return {
      status: 'unavailable',
      reason: missing ? 'tax_rate_missing' : 'tax_rate_invalid',
      message: missing
        ? 'El servidor no informó la tasa de impuesto; no se puede confirmar el total.'
        : 'La tasa de impuesto configurada no es válida; no se puede confirmar el total.',
    };
  }

  return { status: 'estimated' };
}

/**
 * Estimado provisional en decimales de intercambio. Único cálculo de la
 * frontera: el preview del POS lo consume tal cual y el formateo ocurre
 * en la última capa.
 *
 * Redondeo HALF_AWAY_FROM_ZERO alineado con el backend:
 *  - línea: `(unitPriceCents * quantityUnits + 50) / 100`
 *  - ISV:   `(taxableSubtotalCents * rateBasisPoints + 5000) / 10000`
 */
export function computeSimpleEstimate(items: CartItem[], taxRate?: string | null): InvoiceEstimate {
  const rateBasisPoints = parseTaxRateBasisPoints(taxRate) ?? 0;
  const invoiceDialysis = items.some(
    (item) => item.dialysisPrescription && isErythropoietin(item.service),
  );
  let subtotal = 0;
  let taxableSubtotal = 0;
  let exemptSubtotal = 0;

  for (const item of items) {
    const unitPrice = unitPriceCents(item, invoiceDialysis);
    const quantityUnits = parseQuantityUnits(item.quantity);

    // La disponibilidad ya bloquea estos casos; el estimado no inventa
    // un cero silencioso: devuelve la línea en cero sin impuesto y deja
    // que la capa de disponibilidad impida cobrar.
    if (unitPrice === null || quantityUnits === null) {
      continue;
    }

    const lineSubtotal = Math.trunc(((unitPrice * quantityUnits) + 50) / 100);
    subtotal += lineSubtotal;

    if (isTaxableForPreview(item.service)) {
      taxableSubtotal += lineSubtotal;
    } else {
      exemptSubtotal += lineSubtotal;
    }
  }

  const tax = Math.trunc((((taxableSubtotal * rateBasisPoints) + 5000) / 10_000));

  return {
    subtotal: toExchangeDecimal(subtotal as Cents),
    exempt: toExchangeDecimal(exemptSubtotal as Cents),
    tax: toExchangeDecimal(tax as Cents),
    total: toExchangeDecimal((subtotal + tax) as Cents),
  };
}

export function parseTaxRateBasisPoints(taxRate: string | null | undefined): number | null {
  if (taxRate === null || taxRate === undefined) {
    return null;
  }

  const trimmed = taxRate.trim();

  if (trimmed === '' || !TAX_RATE_RE.test(trimmed)) {
    return null;
  }

  return Math.round(Number(trimmed) * 100);
}

export function collectCartIssues(items: CartItem[]): CartIssue[] {
  const issues: CartIssue[] = [];

  for (const item of items) {
    if (parseCents(item.service.price) === null) {
      issues.push({
        kind: 'invalid_price',
        serviceId: item.service.id,
        serviceName: item.service.name,
        raw: String(item.service.price),
        message: `El precio de "${item.service.name}" no es un importe válido.`,
      });
    }

    if (parseQuantityUnits(item.quantity) === null) {
      issues.push({
        kind: 'invalid_quantity',
        serviceId: item.service.id,
        serviceName: item.service.name,
        raw: item.quantity,
        message: `La cantidad de "${item.service.name}" debe ser mayor que cero y con hasta dos decimales.`,
      });
    }
  }

  return issues;
}

/**
 * Suma una unidad entera a una cantidad canónica expresada como texto de
 * entrada. Devuelve el texto original si la cantidad no es interpretable
 * (no la convierte en cero).
 */
export function incrementQuantityFromString(value: string): string {
  const units = parseQuantityUnits(value);

  if (units === null) {
    return value;
  }

  return formatQuantityUnits((units + 100) as QuantityUnits);
}

function unitPriceCents(item: CartItem, invoiceDialysis: boolean): Cents | null {
  if (invoiceDialysis && isErythropoietin(item.service)) {
    return 0 as Cents;
  }

  return parseCents(item.service.price);
}

function hasTaxableLines(items: CartItem[]): boolean {
  return items.some((item) => isTaxableForPreview(item.service));
}

function isTaxableForPreview(service: Service): boolean {
  return service.taxable;
}

function isErythropoietin(service: Service): boolean {
  return service.special_rule_code === ERYTHROPOIETIN_RULE;
}
