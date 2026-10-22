import type {
  InstitutionalReceipt,
  Invoice,
  InvoiceFilters,
  InvoiceItem,
  PaginatedMeta,
  Payment,
  ReceiptPrintProfile,
} from '@/lib/api';
import { parseCents } from '@/lib/moneyCents';
import type { AdminStatus } from '@/design-system/admin/components';

/**
 * Modelo de presentacion de Recibos.
 *
 * Traduce la operacion (factura + pagos + comprobante) al vocabulario real del
 * mostrador: tipo de documento emitido, estado de pago textual y ajuste por
 * regla. No calcula dinero ni decide permisos: el backend es la autoridad.
 */

/* -------------------------------------------------------------------------- */
/* Documento vinculado                                                        */
/* -------------------------------------------------------------------------- */

export type RecibosDocumentKind =
  | 'institutional'
  | 'pending_receipt'
  | 'without_receipt'
  | 'void';

export type RecibosDocumentView = {
  kind: RecibosDocumentKind;
  /** Tipo real de documento, sin obligar a entender tablas internas. */
  label: string;
  detail: string;
  receiptNumber: string | null;
};

export function issuedReceipt(
  invoice: Invoice,
): NonNullable<Invoice['institutional_receipt']> | null {
  return invoice.institutional_receipt?.status === 'issued'
    ? invoice.institutional_receipt
    : null;
}

export function documentView(invoice: Invoice): RecibosDocumentView {
  const receipt = issuedReceipt(invoice);

  if (receipt) {
    return {
      kind: 'institutional',
      label: 'Comprobante institucional',
      detail: receipt.receipt_number_full,
      receiptNumber: receipt.receipt_number_full,
    };
  }

  if (invoice.status === 'void') {
    return {
      kind: 'void',
      label: 'Sin comprobante',
      detail: 'No emitido',
      receiptNumber: null,
    };
  }

  if (invoice.status === 'paid' || invoice.status === 'partial') {
    return {
      kind: 'pending_receipt',
      label: 'Comprobante pendiente',
      detail: 'Cobro registrado sin PDF institucional',
      receiptNumber: null,
    };
  }

  return {
    kind: 'without_receipt',
    label: 'Sin comprobante',
    detail: 'Aún no emitido',
    receiptNumber: null,
  };
}

/* -------------------------------------------------------------------------- */
/* Estado de pago textual                                                     */
/* -------------------------------------------------------------------------- */

export type RecibosPaymentStateView = {
  status: AdminStatus;
  label: string;
};

export function paymentStateView(invoice: Invoice): RecibosPaymentStateView {
  if (invoice.status === 'void') {
    return { status: 'anulado', label: 'Anulada' };
  }

  if (invoice.status === 'paid') {
    return parseCents(invoice.total) === 0
      ? { status: 'gratuito', label: 'Emitida sin cobro' }
      : { status: 'cobrado', label: 'Cobrada' };
  }

  if (invoice.status === 'partial') {
    return { status: 'valorada', label: 'Pago parcial' };
  }

  return { status: 'listo', label: 'Pendiente de cobro' };
}

export const PAYMENT_METHOD_LABELS: Record<Payment['method'], string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  other: 'Otro',
};

export function paymentMethodLabel(method: Payment['method']): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

export function paymentStatusLabel(payment: Payment): string {
  return payment.status === 'void' ? 'Pago anulado' : 'Pago registrado';
}

/* -------------------------------------------------------------------------- */
/* Lineas y ajuste por regla                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Lectura defensiva del contrato de ajuste por línea.
 *
 * `InvoiceItem` ya declara `unit_price_registered_cents`, `rule_adjustment_cents`
 * y `rule_adjustment_persisted` (contrato C2-B8, `GET /api/invoices/{id}`), pero
 * el detalle puede responder desde versiones anteriores o desde reimpresiones ya
 * emitidas. Este tipo local tolera además que el campo falte o llegue como
 * texto, y `RecibosLine` reemplaza las declaraciones del API por las laxas:
 * nunca se inventa ni se deriva el ajuste desde el catálogo vigente.
 */
