import { useCallback, type Dispatch } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { apiClient, type ReceiptData, userSafeErrorMessage } from '../../../lib/api';
import type { NewInvoiceAction, NewInvoiceState } from '../state/types';

export type UsePaymentLifecycleArgs = {
  state: NewInvoiceState;
  dispatch: Dispatch<NewInvoiceAction>;
  onStatus: (message: string) => void;
  queryClient: QueryClient;
};

export type UsePaymentLifecycleResult = {
  submitPayment: (appliedAmount?: string) => Promise<void>;
  loadReceipt: (width: ReceiptData['width']) => Promise<void>;
  handlePaymentOpenChange: (nextOpen: boolean) => void;
  handleReceiptOpenChange: (nextOpen: boolean) => void;
};

export function usePaymentLifecycle({
  state,
  dispatch,
  onStatus,
  queryClient,
}: UsePaymentLifecycleArgs): UsePaymentLifecycleResult {
  const submitPayment = useCallback(
    async (appliedAmount = state.paymentAmount) => {
      if (!state.issuedInvoice || !state.loadedCashSession) {
        dispatch({ type: 'SET_SHOW_PAYMENT', payload: false });
        return;
      }
      const invoiceToPay = state.issuedInvoice;
      const sessionToUse = state.loadedCashSession;
      dispatch({ type: 'SET_PAYING', payload: true });
      dispatch({ type: 'SET_SHOW_PAYMENT', payload: false });
      try {
        const result = await apiClient.registerPayment(invoiceToPay.id, {
          cash_session_id: sessionToUse.id,
          method: state.paymentMethod,
          amount: appliedAmount,
        });
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        queryClient.invalidateQueries({ queryKey: ['cash-sessions'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        dispatch({ type: 'SET_ISSUED_INVOICE', payload: result.invoice });
        dispatch({ type: 'SET_PAYMENT_AMOUNT', payload: result.invoice.balance_due });
        const nextReceipt = await apiClient.getReceipt(result.invoice.id, state.receiptWidth);
        dispatch({ type: 'SET_RECEIPT', payload: nextReceipt });
        dispatch({ type: 'SET_RECEIPT_WIDTH', payload: nextReceipt.width });
        dispatch({ type: 'SET_AUTO_PRINT_RECEIPT', payload: !state.previewBeforePrint });
        dispatch({ type: 'SET_SHOW_RECEIPT', payload: true });
        dispatch({ type: 'SET_ALERT_MESSAGE', payload: null });
        dispatch({ type: 'SET_WARNING_MESSAGE', payload: null });
        onStatus(
          state.previewBeforePrint
            ? `Pago registrado. Vista previa ${nextReceipt.invoice.invoice_number} lista.`
            : `Pago registrado. Recibo ${nextReceipt.invoice.invoice_number} enviado a impresión.`,
        );
      } catch (error) {
        const message = userSafeErrorMessage(error, 'No se pudo registrar el pago.');
        dispatch({ type: 'SET_ALERT_MESSAGE', payload: message });
        onStatus(message);
      } finally {
        dispatch({ type: 'SET_PAYING', payload: false });
      }
    },
    [state.issuedInvoice, state.loadedCashSession, state.paymentMethod, state.paymentAmount, state.receiptWidth, state.previewBeforePrint, dispatch, onStatus, queryClient],
  );

  const loadReceipt = useCallback(
    async (width: ReceiptData['width']) => {
      dispatch({ type: 'SET_RECEIPT_WIDTH', payload: width });
      if (!state.issuedInvoice) return;
      try {
        const nextReceipt = await apiClient.getReceipt(state.issuedInvoice.id, width);
        dispatch({ type: 'SET_RECEIPT', payload: nextReceipt });
        dispatch({ type: 'SET_SHOW_RECEIPT', payload: true });
      } catch (error) {
        onStatus(userSafeErrorMessage(error, 'No se pudo generar el recibo.'));
      }
    },
    [state.issuedInvoice, dispatch, onStatus],
  );

  const handlePaymentOpenChange = useCallback(
    (nextOpen: boolean) => {
      dispatch({ type: 'SET_SHOW_PAYMENT', payload: nextOpen });
      if (!nextOpen && state.issuedInvoice && (state.issuedInvoice.status === 'issued' || state.issuedInvoice.status === 'partial')) {
        dispatch({ type: 'SET_SHOW_SUCCESS', payload: true });
        dispatch({
          type: 'SET_WARNING_MESSAGE',
          payload: `Factura ${state.issuedInvoice.invoice_number} emitida. Quedo pendiente de cobro; puede cobrarla desde este panel o desde Historial.`,
        });
        onStatus(`Factura ${state.issuedInvoice.invoice_number} emitida y pendiente de cobro.`);
      }
    },
    [state.issuedInvoice, dispatch, onStatus],
  );

  const handleReceiptOpenChange = useCallback(
    (nextOpen: boolean) => {
      dispatch({ type: 'SET_SHOW_RECEIPT', payload: nextOpen });
      if (!nextOpen && (state.issuedInvoice?.status === 'paid' || state.issuedInvoice?.status === 'partial')) {
        dispatch({ type: 'SET_AUTO_PRINT_RECEIPT', payload: false });
        dispatch({ type: 'SET_SHOW_SUCCESS', payload: true });
      }
    },
    [state.issuedInvoice, dispatch],
  );

  return {
    submitPayment,
    loadReceipt,
    handlePaymentOpenChange,
    handleReceiptOpenChange,
  };
}
