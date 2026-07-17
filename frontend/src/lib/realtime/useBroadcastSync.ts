import { useEffect } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { getEcho } from './echo';
import { useFeedback } from '@/design-system/providers/FeedbackProvider';
import { invalidateBillingQueries } from '@/lib/queryInvalidation';
import { queryKeys } from '@/lib/queryKeys';
import type {
  CashSessionChangedEvent,
  InvoiceChangedEvent,
  PaymentChangedEvent,
} from './types';

const INVOICE_EVENT = 'invoice.changed';
const PAYMENT_EVENT = 'payment.changed';
const CASH_EVENT = 'cash-session.changed';

function isInvoiceChanged(payload: unknown): payload is InvoiceChangedEvent {
  return !!payload && typeof payload === 'object' && 'id' in payload && 'change' in payload;
}

function isPaymentChanged(payload: unknown): payload is PaymentChangedEvent {
  return !!payload && typeof payload === 'object' && 'invoice_id' in payload;
}

function isCashChanged(payload: unknown): payload is CashSessionChangedEvent {
  return !!payload && typeof payload === 'object' && 'id' in payload && 'change' in payload;
}

function humanInvoice(payload: InvoiceChangedEvent): string {
  if (payload.change === 'created') return 'Factura emitida.';
  if (payload.change === 'voided') return 'Factura anulada.';
  if (payload.change === 'reversed') return 'Factura reversada.';

  return 'Factura actualizada.';
}

function humanPayment(payload: PaymentChangedEvent): string {
  return payload.change === 'registered' ? 'Pago registrado.' : 'Pago reversado.';
}

function humanCash(payload: CashSessionChangedEvent): string {
  const verb = payload.change === 'opened' ? 'Caja abierta' : 'Caja cerrada';
  return `${verb} #${payload.id}.`;
}

/**
 * Subscribe to the cashier-facing broadcast channels and invalidate
 * the relevant TanStack Query keys when an event arrives. Also emits
 * a toast for cashier situational awareness.
 *
 * Designed to be mounted once at the AppShell level. Channel
 * authorization is enforced server-side; the client trusts the
 * backend to refuse subscriptions for users without the right
 * permission.
 */
export function useBroadcastSync(): void {
  const queryClient = useQueryClient();
  const feedback = useFeedback();

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const echo = await getEcho();
      if (!echo || cancelled) return;

      const onInvoice = (payload: unknown) => {
        if (!isInvoiceChanged(payload)) return;
        void invalidateBillingQueries(queryClient);
        if (payload.change === 'voided' || payload.change === 'reversed') {
          feedback.warning(humanInvoice(payload));
        } else if (payload.change === 'created') {
          feedback.info(humanInvoice(payload));
        }
      };

      const onPayment = (payload: unknown) => {
        if (!isPaymentChanged(payload)) return;
        void invalidateBillingQueries(queryClient);
        if (payload.change === 'registered') {
          feedback.success(humanPayment(payload));
        } else {
          feedback.warning(humanPayment(payload));
        }
      };

      const onCash = (payload: unknown) => {
        if (!isCashChanged(payload)) return;
        queryClient.invalidateQueries({ queryKey: queryKeys.cashSessions.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.reports.dashboard() });
        if (payload.change === 'opened') {
          feedback.info(humanCash(payload));
        } else {
          feedback.warning(humanCash(payload));
        }
      };

      const channelInvoices: ReturnType<typeof echo.private> = echo.private('invoices');
      (channelInvoices as { listen: (event: string, cb: (p: unknown) => void) => void })
        .listen(INVOICE_EVENT, onInvoice);

      const channelCash: ReturnType<typeof echo.private> = echo.private('cash');
      (channelCash as { listen: (event: string, cb: (p: unknown) => void) => void })
        .listen(CASH_EVENT, onCash);

      const channelPayments: ReturnType<typeof echo.private> = echo.private('payments');
      (channelPayments as { listen: (event: string, cb: (p: unknown) => void) => void })
        .listen(PAYMENT_EVENT, onPayment);

      cleanup = () => {
        (channelInvoices as { stopListening: (event: string, cb: (p: unknown) => void) => void })
          .stopListening(INVOICE_EVENT, onInvoice);
        (channelCash as { stopListening: (event: string, cb: (p: unknown) => void) => void })
          .stopListening(CASH_EVENT, onCash);
        (channelPayments as { stopListening: (event: string, cb: (p: unknown) => void) => void })
          .stopListening(PAYMENT_EVENT, onPayment);
        echo.leave('invoices');
        echo.leave('cash');
        echo.leave('payments');
      };
    })();

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [feedback, queryClient]);
}
