import { useCallback, type Dispatch, type RefObject } from 'react';
import { invoiceSchema } from '@/schemas/invoice.schema';
import type { CashSession } from '@/lib/api';
import type { NewInvoiceAction, NewInvoiceState } from '../state/types';

type UseNewInvoiceValidationOptions = {
  cartItems: NewInvoiceState['cartItems'];
  dispatch: Dispatch<NewInvoiceAction>;
  loadedCashSession: CashSession | null;
  onStatus: (message: string) => void;
  patientInputRef: RefObject<HTMLInputElement | null>;
  patientName: string;
};

export function useNewInvoiceValidation({
  cartItems,
  dispatch,
  loadedCashSession,
  onStatus,
  patientInputRef,
  patientName,
}: UseNewInvoiceValidationOptions) {
  return useCallback((): boolean => {
    if (!loadedCashSession) {
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: 'Abra caja antes de emitir y cobrar una factura.' });
      onStatus('Abra caja antes de emitir y cobrar una factura.');
      return false;
    }

    const validationResult = invoiceSchema.safeParse({
      patient_name: patientName,
      dialysis_prescription: cartItems.some(item => item.dialysisPrescription),
      items: cartItems.map((item) => ({
        service_id: item.service.id,
        quantity: item.quantity,
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
  }, [cartItems, dispatch, loadedCashSession, onStatus, patientInputRef, patientName]);
}
