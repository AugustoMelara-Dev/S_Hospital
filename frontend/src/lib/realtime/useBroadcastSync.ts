import { useEffect } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { getEcho } from './echo';
import { notify } from '../../components/ui/toaster';
import { getStoredUserId } from './session';
import type {
  CashSessionChangedEvent,
  InvoiceChangedEvent,
  PaymentChangedEvent,
} from './types';

const INVOICE_EVENT = 'invoice.changed';
const PAYMENT_EVENT = 'payment.changed';
const CASH_EVENT = 'cash-session.changed';

function isInvoiceChanged(payload: unknown): payload is InvoiceChangedEvent {
  return !!payload && typeof payload === 'object' && 'invoice_number' in payload;
}

function isPaymentChanged(payload: unknown): payload is PaymentChangedEvent {
  return !!payload && typeof payload === 'object' && 'invoice_id' in payload;
}

function isCashChanged(payload: unknown): payload is CashSessionChangedEvent {
  return !!payload && typeof payload === 'object' && 'cash_session_id' in payload
    || (!!payload && typeof payload === 'object' && 'opened_at' in payload);
}

function humanInvoice(payload: InvoiceChangedEvent): string {
  const verb =
    payload.change === 'created'
      ? 'Factura emitida'
      : payload.change === 'voided'
        ? 'Factura anulada'
        : payload.change === 'reversed'
          ? 'Factura reversada'
          : 'Factura actualizada';
  return `${verb} ${payload.invoice_number} (${payload.patient_name}).`;
}

function humanPayment(payload: PaymentChangedEvent): string {
  const verb = payload.change === 'registered' ? 'Pago registrado' : 'Pago reversado';
  return `${verb} L. ${payload.amount} (${payload.method}).`;
}

function humanCash(payload: CashSessionChangedEvent): string {
  const verb = payload.change === 'opened' ? 'Caja abierta' : 'Caja cerrada';
  return `${verb} #${payload.id}.`;
}

/**
 * Returns true when the event originated from the currently logged-in
 * cashier. We still apply the query invalidation because the cashier's
 * own UI may have missed a refetch in the meantime, but we suppress the
 * toast to avoid telling them something they just did.
 */
function isOwnEvent(actorId: number | null | undefined, currentUserId: number | null): boolean {
  if (actorId === null || actorId === undefined) {
    return false;
  }
  if (currentUserId === null) {
    return false;
  }
  return actorId === currentUserId;
}

/**
 * Exposed for unit testing only. Determines whether a broadcast event
 * originated from the current cashier.
 */
export const __test__isOwnEvent = isOwnEvent;

function shouldNotifyBroadcast(actorId: number | null | undefined): boolean {
  return !isOwnEvent(actorId, getStoredUserId());
}

export const __test__shouldNotifyBroadcast = shouldNotifyBroadcast;

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

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const echo = await getEcho();
      if (!echo || cancelled) return;

      const onInvoice = (payload: unknown) => {
        if (!isInvoiceChanged(payload)) return;
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        if (!shouldNotifyBroadcast(payload.actor_id)) {
          return;
        }
        if (payload.change === 'voided' || payload.change === 'reversed') {
          notify.warning(humanInvoice(payload));
        } else if (payload.change === 'created') {
          notify.info(humanInvoice(payload));
        }
      };

      const onPayment = (payload: unknown) => {
        if (!isPaymentChanged(payload)) return;
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['cash-sessions'] });
        if (!shouldNotifyBroadcast(payload.actor_id)) {
          return;
        }
        if (payload.change === 'registered') {
          notify.success(humanPayment(payload));
        } else {
          notify.warning(humanPayment(payload));
        }
      };

      const onCash = (payload: unknown) => {
        if (!isCashChanged(payload)) return;
        queryClient.invalidateQueries({ queryKey: ['cash-sessions'] });
        if (!shouldNotifyBroadcast(payload.actor_id)) {
          return;
        }
        if (payload.change === 'opened') {
          notify.info(humanCash(payload));
        } else {
          notify.warning(humanCash(payload));
        }
      };

      const channelInvoices: ReturnType<typeof echo.channel> = echo.channel('invoices');
      (channelInvoices as { listen: (event: string, cb: (p: unknown) => void) => void })
        .listen(INVOICE_EVENT, onInvoice);
      (channelInvoices as { listen: (event: string, cb: (p: unknown) => void) => void })
        .listen(PAYMENT_EVENT, onPayment);

      const channelCash: ReturnType<typeof echo.channel> = echo.channel('cash');
      (channelCash as { listen: (event: string, cb: (p: unknown) => void) => void })
        .listen(CASH_EVENT, onCash);

      const channelPayments: ReturnType<typeof echo.channel> = echo.channel('payments');
      (channelPayments as { listen: (event: string, cb: (p: unknown) => void) => void })
        .listen(PAYMENT_EVENT, onPayment);

      cleanup = () => {
        (channelInvoices as { stopListening: (event: string, cb: (p: unknown) => void) => void })
          .stopListening(INVOICE_EVENT, onInvoice);
        (channelInvoices as { stopListening: (event: string, cb: (p: unknown) => void) => void })
          .stopListening(PAYMENT_EVENT, onPayment);
        (channelCash as { stopListening: (event: string, cb: (p: unknown) => void) => void })
          .stopListening(CASH_EVENT, onCash);
        (channelPayments as { stopListening: (event: string, cb: (p: unknown) => void) => void })
          .stopListening(PAYMENT_EVENT, onPayment);
        echo.leaveChannel('invoices');
        echo.leaveChannel('cash');
        echo.leaveChannel('payments');
      };
    })();

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [queryClient]);
}
