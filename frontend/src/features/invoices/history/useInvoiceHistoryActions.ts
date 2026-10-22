import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  type Invoice,
  type Payment,
  apiClient,
  userSafeErrorMessage,
} from '../../../lib/api';
import { invalidateBillingQueries } from '@/lib/queryInvalidation';
import { payloadScopedIdempotencyKey, resetPayloadScopedIdempotencyKey } from '../../../lib/api/idempotency';
import type { OperationalStatusReporter } from '@/app/operationalStatus';

type UseInvoiceHistoryActionsOptions = {
  selectedInvoice: Invoice | null;
  setSelectedInvoice: Dispatch<SetStateAction<Invoice | null>>;
  synchronizeDetailInvoice: (invoice: Invoice) => void;
  clearReceipt: () => void;
  onStatus: OperationalStatusReporter;
};

/**
 * Acciones sensibles del historial (anular, revertir) y cobro de saldo.
 * Conserva validación de motivo, idempotencia por payload y bloqueo de doble
 * envío.
 */
export function useInvoiceHistoryActions({
  selectedInvoice,
  setSelectedInvoice,
  synchronizeDetailInvoice,
  clearReceipt,
  onStatus,
}: UseInvoiceHistoryActionsOptions) {
  const queryClient = useQueryClient();
  const [voidReason, setVoidReason] = useState('');
  const [reverseReason, setReverseReason] = useState('');
  const [voidReasonError, setVoidReasonError] = useState('');
  const [reverseReasonError, setReverseReasonError] = useState('');
  const [confirmingVoid, setConfirmingVoid] = useState(false);
  const [confirmingReverse, setConfirmingReverse] = useState(false);
  const [voidingInvoice, setVoidingInvoice] = useState(false);
  const [reversingInvoice, setReversingInvoice] = useState(false);
  const [collectionInvoice, setCollectionInvoice] = useState<Invoice | null>(null);
  const [collectionMethod, setCollectionMethod] = useState<Payment['method']>('cash');
  const [collectionAmount, setCollectionAmount] = useState('');
  const [collectionReference, setCollectionReference] = useState('');
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [collectingPayment, setCollectingPayment] = useState(false);
  const voidingInvoiceRef = useRef(false);
  const reversingInvoiceRef = useRef(false);
  const voidIdempotencyKeyRef = useRef<string | null>(null);
  const voidIdempotencySignatureRef = useRef<string | null>(null);
  const reverseIdempotencyKeyRef = useRef<string | null>(null);
  const reverseIdempotencySignatureRef = useRef<string | null>(null);
  const collectionIdempotencyKeyRef = useRef<string | null>(null);
  const collectionIdempotencySignatureRef = useRef<string | null>(null);
  const actionRequestRef = useRef(0);

  async function prepareInvoiceAction(invoiceId: number, action: 'void' | 'reverse') {
    const requestId = actionRequestRef.current + 1;
    actionRequestRef.current = requestId;

    try {
      const invoice = await apiClient.getInvoice(invoiceId);
      if (actionRequestRef.current !== requestId) return;

      setSelectedInvoice(invoice);
      clearReceipt();
      if (action === 'void') {
        setConfirmingVoid(true);
      } else {
        setConfirmingReverse(true);
      }
      onStatus({
        key: 'invoice-history:detail',
        level: 'info',
        message: `Factura ${invoice.invoice_number} cargada.`,
        toast: false,
      });
    } catch (error) {
      if (actionRequestRef.current === requestId) {
        onStatus({
          key: 'invoice-history:detail',
          level: 'error',
          message: userSafeErrorMessage(error, 'No se pudo cargar detalle.'),
          toast: false,
        });
      }
    }
  }

  function openPaymentCollection(invoice: Invoice) {
    setCollectionInvoice(invoice);
    setCollectionMethod('cash');
    setCollectionAmount(invoice.balance_due);
    setCollectionReference('');
    setCollectionError(null);
  }

  async function collectInvoicePayment(appliedAmount: string) {
    if (!collectionInvoice || collectingPayment) return;
    setCollectingPayment(true);
    setCollectionError(null);
    try {
      const cashSession = await apiClient.getCurrentCashSession();
      if (!cashSession || cashSession.status !== 'open') {
        setCollectionError('Abra caja antes de registrar el cobro.');
        return;
      }
      const payload = {
        cash_session_id: cashSession.id,
        method: collectionMethod,
        amount: appliedAmount,
        reference: collectionReference.trim() || null,
      };
      await apiClient.registerPayment(collectionInvoice.id, payload, {
        idempotencyKey: payloadScopedIdempotencyKey(
          collectionIdempotencyKeyRef,
          collectionIdempotencySignatureRef,
          { invoiceId: collectionInvoice.id, payload },
        ),
      });
      resetPayloadScopedIdempotencyKey(collectionIdempotencyKeyRef, collectionIdempotencySignatureRef);
      await invalidateBillingQueries(queryClient);
      onStatus({
        key: 'invoice-history:payment',
        level: 'success',
        message: `Cobro registrado para la factura ${collectionInvoice.invoice_number}.`,
        toast: false,
      });
      setCollectionInvoice(null);
    } catch (error) {
      setCollectionError(userSafeErrorMessage(error, 'No se pudo registrar el pago. Revise los datos e intente de nuevo.'));
    } finally {
      setCollectingPayment(false);
    }
  }

  async function voidSelectedInvoice() {
    if (voidingInvoiceRef.current) return;

    if (!selectedInvoice || voidReason.trim().length < 5) {
      const message = 'Ingrese un motivo de anulación de al menos 5 caracteres.';
      setVoidReasonError(message);
      onStatus({ key: 'invoice-history:void', level: 'warning', message, toast: false });

      return;
    }

    try {
      voidingInvoiceRef.current = true;
      setVoidingInvoice(true);
      setVoidReasonError('');
      const reason = voidReason.trim();
      const voided = await apiClient.voidInvoice(selectedInvoice.id, reason, {
        idempotencyKey: payloadScopedIdempotencyKey(voidIdempotencyKeyRef, voidIdempotencySignatureRef, {
          invoiceId: selectedInvoice.id,
          reason,
        }),
      });
      await invalidateBillingQueries(queryClient);
      setSelectedInvoice(voided);
      synchronizeDetailInvoice(voided);
      clearReceipt();
      setVoidReason('');
      setConfirmingVoid(false);
      resetPayloadScopedIdempotencyKey(voidIdempotencyKeyRef, voidIdempotencySignatureRef);
      onStatus({
        key: 'invoice-history:void',
        level: 'success',
        message: `Factura ${voided.invoice_number} anulada.`,
        toast: false,
      });
    } catch (error) {
      onStatus({
        key: 'invoice-history:void',
        level: 'error',
        message: userSafeErrorMessage(error, 'No se pudo anular la factura.'),
        toast: false,
      });
    } finally {
      voidingInvoiceRef.current = false;
      setVoidingInvoice(false);
    }
  }

  async function reverseSelectedInvoice() {
    if (reversingInvoiceRef.current) return;

    if (!selectedInvoice || reverseReason.trim().length < 5) {
      const message = 'Ingrese un motivo de reversión de al menos 5 caracteres.';
      setReverseReasonError(message);
      onStatus({ key: 'invoice-history:reverse', level: 'warning', message, toast: false });

      return;
    }

    try {
      reversingInvoiceRef.current = true;
      setReversingInvoice(true);
      setReverseReasonError('');
      const reason = reverseReason.trim();
      const reversed = await apiClient.reverseInvoice(selectedInvoice.id, reason, {
        idempotencyKey: payloadScopedIdempotencyKey(reverseIdempotencyKeyRef, reverseIdempotencySignatureRef, {
          invoiceId: selectedInvoice.id,
          reason,
        }),
      });
      await invalidateBillingQueries(queryClient);
      setSelectedInvoice(reversed);
      synchronizeDetailInvoice(reversed);
      clearReceipt();
      setReverseReason('');
      setConfirmingReverse(false);
      resetPayloadScopedIdempotencyKey(reverseIdempotencyKeyRef, reverseIdempotencySignatureRef);
      onStatus({
        key: 'invoice-history:reverse',
        level: 'success',
        message: `Factura ${reversed.invoice_number} revertida.`,
        toast: false,
      });
    } catch (error) {
      onStatus({
        key: 'invoice-history:reverse',
        level: 'error',
        message: userSafeErrorMessage(error, 'No se pudo revertir la factura.'),
        toast: false,
      });
    } finally {
      reversingInvoiceRef.current = false;
      setReversingInvoice(false);
    }
  }

  return {
    confirmingVoid,
    setConfirmingVoid,
    voidReason,
    setVoidReason,
    voidReasonError,
    setVoidReasonError,
    voidingInvoice,
    confirmingReverse,
    setConfirmingReverse,
    reverseReason,
    setReverseReason,
    reverseReasonError,
    setReverseReasonError,
    reversingInvoice,
    collectionInvoice,
    setCollectionInvoice,
    collectionMethod,
    setCollectionMethod,
    collectionAmount,
    setCollectionAmount,
    collectionReference,
    setCollectionReference,
    collectionError,
    setCollectionError,
    collectingPayment,
    prepareInvoiceAction,
    openPaymentCollection,
    collectInvoicePayment,
    voidSelectedInvoice,
    reverseSelectedInvoice,
  };
}