export type RecibosLineAdjustmentFields = {
  unit_price_registered_cents?: number | string | null;
  rule_adjustment_cents?: number | string | null;
  rule_adjustment_persisted?: boolean | null;
};

export type RecibosLine = Omit<InvoiceItem, keyof RecibosLineAdjustmentFields> & RecibosLineAdjustmentFields;

/** Texto unico para un ajuste historico que el servidor no entrego. */
export const LINE_ADJUSTMENT_UNAVAILABLE = 'Dato histórico no disponible';

export type RecibosLineAdjustment =
  /** Ajuste real por linea: magnitud positiva de centavos. */
  | { kind: 'adjustment'; cents: number }
  /** La linea no lleva ajuste (columna vacia, nunca un cero pintado). */
  | { kind: 'none' }
  /** La linea participa de una regla pero el ajuste no llego: no se inventa. */
  | { kind: 'unavailable' };

/**
 * Lee `rule_adjustment_cents` sin confundir ausencia con cero. Devuelve `null`
 * cuando el campo no viene o no es numerico; los centavos enteros cuando si
 * viene.
 */
function readRuleAdjustmentCents(item: RecibosLine): number | null {
  const raw = item.rule_adjustment_cents;

  if (raw === null || raw === undefined) return null;

  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Math.trunc(raw) : null;
  }

  const trimmed = raw.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;

  return Math.trunc(Number(trimmed));
}

/** Una linea participa de la regla cuando el backend lo marca o lo codifica. */
function hasRuleEvidence(item: Pick<InvoiceItem, 'special_rule_applied' | 'special_rule_code'>): boolean {
  return item.special_rule_applied || Boolean(item.special_rule_code);
}

/**
 * Ajuste mostrable de una linea.
 *
 * Reglas, en orden:
 *  1. Magnitud positiva entregada por el servidor ⇒ ajuste real.
 *  2. Ajuste declarado como no persistido (`rule_adjustment_persisted === false`,
 *     documento histórico) o campo ausente ⇒ un cero NO se pinta: si la línea
 *     participa de una regla, la celda declara «Dato histórico no disponible».
 *  3. Cero persistido o ausencia en una línea sin regla ⇒ sin ajuste («—»).
 */
export function lineAdjustmentView(item: RecibosLine): RecibosLineAdjustment {
  const cents = readRuleAdjustmentCents(item);

  if (cents !== null && cents > 0) {
    return { kind: 'adjustment', cents };
  }

  const unknown = item.rule_adjustment_persisted === false || cents === null;

  return unknown && hasRuleEvidence(item) ? { kind: 'unavailable' } : { kind: 'none' };
}

/** Etiqueta de la regla en lenguaje de mostrador, sin codigos internos. */
export function itemAdjustmentLabel(item: InvoiceItem): string | null {
  if (item.special_rule_applied) {
    return 'Sin cobro por receta de diálisis · solo este medicamento';
  }

  if (item.special_rule_code) {
    return 'Regla de gratuidad evaluada en la línea: esta línea se cobra';
  }

  return null;
}

export function hasRuleAdjustment(invoice: Invoice): boolean {
  return invoice.items?.some((item) => item.special_rule_applied) ?? false;
}

/* -------------------------------------------------------------------------- */
/* Impresión: ejemplares                                                      */
/* -------------------------------------------------------------------------- */

export function copiesFromMode(mode: ReceiptPrintProfile['copies_mode'] | undefined): number | null {
  switch (mode) {
    case 'original_only':
      return 1;
    case 'original_first':
      return 2;
    case 'original_first_second':
      return 3;
    default:
      return null;
  }
}

