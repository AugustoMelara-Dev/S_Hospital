import { parseCents } from '@/lib/moneyCents';
import type { CashSession, Invoice, TodayReport } from '@/lib/api';
import type { AdminStatus } from '@/design-system/admin/components';

/**
 * Modelo puro del Resumen (T-UI-02).
 *
 * Separa cohortes explicitamente: "emitido" mide facturas por fecha de emision,
 * "cobrado" mide pagos posteados por fecha de cobro (puede incluir facturas
 * emitidas antes) y "saldo al corte" mide el saldo de las facturas emitidas en
 * el periodo. Nunca se asume `facturado - cobrado = saldo`.
 */

/**
 * Centavos de un importe decimal de la API para presentación. Delega en
 * `parseCents` (frontera canónica de dinero): `null`, `undefined`, `''` o un
 * texto mal formado devuelven `null` → `MoneyText` lo muestra como
 * "No disponible", nunca `0` ni `L 0.00`.
 *
 * No es una conversión con `Number()`: un dato ausente/mal formado no se
 * disfraza de cero.
 */
export function apiMoneyCents(value: string | number | null | undefined): number | null {
  return parseCents(value);
}

/**
 * Importe con signo (p. ej. `difference_amount` de caja, que puede ser un
 * faltante negativo). `parseCents` es deliberadamente no negativo; aquí solo
 * se separa el signo y se delega la magnitud a la frontera canónica, de modo
 * que un valor ausente o mal formado sigue siendo `null` (nunca `0`).
 */
export function signedMoneyCents(value: string | number | null | undefined): number | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('-')) {
      const magnitude = parseCents(trimmed.slice(1));
      return magnitude === null ? null : -magnitude;
    }
  }

  return parseCents(value);
}

/**
 * Total de una operación en centavos. Un `total` ausente, vacío o mal formado
 * no es un cero legítimo: la celda cae a "No disponible".
 */
export function invoiceTotalCents(invoice: Pick<Invoice, 'total'>): number | null {
  return apiMoneyCents(invoice.total);
}

export type ResumenMetricKind = 'money' | 'count';

export type ResumenMetric = {
  key: 'emitido' | 'cobrado' | 'saldo' | 'sinCobro';
  label: string;
  kind: ResumenMetricKind;
  valueCents: number | null;
  valueCount: number | null;
  /**
   * Contexto breve que se lee de un vistazo junto a la cifra (cohorte y fecha).
   * Nunca una definición contable extensa: eso vive en `detail`.
   */
  context: string;
  /**
   * Definición extensa de la métrica, disponible bajo demanda (detalle
   * desplegable). Conserva el significado contable sin ocupar la superficie.
   */
  detail: string;
  tone: 'default' | 'success' | 'warn';
};

/**
 * Una operacion "sin cobro" es una factura con total L 0. El backend persiste
 * esas facturas con `status = paid` (CreateInvoiceAction), por lo que filtrar
 * `status=paid` y contar `total_cents = 0` identifica exactamente las
 * operaciones emitidas sin cobro. No es "pendiente" ni "parcial".
 */
export function isZeroTotalInvoice(invoice: Pick<Invoice, 'total'>): boolean {
  const cents = parseCents(invoice.total);
  return cents !== null && cents === 0;
}

export function countZeroTotalInvoices(invoices: Array<Pick<Invoice, 'total'>>): number {
  return invoices.filter(isZeroTotalInvoice).length;
}

export type OperationDisplay = {
  label: string;
  adminStatus: AdminStatus;
};

/** Estado textual de una operacion reciente, sin depender solo del color. */
export function operationDisplay(invoice: Pick<Invoice, 'status' | 'total'>): OperationDisplay {
  if (invoice.status === 'void') {
    return { label: 'Anulada', adminStatus: 'anulado' };
  }

  if (isZeroTotalInvoice(invoice)) {
    return { label: 'Emitida sin cobro', adminStatus: 'gratuito' };
  }

  if (invoice.status === 'paid') {
    return { label: 'Cobrada', adminStatus: 'cobrado' };
  }

  if (invoice.status === 'partial') {
    return { label: 'Parcial', adminStatus: 'valorada' };
  }

  return { label: 'Emitida pendiente', adminStatus: 'listo' };
}

export function reportScopeLabel(isManagerial: boolean): string {
  return isManagerial ? 'Todas las operaciones' : 'Tus operaciones';
}

/**
 * Define las cuatro metricas del corte con su cohorte y periodo. El conteo sin
 * cobro procede del mismo snapshot del servidor; si un servidor anterior no
 * expone el campo, se muestra "No disponible" y nunca se inventa cero.
 */
