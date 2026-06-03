import { useCallback, useMemo, type Dispatch, type RefObject } from 'react';
import { apiClient, type Service, userSafeErrorMessage } from '../../../lib/api';
import { computeSimpleEstimate } from '../state/posMath';
import type { NewInvoiceAction, NewInvoiceState } from '../state/types';

export type UsePosCartActionsArgs = {
  state: NewInvoiceState;
  dispatch: Dispatch<NewInvoiceAction>;
  onStatus: (message: string) => void;
  fiscalTaxRate: string | undefined;
  patientInputRef: RefObject<HTMLInputElement | null>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  scannerInputRef: RefObject<HTMLInputElement | null>;
};

export type UsePosCartActionsResult = {
  addToCart: (service: Service) => void;
  addByScanCode: () => Promise<void>;
  updateQuantity: (index: number, quantity: string) => void;
  updateDialysisPrescription: (index: number, checked: boolean) => void;
  removeItem: (index: number) => void;
  clearCart: () => void;
  handlePatientNameChange: (value: string) => void;
  handlePatientSubmit: () => void;
  emitBlockReasons: string[];
  canEmit: boolean;
  preview: { subtotal: string; tax: string; total: string };
};

export function usePosCartActions({
  state,
  dispatch,
  onStatus,
  fiscalTaxRate,
  patientInputRef,
  searchInputRef,
  scannerInputRef,
}: UsePosCartActionsArgs): UsePosCartActionsResult {
  const addToCart = useCallback(
    (service: Service) => {
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: null });
      dispatch({ type: 'SET_WARNING_MESSAGE', payload: null });
      const message = `Agregado: ${service.name}`;
      dispatch({ type: 'SET_SUCCESS_MESSAGE', payload: message });
      onStatus(message);
      window.setTimeout(() => {
        dispatch({ type: 'CLEAR_SUCCESS_MESSAGE', payload: message });
      }, 2200);
      dispatch({ type: 'ADD_TO_CART', payload: service });
    },
    [dispatch, onStatus],
  );

  const addByScanCode = useCallback(async () => {
    const code = state.scanCode.trim();
    const refocusScanner = () => window.setTimeout(() => scannerInputRef.current?.focus(), 0);
    if (code === '') {
      const message = 'Ingrese o escanee un codigo.';
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: message });
      onStatus(message);
      refocusScanner();
      return;
    }
    try {
      const [service] = await apiClient.getServices({ code, active: true, billing: true, perPage: 1 });
      if (!service) {
        const message = 'No se encontro servicio activo para este codigo.';
        dispatch({ type: 'SET_ALERT_MESSAGE', payload: message });
        onStatus(message);
        refocusScanner();
        return;
      }
      if (!service.active) {
        const message = 'El servicio esta inactivo y no puede facturarse.';
        dispatch({ type: 'SET_ALERT_MESSAGE', payload: message });
        onStatus(message);
        refocusScanner();
        return;
      }
      addToCart(service);
      dispatch({ type: 'SET_SCAN_CODE', payload: '' });
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: null });
      onStatus(`Servicio agregado por codigo: ${service.name}.`);
      refocusScanner();
    } catch (error) {
      const message = userSafeErrorMessage(error, 'No se pudo buscar el codigo escaneado.');
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: message });
      onStatus(message);
      refocusScanner();
    }
  }, [state.scanCode, dispatch, onStatus, addToCart, scannerInputRef]);

  const updateQuantity = useCallback(
    (index: number, quantity: string) => {
      dispatch({ type: 'UPDATE_QUANTITY', payload: { index, quantity } });
    },
    [dispatch],
  );

  const updateDialysisPrescription = useCallback(
    (index: number, checked: boolean) => {
      dispatch({ type: 'UPDATE_DIALYSIS', payload: { index, checked } });
    },
    [dispatch],
  );

  const removeItem = useCallback(
    (index: number) => {
      dispatch({ type: 'REMOVE_ITEM', payload: index });
    },
    [dispatch],
  );

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART_COMPLETELY' });
  }, [dispatch]);

  const handlePatientNameChange = useCallback(
    (value: string) => {
      dispatch({ type: 'SET_PATIENT_NAME', payload: value });
      if (state.patientError && value.trim()) {
        dispatch({ type: 'SET_PATIENT_ERROR', payload: undefined });
      }
    },
    [dispatch, state.patientError],
  );

  const handlePatientSubmit = useCallback(() => {
    if (state.patientName.trim() === '') {
      dispatch({ type: 'SET_PATIENT_ERROR', payload: 'Ingrese el nombre del paciente para continuar.' });
      patientInputRef.current?.focus();
      return;
    }
    dispatch({ type: 'SET_PATIENT_ERROR', payload: undefined });
    searchInputRef.current?.focus();
  }, [state.patientName, dispatch, patientInputRef, searchInputRef]);

  const emitBlockReasons = useMemo(
    () =>
      [
        !state.loadedCashSession ? 'Abra caja antes de emitir y cobrar una factura.' : null,
        state.patientName.trim() === '' ? 'Ingrese el nombre del paciente para emitir.' : null,
        state.cartItems.length === 0 ? 'Agregue al menos un servicio.' : null,
      ].filter((reason): reason is string => Boolean(reason)),
    [state.loadedCashSession, state.patientName, state.cartItems.length],
  );
  const canEmit = emitBlockReasons.length === 0;

  const preview = useMemo(
    () => computeSimpleEstimate(state.cartItems, fiscalTaxRate),
    [state.cartItems, fiscalTaxRate],
  );

  return {
    addToCart,
    addByScanCode,
    updateQuantity,
    updateDialysisPrescription,
    removeItem,
    clearCart,
    handlePatientNameChange,
    handlePatientSubmit,
    emitBlockReasons,
    canEmit,
    preview,
  };
}