export function copiesLabel(copies: number | null): string {
  if (copies === null) {
    return 'las configuradas en el perfil de impresión institucional (por defecto 1 ejemplar)';
  }

  return `${copies} ${copies === 1 ? 'ejemplar' : 'ejemplares'}`;
}

/**
 * Aviso breve mostrado antes de abrir el PDF. Explica el efecto operativo sin
 * exponer límites internos de composición ni prometer un número de páginas.
 */
export function printInfoText(
  copies: number | null,
  copiesMode?: InstitutionalReceipt['copy_mode'],
): string {
  const resolvedCopies = copies ?? copiesFromMode(copiesMode);

  return `Se abrirá el PDF con ${copiesLabel(resolvedCopies)}. Esta acción no registra otro cobro ni emite otro número de recibo.`;
}

/* -------------------------------------------------------------------------- */
/* Conteo de resultados                                                       */
/* -------------------------------------------------------------------------- */

export function resultCountLabel(total: number): string {
  return `${total} ${total === 1 ? 'operación' : 'operaciones'}`;
}

/**
 * Rango visible de la pagina actual (`1–10 de 42`). Acompana a la paginacion
 * para que el cajero sepa que parte del historial esta viendo, sin repetir el
 * total como un segundo contador.
 */
export function resultRangeLabel(meta: Pick<PaginatedMeta, 'current_page' | 'per_page' | 'total'>): string {
  if (meta.total === 0) return 'Sin operaciones';

  const from = (meta.current_page - 1) * meta.per_page + 1;
  const to = Math.min(meta.current_page * meta.per_page, meta.total);

  return `${from}–${to} de ${meta.total}`;
}

/* -------------------------------------------------------------------------- */
/* Barra de filtros: opciones y resumen de lo aplicado                        */
/* -------------------------------------------------------------------------- */

export const STATUS_FILTER_OPTIONS: ReadonlyArray<{ value: InvoiceFilters['status']; label: string }> = [
  { value: '', label: 'Todos los estados' },
  { value: 'issued', label: 'Emitida · pendiente de cobro' },
  { value: 'partial', label: 'Pago parcial' },
  { value: 'paid', label: 'Pagada' },
  { value: 'void', label: 'Anulada' },
];

export type RecibosActiveFilter = {
  key: string;
  label: string;
};

/** `2026-09-18` → `18/09/2026`, sin reinterpretar la fecha como UTC. */
function shortDateLabel(value: string): string {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

/**
 * Resume los filtros aplicados como contexto de cabecera. Son etiquetas de
 * lectura, no controles: limpiar o ajustar sigue viviendo en la barra de filtros
 * y en los estados vacios.
 */
export function activeFilterChips(filters: InvoiceFilters): RecibosActiveFilter[] {
  const chips: RecibosActiveFilter[] = [];
  const text = filters.invoice_number || filters.patient;

  if (text) {
    chips.push({
      key: 'query',
      label: filters.invoice_number ? `Documento ${filters.invoice_number}` : `Paciente ${text}`,
    });
  }

  if (filters.date_from && filters.date_to) {
    chips.push({ key: 'range', label: `${shortDateLabel(filters.date_from)} – ${shortDateLabel(filters.date_to)}` });
  } else if (filters.date_from) {
    chips.push({ key: 'range', label: `Desde ${shortDateLabel(filters.date_from)}` });
  } else if (filters.date_to) {
    chips.push({ key: 'range', label: `Hasta ${shortDateLabel(filters.date_to)}` });
  }

  const status = STATUS_FILTER_OPTIONS.find((option) => option.value === (filters.status ?? ''));
  if (status?.value) chips.push({ key: 'status', label: status.label });

  if (filters.cash_session_id) chips.push({ key: 'cash', label: `Caja #${filters.cash_session_id}` });
  if (filters.balance_state === 'pending') chips.push({ key: 'balance', label: 'Saldo pendiente' });
  if (filters.receipt_state === 'missing') chips.push({ key: 'receipt', label: 'Comprobante pendiente' });

  return chips;
}
