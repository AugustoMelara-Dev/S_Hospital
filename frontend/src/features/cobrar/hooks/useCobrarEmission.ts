import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  apiClient,
  ApiError,
  institutionalReceipts,
  userSafeErrorMessage,
  type Invoice,
  type InvoicePayload,
  type Payment,
} from '@/lib/api';
import { payloadScopedIdempotencyKey, resetPayloadScopedIdempotencyKey } from '@/lib/api/idempotency';
import { parseCents } from '@/lib/moneyCents';
import { queryKeys } from '@/lib/queryKeys';
import { interpretPaymentOutcome } from '@/modules/billing/application/paymentOutcome';
import type { OperationalStatusReporter } from '@/app/operationalStatus';
import type { CobrarResult } from '../state/types';

export type CobrarSubmitOutcome = { ok: true } | { ok: false; message: string };

type SubmitInput = {
  payload: InvoicePayload;
  method: Payment['method'];
  reference: string;
};

type UseCobrarEmissionArgs = {
  cashSessionId: number | null;
  canCreatePayments: boolean;
  canViewReceipts: boolean;
  onStatus: OperationalStatusReporter;
};

/**
 * Orquesta emisión + pago / emisión sin cobro.
 *
 * - La emisión usa el cliente API existente, que adjunta `Idempotency-Key`;
 *   la clave es estable por payload para que un reintento no duplique factura.
 * - Si la factura se emite y el pago falla, queda `pendiente` y se reintenta
 *   el pago sin volver a emitir.
 * - Un total 0 válido emite el comprobante institucional sin registrar pago.
 */
