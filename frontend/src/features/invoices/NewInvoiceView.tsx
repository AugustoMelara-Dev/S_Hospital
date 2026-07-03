import { useEffect, useCallback, useMemo, useRef, useReducer } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, type CashSession, type InstitutionalReceipt, type ReceiptData, type Service, userSafeErrorMessage } from '../../lib/api';
import { invoiceSchema } from '../../schemas/invoice.schema';
import { useOperationalSettings } from '../../hooks/useFiscalSettings';
import { newInvoiceReducer } from './state/reducer';
import { getInitialNewInvoiceState } from './state/types';
import { computeSimpleEstimate, isZeroMoney, parseLocalCents } from './state/posMath';
import { NewInvoiceViewLayout } from './components/NewInvoiceViewLayout';
import { openBlobInNewTab } from '@/lib/download';
import { createClientIdempotencyKey } from '@/lib/api/base';
import { queryKeys } from '@/lib/queryKeys';


const POS_SERVICE_PAGE_SIZE = 24;

type NewInvoiceViewProps = {
  cashSession: CashSession | null;
  canCreatePayments?: boolean;
  canOpenCash?: boolean;
  canViewCatalog?: boolean;
  canViewReceipts?: boolean;
  canMarkDialysisPrescription?: boolean;
  onCashSessionChange?: (session: CashSession | null) => void;
  onOpenCash?: () => void;
  onStatus: (message: string) => void;
};