export function buildResumenMetrics(
  today: TodayReport,
): ResumenMetric[] {
  const day = today.date;
  const sinCobroCount =
    typeof today.without_charge_count === 'number'
    && Number.isInteger(today.without_charge_count)
    && today.without_charge_count >= 0
      ? today.without_charge_count
      : null;

  return [
    {
      key: 'emitido',
      label: 'Emitido / facturado',
      kind: 'money',
      valueCents: apiMoneyCents(today.billed),
      valueCount: null,
      context: `Emisión de ${day}`,
      detail:
        'Importe total de las facturas emitidas ese día que siguen vigentes. Las facturas anuladas no se cuentan.',
      tone: 'default',
    },
    {
      key: 'cobrado',
      label: 'Cobrado',
      kind: 'money',
      valueCents: apiMoneyCents(today.collected),
      valueCount: null,
      context: `Cobros de ${day}`,
      detail:
        'Pagos registrados ese día, en cualquier medio. El cobro de un día puede corresponder a operaciones emitidas antes, por eso no cuadra necesariamente con el emitido del mismo día.',
      tone: 'default',
    },
    {
      key: 'saldo',
      label: 'Saldo al corte',
      kind: 'money',
      valueCents: apiMoneyCents(today.pending),
      valueCount: null,
      context: `Por cobrar de la emisión de ${day}`,
      detail:
        'Parte todavía no pagada de las facturas emitidas ese día: pendientes y parciales. Es la deuda de esas operaciones, no la resta entre el emitido y el cobrado del día.',
      tone: 'default',
    },
    {
      key: 'sinCobro',
      label: 'Operaciones sin cobro',
      kind: 'count',
      valueCents: null,
      valueCount: sinCobroCount,
      context: `Emitidas el ${day} con total L 0.00`,
      detail:
        'Operaciones emitidas ese día cuyo total es L 0.00: no generan cobro ni quedan como saldo pendiente. No son operaciones pendientes ni parciales.',
      tone: 'default',
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* Atención ahora (T-UI-27)                                                   */
/* -------------------------------------------------------------------------- */

export type ResumenAttentionKey = 'pendientesCobro' | 'recibosInstitucionales' | 'caja';

/**
 * Un pendiente accionable del Resumen. `count` y `amountCents` son `null`
 * cuando el dato no existe o está mal formado: un ausente NUNCA se presenta
 * como `0` ni como `L 0.00`. `to` es el acceso directo a la superficie que
 * resuelve el pendiente.
 */
export type ResumenAttentionItem = {
  key: ResumenAttentionKey;
  label: string;
  count: number | null;
  amountCents: number | null;
  hint: string;
  tone: 'warn' | 'danger';
  to: string;
  ctaLabel: string;
};

/**
 * Cohorte de "pendientes de cobro". Cuando hay una sesión de caja abierta se
 * usa su cohorte (las facturas que bloquean el cierre, que pueden incluir días
 * anteriores); sin sesión abierta se cae a la cohorte del período (`hoy`). La
 * `scope` viaja al `hint` para no confundir ambas cohortes.
 */
export function pendingCollectionCohort(
  today: TodayReport,
  session: CashSession | null,
): { count: number | null; amountCents: number | null; scope: string } {
  if (session?.status === 'open') {
    return {
      count: session.pending_invoice_count ?? null,
      amountCents: apiMoneyCents(session.pending_amount),
      scope: 'la sesión de caja abierta',
    };
  }

  return {
    count: today.pending_invoice_count,
    amountCents: apiMoneyCents(today.pending_invoice_amount),
    scope: `la emisión de ${today.date}`,
  };
}

/**
 * Construye la franja "Atención ahora": pendientes de cobro, recibos
 * institucionales que bloquean el cierre y caja con una diferencia real.
 *
 * Devuelve `[]` cuando no hay nada que atender; la vista oculta el bloque en
 * ese caso. Un conteo o importe ausente no se inventa como cero.
 *
 * Una caja abierta durante el turno es el estado normal de la jornada, no una
 * incidencia: solo entra aquí cuando existe una diferencia ya registrada en el
 * arqueo, que sí exige una acción concreta.
 */
export function buildResumenAttention(
  today: TodayReport,
  session: CashSession | null,
): ResumenAttentionItem[] {
  const items: ResumenAttentionItem[] = [];

  const pending = pendingCollectionCohort(today, session);
  if (pending.count !== null && pending.count > 0) {
    items.push({
      key: 'pendientesCobro',
      label: 'Operaciones pendientes de cobro',
      count: pending.count,
      amountCents: pending.amountCents,
      hint: `Saldo por cobrar de ${pending.scope}.`,
      tone: 'warn',
      to: '/recibos',
      ctaLabel: 'Ver en Recibos',
    });
  }

  const missingReceipts =
    session?.status === 'open' ? session.missing_institutional_receipt_count : undefined;
  if (typeof missingReceipts === 'number' && missingReceipts > 0) {
    items.push({
      key: 'recibosInstitucionales',
      label: 'Recibos institucionales pendientes',
      count: missingReceipts,
      amountCents: null,
      hint: 'Bloquean el cierre de caja hasta emitirse.',
      tone: 'danger',
      to: '/recibos',
      ctaLabel: 'Emitir recibos',
    });
  }

  const differenceCents = signedMoneyCents(session?.difference_amount);
  if (differenceCents !== null && differenceCents !== 0) {
    items.push({
      key: 'caja',
      label: 'Caja con diferencia',
      count: null,
      amountCents: differenceCents,
      hint: 'Revise el arqueo y documente la diferencia antes de cerrar.',
      tone: 'danger',
      to: '/caja',
      ctaLabel: 'Ir a Caja',
    });
  }

  return items;
}