export function useCobrarEmission({
  cashSessionId,
  canCreatePayments,
  canViewReceipts,
  onStatus,
}: UseCobrarEmissionArgs) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<CobrarResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [invoiceResolutionPending, setInvoiceResolutionPending] = useState(false);
  const inFlightRef = useRef(false);
  const invoiceKeyRef = useRef<string | null>(null);
  const invoiceSignatureRef = useRef<string | null>(null);
  const paymentKeyRef = useRef<string | null>(null);
  const paymentSignatureRef = useRef<string | null>(null);
  const receiptKeyRef = useRef<string | null>(null);
  const receiptSignatureRef = useRef<string | null>(null);

  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.cashSessions.current('own') }),
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all, refetchType: 'none' }),
    ]);
  }, [queryClient]);

  const issueZeroTotalReceipt = useCallback(
    async (invoice: Invoice): Promise<Pick<CobrarResult, 'receipt' | 'receiptRecovery'>> => {
      if (!canViewReceipts) {
        return {
          receipt: null,
          receiptRecovery:
            'Factura emitida sin cobro. Su usuario no puede emitir el comprobante; solicite apoyo a caja.',
        };
      }

      try {
        const receipt = await institutionalReceipts.store(
          {
            invoice_id: invoice.id,
            ...(cashSessionId !== null ? { cash_session_id: cashSessionId } : {}),
          },
          {
            idempotencyKey: payloadScopedIdempotencyKey(receiptKeyRef, receiptSignatureRef, {
              zeroReceipt: invoice.id,
            }),
          },
        );
        resetPayloadScopedIdempotencyKey(receiptKeyRef, receiptSignatureRef);

        return { receipt, receiptRecovery: null };
      } catch (error) {
        return {
          receipt: null,
          receiptRecovery: `Factura emitida, pero el recibo institucional quedó pendiente: ${userSafeErrorMessage(
            error,
            'No se pudo emitir el recibo institucional.',
          )}`,
        };
      }
    },
    [canViewReceipts, cashSessionId],
  );

  const payInvoice = useCallback(
    async (
      invoice: Invoice,
      method: Payment['method'],
      reference: string,
    ): Promise<CobrarSubmitOutcome> => {
      if (!canCreatePayments || cashSessionId === null) {
        setResult({ invoice, outcome: 'pending', receipt: null, receiptRecovery: null, method: null, paidAt: null });
        onStatus({
          message: `Factura ${invoice.invoice_number} emitida y pendiente de cobro.`,
          level: 'warning',
          key: 'cobrar-payment',
          toast: false,
        });
        return { ok: true };
      }

      const payload = {
        cash_session_id: cashSessionId,
        method,
        amount: invoice.balance_due,
        reference: reference.trim() || null,
      };

      try {
        const response = await apiClient.registerPayment(invoice.id, payload, {
          idempotencyKey: payloadScopedIdempotencyKey(paymentKeyRef, paymentSignatureRef, {
            invoiceId: invoice.id,
            payload,
          }),
        });
        resetPayloadScopedIdempotencyKey(paymentKeyRef, paymentSignatureRef);
        await invalidate();

        const outcome = interpretPaymentOutcome(response);

        if (outcome.kind === 'receipt_ready') {
          setResult({
            invoice: response.invoice,
            outcome: 'paid',
            receipt: outcome.receipt,
            receiptRecovery: null,
            method,
            paidAt: response.payment.paid_at,
          });
          onStatus({
            message: `Pago registrado. Recibo institucional ${outcome.receipt.receipt_number_full} listo para ver o imprimir.`,
            level: 'success',
            key: 'cobrar-payment',
            toast: false,
          });
          return { ok: true };
        }

        if (outcome.kind === 'receipt_recovery') {
          setResult({
            invoice: response.invoice,
            outcome: 'paid',
            receipt: null,
            receiptRecovery: outcome.message,
            method,
            paidAt: response.payment.paid_at,
          });
          onStatus({ message: outcome.message, level: 'warning', key: 'cobrar-payment', toast: false });
          return { ok: true };
        }

        setResult({
          invoice: response.invoice,
          outcome: 'pending',
          receipt: null,
          receiptRecovery: null,
          method,
          paidAt: null,
        });
        onStatus({ message: outcome.message, level: 'warning', key: 'cobrar-payment', toast: false });
        return { ok: true };
      } catch (error) {
        const message = userSafeErrorMessage(
          error,
          'No se pudo registrar el pago. La factura quedó emitida y pendiente de cobro.',
        );
        setResult({ invoice, outcome: 'pending', receipt: null, receiptRecovery: null, method: null, paidAt: null });
        /* El error se emite una sola vez: junto a la acción, como role="alert"
           en SummaryActionZone. No se duplica en la banda superior del shell,
           que es neutra y no distingue un error (C4-VISUAL MEDIUM). */
        return { ok: false, message };
      }
    },
    [canCreatePayments, cashSessionId, invalidate, onStatus],
  );

  const submit = useCallback(
    async ({ payload, method, reference }: SubmitInput): Promise<CobrarSubmitOutcome> => {
      if (inFlightRef.current) {
        return { ok: false, message: 'Ya hay una emisión en curso.' };
      }

      inFlightRef.current = true;
      setSubmitting(true);
      setResult(null);

      try {
        const invoice = await apiClient.createInvoice(payload, {
          idempotencyKey: payloadScopedIdempotencyKey(invoiceKeyRef, invoiceSignatureRef, payload),
        });
        setInvoiceResolutionPending(false);
        resetPayloadScopedIdempotencyKey(invoiceKeyRef, invoiceSignatureRef);
        await invalidate();

        if (parseCents(invoice.total) === 0) {
          const receiptPart = await issueZeroTotalReceipt(invoice);
          setResult({ invoice, outcome: 'sin_cobro', method: null, paidAt: null, ...receiptPart });
          onStatus({
            message: receiptPart.receiptRecovery ?? `Factura ${invoice.invoice_number} emitida sin cobro.`,
            level: receiptPart.receiptRecovery ? 'warning' : 'success',
            key: 'cobrar-emission',
            toast: false,
          });
          return { ok: true };
        }

        return await payInvoice(invoice, method, reference);
      } catch (error) {
        const responseIsDefinitiveClientError =
          error instanceof ApiError
          && error.status >= 400
          && error.status < 500
          && (error.status !== 409 || error.code === 'RESTORE_RECONCILIATION_PENDING');
        const requiresResolution = !responseIsDefinitiveClientError;

        setInvoiceResolutionPending(requiresResolution);
        const baseMessage = userSafeErrorMessage(error, 'No se pudo emitir la factura.');
        const message = requiresResolution
          ? `${baseMessage} Reintente esta misma operación para consultar el resultado antes de cambiar la cuenta.`
          : baseMessage;
        /* Mismo criterio que en payInvoice: el fallo de emisión vive solo en
           la alerta inline junto a la acción; la banda no lo repite. */
        return { ok: false, message };
      } finally {
        inFlightRef.current = false;
        setSubmitting(false);
      }
    },
    [invalidate, issueZeroTotalReceipt, onStatus, payInvoice],
  );

  const retryPayment = useCallback(
    async (method: Payment['method'], reference: string): Promise<CobrarSubmitOutcome> => {
      if (!result || result.outcome !== 'pending') {
        return { ok: false, message: 'No hay una operación pendiente de cobro.' };
      }

      if (inFlightRef.current) {
        return { ok: false, message: 'Ya hay una operación en curso.' };
      }

      inFlightRef.current = true;
      setSubmitting(true);

      try {
        return await payInvoice(result.invoice, method, reference);
      } finally {
        inFlightRef.current = false;
        setSubmitting(false);
      }
    },
    [payInvoice, result],
  );

  const reset = useCallback(() => {
    setResult(null);
    setInvoiceResolutionPending(false);
    resetPayloadScopedIdempotencyKey(invoiceKeyRef, invoiceSignatureRef);
    resetPayloadScopedIdempotencyKey(paymentKeyRef, paymentSignatureRef);
    resetPayloadScopedIdempotencyKey(receiptKeyRef, receiptSignatureRef);
  }, []);

  return { result, submitting, invoiceResolutionPending, submit, retryPayment, reset };
}
