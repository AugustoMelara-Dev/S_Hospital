import type { CartItem } from '@/features/invoices/state/cartTypes';
import type { InstitutionalReceipt, Invoice, Payment } from '@/lib/api';

/**
 * Estado local de Cobrar. La UI previsualiza; el backend decide totales.
 *
 * La línea reutiliza `CartItem` (mismo contrato que la valoración/preview del
 * POS existente) para no divergir del cálculo de dinero ni del payload.
 */
export type CobrarLine = CartItem;

export type CobrarCategoryFilter = number | 'all';

export type CobrarResultOutcome = 'paid' | 'sin_cobro' | 'pending';

export type CobrarResult = {
  invoice: Invoice;
  outcome: CobrarResultOutcome;
  receipt: InstitutionalReceipt | null;
  /** Causa textual cuando el comprobante no se pudo emitir tras facturar. */
  receiptRecovery: string | null;
  method: Payment['method'] | null;
  paidAt: string | null;
};
