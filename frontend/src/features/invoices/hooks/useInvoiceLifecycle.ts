import { useCallback, type Dispatch, type RefObject } from 'react';
import { apiClient, userSafeErrorMessage } from '../../../lib/api';
import { isZeroMoney } from '../state/posMath';
import { invoiceSchema } from '../../../schemas/invoice.schema';
import type { NewInvoiceAction, NewInvoiceState } from '../state/types';

export type UseInvoiceLifecycleArgs = {
  state: NewInvoiceState;
  dispatch: Dispatch<NewInvoiceAction>;
  onStatus: (message: string) => void;
  canCreatePayments: boolean;
  canViewReceipts: boolean;
  patientInputRef: RefObject<HTMLInputElement | null>;
};

export type UseInvoiceLifecycleResult = {
  validateForm: () => boolean;
  handleEmitClick: () => void;
  submitInvoice: () => Promise<void>;
  handleNuevaFactura: () => void;
  handleCobrarClick: () => void;
};

export function useInvoiceLifecycle({
  state,
  dispatch,
  onStatus,
  canCreatePayments,
  canViewReceipts,
  patientInputRef,
}: UseInvoiceLifecycleArgs): UseInvoiceLifecycleResult {
  const validateForm = useCallback((): boolean => {
    if (!state.loadedCashSession) {
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: 'Abra caja antes de emitir y cobrar una factura.' });
      onStatus('Abra caja antes de emitir y cobrar una factura.');
      return false;
    }
    const validationResult = invoiceSchema.safeParse({
      patient_name: state.patientName,
      items: state.cartItems.map((item) => ({
        service_id: item.service.id,
        quantity: item.quantity,
        dialysis_prescription: item.dialysisPrescription,
      })),
    });
    if (!validationResult.success) {
      const formatted = validationResult.error.format();
      if (formatted.patient_name) {
        const errMsg = formatted.patient_name._errors[0] || 'Ingrese el nombre del paciente para emitir la factura.';
        dispatch({ type: 'SET_PATIENT_ERROR', payload: errMsg });
        patientInputRef.current?.focus();
        return false;
      }
      if (formatted.items) {
        const errMsg = formatted.items._errors?.[0] || 'Seleccione al menos un servicio para emitir la factura.';
        dispatch({ type: 'SET_ALERT_MESSAGE', payload: errMsg });
        onStatus(errMsg);
        return false;
      }
      const fallbackMsg = validationResult.error.issues[0]?.message || 'Datos de factura inválidos';
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: fallbackMsg });
      onStatus(fallbackMsg);
      return false;
    }
    return true;
  }, [onStatus, state.cartItems, state.loadedCashSession, state.patientName, dispatch, patientInputRef]);

  const handleEmitClick = useCallback(() => {
    dispatch({ type: 'SET_ALERT_MESSAGE', payload: null });
    if (!validateForm()) return;
    dispatch({ type: 'SET_SHOW_CONFIRMATION', payload: true });
  }, [validateForm, dispatch]);

  const submitInvoice = useCallback(async () => {
    dispatch({ type: 'SET_SUBMITTING', payload: true });
    dispatch({ type: 'SET_SHOW_CONFIRMATION', payload: false });
    dispatch({ type: 'SET_ALERT_MESSAGE', payload: null });
    dispatch({ type: 'SET_WARNING_MESSAGE', payload: null });
    try {
      const invoice = await apiClient.createInvoice({
        patient_name: state.patientName,
        items: state.cartItems.map((item) => ({
          service_id: item.service.id,
          quantity: item.quantity,
          dialysis_prescription: item.dialysisPrescription,
        })),
      });
      dispatch({ type: 'SET_ISSUED_INVOICE', payload: invoice });
      dispatch({ type: 'SET_PAYMENT_AMOUNT', payload: '0.00' });
      dispatch({ type: 'SET_RECEIPT', payload: null });
      dispatch({ type: 'SET_AUTO_PRINT_RECEIPT', payload: false });
      dispatch({ type: 'SET_CART_ITEMS', payload: [] });
      dispatch({ type: 'SET_PATIENT_NAME', payload: '' });
      if (state.loadedCashSession && parseLocalCents(invoice.balance_due) > 0) {
        dispatch({ type: 'SET_SHOW_SUCCESS', payload: false });
        dispatch({ type: 'SET_SHOW_PAYMENT', payload: true });
        onStatus(`Factura emitida ${invoice.invoice_number}. Cobro abierto.`);
      } else if (isZeroMoney(invoice.total) && invoice.status === 'paid') {
        const nextReceipt = await apiClient.getReceipt(invoice.id, state.receiptWidth);
        dispatch({ type: 'SET_RECEIPT', payload: nextReceipt });
        dispatch({ type: 'SET_RECEIPT_WIDTH', payload: nextReceipt.width });
        dispatch({ type: 'SET_SHOW_RECEIPT', payload: true });
        onStatus(`Factura emitida ${invoice.invoice_number}. Recibo listo para imprimir.`);
      } else {
        dispatch({ type: 'SET_SHOW_SUCCESS', payload: true });
        onStatus(`Factura emitida ${invoice.invoice_number}.`);
      }
    } catch (error) {
      const message = userSafeErrorMessage(error, 'No se pudo emitir la factura.');
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: message });
      onStatus(message);
    } finally {
      dispatch({ type: 'SET_SUBMITTING', payload: false });
    }
  }, [dispatch, onStatus, state.cartItems, state.loadedCashSession, state.patientName, state.receiptWidth]);

  const handleNuevaFactura = useCallback(() => {
    dispatch({ type: 'RESET_FORM', payload: { loadedCashSession: state.loadedCashSession } });
    window.setTimeout(() => patientInputRef.current?.focus(), 0);
  }, [dispatch, state.loadedCashSession, patientInputRef]);

  const handleCobrarClick = useCallback(() => {
    if (!state.issuedInvoice || !state.loadedCashSession) {
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: 'Debe abrir caja antes de cobrar.' });
      return;
    }
    if (!canCreatePayments || !canViewReceipts) {
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: 'Este usuario no tiene permisos completos para cobrar e imprimir recibos.' });
      return;
    }
    dispatch({ type: 'SET_SHOW_SUCCESS', payload: false });
    dispatch({ type: 'SET_WARNING_MESSAGE', payload: null });
    if (!state.paymentAmount || Number(state.paymentAmount) <= 0) {
      dispatch({ type: 'SET_PAYMENT_AMOUNT', payload: '0.00' });
    }
    dispatch({ type: 'SET_SHOW_PAYMENT', payload: true });
  }, [state.issuedInvoice, state.loadedCashSession, state.paymentAmount, canCreatePayments, canViewReceipts, dispatch]);

  return {
    validateForm,
    handleEmitClick,
    submitInvoice,
    handleNuevaFactura,
    handleCobrarClick,
  };
}

function parseLocalCents(value: string): number {
  const [integer, decimal = '00'] = value.split('.');
  return Number(integer) * 100 + Number(decimal.padEnd(2, '0').slice(0, 2));
}
