import type { Invoice, ReceiptData } from '../../../lib/api';
import { getIssuedInstitutionalReceipt } from '../../../modules/invoices/application/invoiceActionPolicy';

/**
 * Comprobante institucional vigente de una factura (solo estado `issued`).
 *
 * Este helper vivia en el legacy `InvoiceHistoryTable.tsx`. Al retirar esa
 * tabla sin ruta viva se reubico aqui, junto a las demas reglas de recibos del
 * historial, para conservar su unico consumidor real
 * (`useInvoiceHistoryReceipts`). No decide importes: es el mismo
 * `getIssuedInstitutionalReceipt` de la politica de acciones.
 */
export function issuedInstitutionalReceipt(
  invoice: Invoice,
): NonNullable<Invoice['institutional_receipt']> | null {
  return getIssuedInstitutionalReceipt(invoice);
}

export function latestPostedPayment(invoice: Invoice): NonNullable<Invoice['payments']>[number] | null {
  const postedPayments = invoice.payments?.filter((payment) => payment.status === 'posted') ?? [];

  return postedPayments
    .sort((first, second) => {
      const firstPaidAt = Date.parse(first.paid_at);
      const secondPaidAt = Date.parse(second.paid_at);
      const paidAtComparison = (Number.isNaN(secondPaidAt) ? 0 : secondPaidAt)
        - (Number.isNaN(firstPaidAt) ? 0 : firstPaidAt);

      return paidAtComparison !== 0 ? paidAtComparison : second.id - first.id;
    })[0] ?? null;
}

export function hasInstitutionalPrintEvents(receipt: NonNullable<Invoice['institutional_receipt']>): boolean {
  return receipt.has_print_events === true || (receipt.print_events_count ?? 0) > 0;
}

/**
 * Un recibo legacy ya etiquetado REIMPRESIÓN (#n) por el backend ya fue
 * auditado: imprimirlo desde el modal no debe volver a llamar al endpoint de
 * reimpresión. El primer documento llega como ORIGINAL (ver
 * ReprintReceiptAction del backend).
 */
export function isAuditedReprintReceipt(receipt: ReceiptData | null): boolean {
  return /reimpresi[oó]n/i.test(receipt?.institutional?.copy_label ?? '');
}

/**
 * F012/T3-004: el contador durable del backend decide si la impresión del
 * comprobante histórico es una primera impresión o una reimpresión.
 *
 * - El GET devuelve `legacy_reprint_count` sin incrementarlo y la etiqueta
 *   "Original": con 0 se imprime sin POST ni motivo; con n > 0 ya hubo
 *   reimpresiones auditadas, así que imprimir exige motivo humano y el POST
 *   devuelve `REIMPRESIÓN #n+1` con el número persistente.
 * - Un documento ya auditado (etiqueta REIMPRESIÓN recibida) se imprime tal
 *   cual sin repetir el POST.
 * - Sin marca del servidor (payload antiguo) rige el mismo criterio que 0:
 *   no se inventa una reimpresión.
 */
export function requiresLegacyReprintReason(receipt: ReceiptData | null): boolean {
  if (!receipt || isAuditedReprintReceipt(receipt)) return false;

  return (receipt.legacy_reprint_count ?? 0) > 0;
}