export function NewInvoiceView({
  cashSession,
  canCreatePayments = true,
  canOpenCash = true,
  canViewCatalog = true,
  canViewReceipts = true,
  canMarkDialysisPrescription = false,
  onCashSessionChange,
  onOpenCash,
  onStatus,
}: NewInvoiceViewProps) {
  const [state, dispatch] = useReducer(newInvoiceReducer, cashSession, getInitialNewInvoiceState);
  const { data: operationalSettings } = useOperationalSettings();
  const queryClient = useQueryClient();

  const patientInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const scannerInputRef = useRef<HTMLInputElement | null>(null);
  const submitInvoiceInFlightRef = useRef(false);
  const submitInvoiceIdempotencyKeyRef = useRef<string | null>(null);
  const submitPaymentInFlightRef = useRef(false);
  const submitPaymentIdempotencyKeyRef = useRef<string | null>(null);
  const receiptPdfIdempotencyKeyRef = useRef<string | null>(null);
  const scanCodeInFlightRef = useRef(false);
  const skipInitialServiceSearchRef = useRef(true);

  useEffect(() => {
    void loadPointOfSaleData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.setTimeout(() => {
      if (state.patientName.trim()) {
        searchInputRef.current?.focus();
        return;
      }
      patientInputRef.current?.focus();
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dirty guard: warn if user tries to close tab/window with items in cart
  useEffect(() => {
    const isDirty = state.cartItems.length > 0;
    if (!isDirty) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.cartItems.length]);

  useEffect(() => {
    if (!canViewCatalog) {
      return;
    }
    if (skipInitialServiceSearchRef.current) {
      skipInitialServiceSearchRef.current = false;
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void searchPointOfSaleServices();
    }, 250);
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewCatalog, state.search, state.selectedAreaId, state.selectedCategoryId]);

  useEffect(() => {
    dispatch({ type: 'SET_LOADED_CASH_SESSION', payload: cashSession });
  }, [cashSession]);

  useEffect(() => {
    submitInvoiceIdempotencyKeyRef.current = null;
  }, [canMarkDialysisPrescription, state.cartItems, state.patientName]);

  useEffect(() => {
    if (!operationalSettings) {
      return;
    }
    dispatch({ type: 'SET_SCANNER_ENABLED', payload: operationalSettings.scanner_enabled === true });
    dispatch({ type: 'SET_PARTIAL_PAYMENTS_ENABLED', payload: operationalSettings.partial_payments_enabled === true });
  }, [operationalSettings]);

  const handleClearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART_COMPLETELY' });
    onStatus('Carrito limpiado.');
    window.setTimeout(() => patientInputRef.current?.focus(), 0);
  }, [onStatus]);

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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInsideDialog = Boolean(target.closest('[data-dialog-content], [role="dialog"], [role="alertdialog"]'));
      const hasOpenOverlay = state.showConfirmation || state.showPayment || state.showSuccess || state.showReceipt || state.showClearConfirm;

      if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        patientInputRef.current?.focus();
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        scannerInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        if (state.showConfirmation || state.showPayment || state.showSuccess || state.showReceipt) return;
        if (target.closest('[data-dialog-content]')) return;
        if (state.patientName || state.search || state.scanCode || state.cartItems.length > 0) {
          e.preventDefault();
          dispatch({ type: 'SET_SHOW_CLEAR_CONFIRM', payload: true });
        }
      }
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (isInsideDialog || hasOpenOverlay) {
          return;
        }
        if (canEmit) {
          handleEmitClick();
        } else {
          validateForm();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEmit, state.cartItems.length, handleClearCart, state.patientName, state.scanCode, state.search, state.showClearConfirm, state.showConfirmation, state.showPayment, state.showReceipt, state.showSuccess]);

  const preview = useMemo(() => {
    const sanitizedItems = canMarkDialysisPrescription
      ? state.cartItems
      : state.cartItems.map(item => ({ ...item, dialysisPrescription: false }));
    return computeSimpleEstimate(sanitizedItems, operationalSettings?.default_tax_rate);
  }, [state.cartItems, operationalSettings?.default_tax_rate, canMarkDialysisPrescription]);

  async function loadPointOfSaleData() {
    if (!canViewCatalog) {
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: 'Este usuario no tiene permiso para consultar el catálogo de servicios.' });
      dispatch({ type: 'SET_LOADING_SERVICES', payload: false });
      return;
    }
    dispatch({ type: 'SET_LOADING_SERVICES', payload: true });
    dispatch({ type: 'SET_POINT_OF_SALE_LOAD_ERROR', payload: null });
    try {
      const [currentCashSession, nextCategories, nextServiceAreas, nextServices] = await Promise.all([
        apiClient.getCurrentCashSession(),
        apiClient.getCategories(true),
        apiClient.getServiceAreas(true),
        apiClient.getServices({ active: true, billing: true, perPage: POS_SERVICE_PAGE_SIZE }),
      ]);
      dispatch({
        type: 'LOAD_DATA_SUCCESS',
        payload: {
          loadedCashSession: currentCashSession,
          categories: Array.isArray(nextCategories) ? nextCategories : [],
          serviceAreas: Array.isArray(nextServiceAreas) ? nextServiceAreas : [],
          services: Array.isArray(nextServices) ? nextServices : [],
        },
      });
      onCashSessionChange?.(currentCashSession);
    } catch (error) {
      const message = userSafeErrorMessage(error, 'No se pudo cargar servicios y caja desde el servidor LAN.');
      dispatch({ type: 'SET_POINT_OF_SALE_LOAD_ERROR', payload: message });
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: message });
      onStatus(message);
    } finally {
      dispatch({ type: 'SET_LOADING_SERVICES', payload: false });
    }
  }

  async function searchPointOfSaleServices() {
    dispatch({ type: 'SET_LOADING_SERVICES', payload: true });
    try {
      const nextServices = await apiClient.getServices({
        active: true,
        billing: true,
        search: state.search.trim() || undefined,
        areaId: state.selectedAreaId && state.selectedAreaId !== 'all' ? state.selectedAreaId : undefined,
        categoryId: state.selectedCategoryId && state.selectedCategoryId !== 'all' ? state.selectedCategoryId : undefined,
        perPage: POS_SERVICE_PAGE_SIZE,
      });
      dispatch({ type: 'SEARCH_SERVICES_SUCCESS', payload: Array.isArray(nextServices) ? nextServices : [] });
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: null });
    } catch (error) {
      const message = userSafeErrorMessage(error, 'No se pudo buscar servicios activos.');
      dispatch({ type: 'SEARCH_SERVICES_SUCCESS', payload: [] });
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: message });
      onStatus(message);
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    } finally {
      dispatch({ type: 'SET_LOADING_SERVICES', payload: false });
    }
  }

  function addToCart(service: Service) {
    dispatch({ type: 'SET_ALERT_MESSAGE', payload: null });
    dispatch({ type: 'SET_WARNING_MESSAGE', payload: null });
    const message = `Agregado: ${service.name}`;
    dispatch({ type: 'SET_SUCCESS_MESSAGE', payload: message });
    onStatus(message);
    window.setTimeout(() => {
      dispatch({ type: 'CLEAR_SUCCESS_MESSAGE', payload: message });
    }, 2200);
    dispatch({ type: 'ADD_TO_CART', payload: service });
  }

  async function addByScanCode() {
    if (scanCodeInFlightRef.current) return;

    const code = state.scanCode.trim();
    const refocusScanner = () => window.setTimeout(() => scannerInputRef.current?.focus(), 0);
    if (code === '') {
      const message = 'Ingrese o escanee un código.';
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: message });
      onStatus(message);
      refocusScanner();
      return;
    }
    scanCodeInFlightRef.current = true;
    dispatch({ type: 'SET_SCANNING_CODE', payload: true });
    try {
      const [service] = await apiClient.getServices({ code, active: true, billing: true, perPage: 1 });
      if (!service) {
        const message = 'No se encontró servicio activo para este código.';
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
      onStatus(`Servicio agregado por código: ${service.name}.`);
      refocusScanner();
    } catch (error) {
      const message = userSafeErrorMessage(error, 'No se pudo buscar el código escaneado.');
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: message });
      onStatus(message);
      refocusScanner();
    } finally {
      scanCodeInFlightRef.current = false;
      dispatch({ type: 'SET_SCANNING_CODE', payload: false });
    }
  }

  function updateQuantity(index: number, quantity: string) {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { index, quantity } });
  }

  function updateDialysisPrescription(index: number, checked: boolean) {
    dispatch({ type: 'UPDATE_DIALYSIS', payload: { index, checked } });
  }

  function removeItem(index: number) {
    dispatch({ type: 'REMOVE_ITEM', payload: index });
  }

  function handlePatientNameChange(value: string) {
    dispatch({ type: 'SET_PATIENT_NAME', payload: value });
    if (state.patientError && value.trim()) {
      dispatch({ type: 'SET_PATIENT_ERROR', payload: undefined });
    }
  }

  function handlePatientSubmit() {
    if (state.patientName.trim() === '') {
      dispatch({ type: 'SET_PATIENT_ERROR', payload: 'Ingrese el nombre del paciente para continuar.' });
      patientInputRef.current?.focus();
      return;
    }
    dispatch({ type: 'SET_PATIENT_ERROR', payload: undefined });
    searchInputRef.current?.focus();
  }

  function validateForm(): boolean {
    if (!state.loadedCashSession) {
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: 'Abra caja antes de emitir y cobrar una factura.' });
      onStatus('Abra caja antes de emitir y cobrar una factura.');
      return false;
    }
    const validationResult = invoiceSchema.safeParse({
      patient_name: state.patientName,
      dialysis_prescription: state.cartItems.some(item => item.dialysisPrescription),
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
  }

  function handleEmitClick() {
    dispatch({ type: 'SET_ALERT_MESSAGE', payload: null });
    if (!validateForm()) return;
    dispatch({ type: 'SET_SHOW_CONFIRMATION', payload: true });
  }

  async function submitInvoice() {
    if (submitInvoiceInFlightRef.current) {
      return;
    }

    submitInvoiceInFlightRef.current = true;
    dispatch({ type: 'SET_SUBMITTING', payload: true });
    dispatch({ type: 'SET_SHOW_CONFIRMATION', payload: false });
    dispatch({ type: 'SET_ALERT_MESSAGE', payload: null });
    dispatch({ type: 'SET_WARNING_MESSAGE', payload: null });
    try {
      const hasDialysis = canMarkDialysisPrescription && state.cartItems.some(item => item.dialysisPrescription);
      const invoice = await apiClient.createInvoice({
        patient_name: state.patientName,
        dialysis_prescription: hasDialysis,
        items: state.cartItems.map((item) => ({
          service_id: item.service.id,
          quantity: item.quantity,
          dialysis_prescription: canMarkDialysisPrescription && item.dialysisPrescription,
        })),
      }, {
        idempotencyKey: submitInvoiceIdempotencyKeyRef.current ??= createClientIdempotencyKey(),
      });
      submitInvoiceIdempotencyKeyRef.current = null;
      dispatch({ type: 'SET_ISSUED_INVOICE', payload: invoice });
      dispatch({ type: 'SET_PAYMENT_AMOUNT', payload: '0.00' });
      dispatch({ type: 'SET_RECEIPT', payload: null });
      dispatch({ type: 'SET_INSTITUTIONAL_RECEIPT', payload: null });
      dispatch({ type: 'SET_AUTO_PRINT_RECEIPT', payload: false });
      dispatch({ type: 'SET_CART_ITEMS', payload: [] });
      dispatch({ type: 'SET_PATIENT_NAME', payload: '' });
      if (state.loadedCashSession && parseLocalCents(invoice.balance_due) > 0) {
        if (!canCreatePayments || !canViewReceipts) {
          dispatch({ type: 'SET_SHOW_SUCCESS', payload: true });
          dispatch({
            type: 'SET_WARNING_MESSAGE',
            payload: 'Factura emitida. Quedo pendiente de cobro; solicite a caja cobrar e imprimir el recibo.',
          });
          onStatus(`Factura emitida ${invoice.invoice_number}. Quedo pendiente de cobro.`);
          return;
        }
        dispatch({ type: 'SET_SHOW_SUCCESS', payload: false });
        dispatch({ type: 'SET_SHOW_PAYMENT', payload: true });
        onStatus(`Factura emitida ${invoice.invoice_number}. Cobro abierto.`);
      } else if (isZeroMoney(invoice.total) && invoice.status === 'paid') {
        if (!canViewReceipts) {
          dispatch({ type: 'SET_SHOW_SUCCESS', payload: true });
          dispatch({
            type: 'SET_WARNING_MESSAGE',
            payload: 'Factura emitida. Esta cuenta no puede imprimir recibos; solicite apoyo a caja.',
          });
          onStatus(`Factura emitida ${invoice.invoice_number}. Recibo pendiente por permisos.`);
          return;
        }
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
      submitInvoiceInFlightRef.current = false;
      dispatch({ type: 'SET_SUBMITTING', payload: false });
    }
  }

  function handleCobrarClick() {
    if (!state.issuedInvoice || !state.loadedCashSession) {
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: 'Debe abrir caja antes de cobrar.' });
      return;
    }
    if (!canCreatePayments || !canViewReceipts) {
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: 'Esta cuenta no puede cobrar ni imprimir recibos. Solicite apoyo a caja.' });
      return;
    }
    dispatch({ type: 'SET_SHOW_SUCCESS', payload: false });
    dispatch({ type: 'SET_WARNING_MESSAGE', payload: null });
    if (!state.paymentAmount || Number(state.paymentAmount) <= 0) {
      dispatch({ type: 'SET_PAYMENT_AMOUNT', payload: '0.00' });
    }
    dispatch({ type: 'SET_SHOW_PAYMENT', payload: true });
  }

  async function submitPayment(appliedAmount = state.paymentAmount) {
    if (submitPaymentInFlightRef.current) {
      return;
    }
    if (!state.issuedInvoice || !state.loadedCashSession) {
      dispatch({ type: 'SET_SHOW_PAYMENT', payload: false });
      return;
    }
    submitPaymentInFlightRef.current = true;
    const invoiceToPay = state.issuedInvoice;
    const sessionToUse = state.loadedCashSession;
    dispatch({ type: 'SET_PAYING', payload: true });
    try {
      const result = await apiClient.registerPayment(invoiceToPay.id, {
        cash_session_id: sessionToUse.id,
        method: state.paymentMethod,
        amount: appliedAmount,
        reference: state.paymentReference.trim() || null,
      }, {
        idempotencyKey: submitPaymentIdempotencyKeyRef.current ??= createClientIdempotencyKey(),
      });
      submitPaymentIdempotencyKeyRef.current = null;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.cashSessions.current() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.cashSessions.movements(sessionToUse.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.reports.dashboard(), refetchType: 'none' }),
      ]);
      dispatch({ type: 'SET_ISSUED_INVOICE', payload: result.invoice });
      dispatch({ type: 'SET_PAYMENT_AMOUNT', payload: result.invoice.balance_due });

      if (result.institutional_receipt) {
        dispatch({ type: 'SET_INSTITUTIONAL_RECEIPT', payload: result.institutional_receipt });
        dispatch({ type: 'SET_RECEIPT', payload: null });
        dispatch({ type: 'SET_AUTO_PRINT_RECEIPT', payload: false });
        dispatch({ type: 'SET_SHOW_RECEIPT', payload: false });
        dispatch({ type: 'SET_ALERT_MESSAGE', payload: null });
        dispatch({ type: 'SET_WARNING_MESSAGE', payload: null });

        dispatch({ type: 'SET_SHOW_PAYMENT', payload: false });
        dispatch({ type: 'SET_SHOW_SUCCESS', payload: true });
        try {
          await openInstitutionalReceiptPdf(result.institutional_receipt);
          onStatus(`Pago registrado. PDF institucional ${result.institutional_receipt.receipt_number_full} abierto.`);
        } catch (error) {
          onStatus(userSafeErrorMessage(error, `Pago registrado. Recibo institucional ${result.institutional_receipt.receipt_number_full} emitido, pero no se pudo abrir el PDF.`));
        }
        return;
      }

      if (result.institutional_receipt_error) {
        dispatch({ type: 'SET_WARNING_MESSAGE', payload: result.institutional_receipt_error });
        onStatus(result.institutional_receipt_error);
      }

      let nextReceipt;
      try {
        nextReceipt = await apiClient.getReceipt(result.invoice.id, state.receiptWidth);
      } catch {
        const message = 'Pago registrado, pero no se pudo generar el recibo. Reimprima desde Historial.';
        dispatch({ type: 'SET_RECEIPT', payload: null });
        dispatch({ type: 'SET_INSTITUTIONAL_RECEIPT', payload: null });
        dispatch({ type: 'SET_AUTO_PRINT_RECEIPT', payload: false });
        dispatch({ type: 'SET_SHOW_PAYMENT', payload: false });
        dispatch({ type: 'SET_SHOW_RECEIPT', payload: false });
        dispatch({ type: 'SET_SHOW_SUCCESS', payload: true });
        dispatch({ type: 'SET_ALERT_MESSAGE', payload: null });
        dispatch({ type: 'SET_WARNING_MESSAGE', payload: message });
        onStatus(message);

        return;
      }

      dispatch({ type: 'SET_RECEIPT', payload: nextReceipt });
      dispatch({ type: 'SET_INSTITUTIONAL_RECEIPT', payload: null });
      dispatch({ type: 'SET_RECEIPT_WIDTH', payload: nextReceipt.width });
      dispatch({ type: 'SET_AUTO_PRINT_RECEIPT', payload: true });
      dispatch({ type: 'SET_SHOW_PAYMENT', payload: false });
      dispatch({ type: 'SET_SHOW_RECEIPT', payload: true });
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: null });
      dispatch({ type: 'SET_WARNING_MESSAGE', payload: null });
      onStatus(`Pago registrado. Recibo ${nextReceipt.invoice.invoice_number} enviado a impresión.`);
    } catch (error) {
      const message = userSafeErrorMessage(error, 'No se pudo registrar el pago.');
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: message });
      dispatch({ type: 'SET_SHOW_PAYMENT', payload: true });
      onStatus(message);
    } finally {
      submitPaymentInFlightRef.current = false;
      dispatch({ type: 'SET_PAYING', payload: false });
    }
  }

  async function loadReceipt(width: ReceiptData['width']) {
    dispatch({ type: 'SET_RECEIPT_WIDTH', payload: width });
    if (!state.issuedInvoice) return;
    try {
      const nextReceipt = await apiClient.getReceipt(state.issuedInvoice.id, width);
      dispatch({ type: 'SET_RECEIPT', payload: nextReceipt });
      dispatch({ type: 'SET_SHOW_RECEIPT', payload: true });
    } catch (error) {
      onStatus(userSafeErrorMessage(error, 'No se pudo generar el recibo.'));
    }
  }

  async function openInstitutionalReceiptPdf(receipt: InstitutionalReceipt, reason?: string) {
    const trimmedReason = reason?.trim();
    const blob = trimmedReason
      ? await apiClient.getInstitutionalReceiptPdf(receipt.id, trimmedReason, {
          idempotencyKey: receiptPdfIdempotencyKeyRef.current ??= createClientIdempotencyKey(),
        })
      : await apiClient.getInstitutionalReceiptPdf(receipt.id);

    if (trimmedReason) {
      receiptPdfIdempotencyKeyRef.current = null;
    }
    openBlobInNewTab(blob, `recibo-institucional-${receipt.receipt_number_full}.pdf`);
  }

  async function handlePrintIssuedReceipt() {
    if (state.institutionalReceipt) {
      try {
        await openInstitutionalReceiptPdf(state.institutionalReceipt, 'Reimpresion desde venta/cobro.');
        onStatus(`PDF institucional ${state.institutionalReceipt.receipt_number_full} abierto.`);
      } catch (error) {
        onStatus(userSafeErrorMessage(error, 'No se pudo abrir el PDF institucional.'));
      }
      return;
    }

    await loadReceipt(state.receiptWidth);
  }

  function handleNuevaFactura() {
    dispatch({ type: 'RESET_FORM', payload: { loadedCashSession: state.loadedCashSession } });
    window.setTimeout(() => patientInputRef.current?.focus(), 0);
  }

  function handlePaymentOpenChange(nextOpen: boolean) {
    if (state.paying) {
      return;
    }
    if (!nextOpen) {
      submitPaymentIdempotencyKeyRef.current = null;
    }
    dispatch({ type: 'SET_SHOW_PAYMENT', payload: nextOpen });
    if (!nextOpen && state.issuedInvoice && (state.issuedInvoice.status === 'issued' || state.issuedInvoice.status === 'partial')) {
      dispatch({ type: 'SET_SHOW_SUCCESS', payload: true });
      dispatch({
        type: 'SET_WARNING_MESSAGE',
        payload: `Factura ${state.issuedInvoice.invoice_number} emitida. Quedo pendiente de cobro; puede cobrarla desde este panel o desde Historial.`,
      });
      onStatus(`Factura ${state.issuedInvoice.invoice_number} emitida y pendiente de cobro.`);
    }
  }

  function handleReceiptOpenChange(nextOpen: boolean) {
    dispatch({ type: 'SET_SHOW_RECEIPT', payload: nextOpen });
    if (!nextOpen && (state.issuedInvoice?.status === 'paid' || state.issuedInvoice?.status === 'partial')) {
      dispatch({ type: 'SET_AUTO_PRINT_RECEIPT', payload: false });
      dispatch({ type: 'SET_SHOW_SUCCESS', payload: true });
    }
  }

  return (
    <NewInvoiceViewLayout
      state={state}
      preview={preview}
      emitBlockReasons={emitBlockReasons}
      canEmit={canEmit}
      canCreatePayments={canCreatePayments}
      canOpenCash={canOpenCash}
      canViewReceipts={canViewReceipts}
      canMarkDialysisPrescription={canMarkDialysisPrescription}
      onOpenCash={onOpenCash}
      onPatientNameChange={handlePatientNameChange}
      onPatientSubmit={handlePatientSubmit}
      onAreaChange={(val) => dispatch({ type: 'SET_SELECTED_AREA_ID', payload: val })}
      onCategoryChange={(val) => dispatch({ type: 'SET_SELECTED_CATEGORY_ID', payload: val })}
      onSearchChange={(val) => dispatch({ type: 'SET_SEARCH', payload: val })}
      onScanCodeChange={(val) => dispatch({ type: 'SET_SCAN_CODE', payload: val })}
      onAddService={addToCart}
      onAddByScanCode={addByScanCode}
      onUpdateQuantity={updateQuantity}
      onUpdateDialysisPrescription={updateDialysisPrescription}
      onRemoveItem={removeItem}
      onConfirm={handleEmitClick}
      onConfirmDialogChange={(val) => dispatch({ type: 'SET_SHOW_CONFIRMATION', payload: val })}
      onPaymentMethodChange={(val) => dispatch({ type: 'SET_PAYMENT_METHOD', payload: val })}
      onPaymentAmountChange={(val) => dispatch({ type: 'SET_PAYMENT_AMOUNT', payload: val })}
      onPaymentReferenceChange={(val) => dispatch({ type: 'SET_PAYMENT_REFERENCE', payload: val })}
      onSubmitInvoice={() => void submitInvoice()}
      onCobrar={handleCobrarClick}
      onRetryLoad={loadPointOfSaleData}
      onPaymentOpenChange={handlePaymentOpenChange}
      onSubmitPayment={(appliedAmount) => void submitPayment(appliedAmount)}
      onPrintIssuedReceipt={() => void handlePrintIssuedReceipt()}
      onNuevaFactura={handleNuevaFactura}
      onSuccessDialogChange={(val) => dispatch({ type: 'SET_SHOW_SUCCESS', payload: val })}
      onReceiptOpenChange={handleReceiptOpenChange}
      onClearCart={handleClearCart}
      onClearConfirmChange={(val) => dispatch({ type: 'SET_SHOW_CLEAR_CONFIRM', payload: val })}
      onAutoPrintChange={(val) => dispatch({ type: 'SET_AUTO_PRINT_RECEIPT', payload: val })}
      patientInputRef={patientInputRef}
      searchInputRef={searchInputRef}
      scannerInputRef={scannerInputRef}
    />
  );
}
