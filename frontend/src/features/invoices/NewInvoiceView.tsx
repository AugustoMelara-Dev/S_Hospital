import { useEffect, useCallback, useMemo, useRef, useReducer } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  apiClient,
  institutionalReceipts,
  type CashSession,
  type InstitutionalReceipt,
  type Invoice,
  type ReceiptData,
  type Service,
  userSafeErrorMessage,
} from '../../lib/api';
import { useOperationalSettings } from '../../hooks/useFiscalSettings';
import { newInvoiceReducer } from './state/reducer';
import { getInitialNewInvoiceState } from './state/types';
import { computeSimpleEstimate, isZeroMoney, parseLocalCents } from './state/posMath';
import { NewInvoiceViewLayout } from './components/NewInvoiceViewLayout';
import { useNewInvoiceScreenGuards } from './hooks/useNewInvoiceScreenGuards';
import { useNewInvoiceShortcuts } from './hooks/useNewInvoiceShortcuts';
import { useNewInvoiceValidation } from './hooks/useNewInvoiceValidation';
import { buildInvoicePayload } from './invoicePayload';
import { downloadBlob, institutionalReceiptPdfFilename, openBlobInNewTab } from '@/lib/download';
import { createClientIdempotencyKey } from '@/lib/api/base';
import { payloadScopedIdempotencyKey, resetPayloadScopedIdempotencyKey } from '@/lib/api/idempotency';
import { queryKeys } from '@/lib/queryKeys';
import { interpretPaymentOutcome } from '@/modules/billing/application/paymentOutcome';

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
  const emitConfirmationInFlightRef = useRef(false);
  const submitInvoiceInFlightRef = useRef(false);
  const submitInvoiceIdempotencyKeyRef = useRef<string | null>(null);
  const submitInvoiceIdempotencySignatureRef = useRef<string | null>(null);
  const submitPaymentInFlightRef = useRef(false);
  const submitPaymentIdempotencyKeyRef = useRef<string | null>(null);
  const submitPaymentIdempotencySignatureRef = useRef<string | null>(null);
  const receiptGenerationIdempotencyKeyRef = useRef<string | null>(null);
  const receiptGenerationIdempotencySignatureRef = useRef<string | null>(null);
  const receiptPdfIdempotencyKeyRef = useRef<string | null>(null);
  const scanCodeInFlightRef = useRef(false);
  const skipInitialServiceSearchRef = useRef(true);
  const latestPaymentResultRef = useRef<import('../../lib/api').Payment | null>(null);
  useEffect(() => {
    void loadPointOfSaleData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useNewInvoiceScreenGuards({
    cartItemsLength: state.cartItems.length,
    patientInputRef,
    patientName: state.patientName,
    searchInputRef,
  });
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

  const validateForm = useNewInvoiceValidation({
    cartItems: state.cartItems,
    dispatch,
    loadedCashSession: state.loadedCashSession,
    onStatus,
    patientInputRef,
    patientName: state.patientName,
  });

  useNewInvoiceShortcuts({
    canEmit,
    dispatch,
    onEmit: handleEmitClick,
    onValidate: validateForm,
    patientInputRef,
    scannerInputRef,
    searchInputRef,
    state: {
      patientName: state.patientName,
      search: state.search,
      scanCode: state.scanCode,
      cartItemsLength: state.cartItems.length,
      showConfirmation: state.showConfirmation,
      showPayment: state.showPayment,
      showSuccess: state.showSuccess,
      showReceipt: state.showReceipt,
      showClearConfirm: state.showClearConfirm,
    },
  });

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
      const message = userSafeErrorMessage(error, 'No se pudo cargar servicios y caja desde el servidor local.');
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

  async function handleEmitClick() {
    dispatch({ type: 'SET_ALERT_MESSAGE', payload: null });
    if (!validateForm()) return;
    if (emitConfirmationInFlightRef.current) return;

    emitConfirmationInFlightRef.current = true;
    dispatch({ type: 'SET_SUBMITTING', payload: true });
    try {
      const currentCashSession = await apiClient.getCurrentCashSession();
      const openCashSession = currentCashSession?.status === 'open' ? currentCashSession : null;
      dispatch({ type: 'SET_LOADED_CASH_SESSION', payload: openCashSession });
      onCashSessionChange?.(openCashSession);

      if (!openCashSession) {
        const message = 'Abra caja antes de emitir y cobrar una factura.';
        dispatch({ type: 'SET_ALERT_MESSAGE', payload: message });
        onStatus(message);
        return;
      }

      dispatch({ type: 'SET_SHOW_CONFIRMATION', payload: true });
    } catch (error) {
      const message = userSafeErrorMessage(error, 'No se pudo validar la caja abierta antes de emitir.');
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: message });
      onStatus(message);
    } finally {
      emitConfirmationInFlightRef.current = false;
      dispatch({ type: 'SET_SUBMITTING', payload: false });
    }
  }

  async function submitInvoice() {
    if (submitInvoiceInFlightRef.current) {
      return;
    }
    latestPaymentResultRef.current = null;

    submitInvoiceInFlightRef.current = true;
    dispatch({ type: 'SET_SUBMITTING', payload: true });
    dispatch({ type: 'SET_SHOW_CONFIRMATION', payload: false });
    dispatch({ type: 'SET_ALERT_MESSAGE', payload: null });
    dispatch({ type: 'SET_WARNING_MESSAGE', payload: null });
    try {
      const invoicePayload = buildInvoicePayload({
        canMarkDialysisPrescription,
        cartItems: state.cartItems,
        patientName: state.patientName,
      });
      const invoice = await apiClient.createInvoice(invoicePayload, {
        idempotencyKey: payloadScopedIdempotencyKey(
          submitInvoiceIdempotencyKeyRef,
          submitInvoiceIdempotencySignatureRef,
          invoicePayload,
        ),
      });
      resetPayloadScopedIdempotencyKey(submitInvoiceIdempotencyKeyRef, submitInvoiceIdempotencySignatureRef);
      dispatch({ type: 'SET_ISSUED_INVOICE', payload: invoice });
      dispatch({ type: 'SET_PAYMENT_AMOUNT', payload: invoice.balance_due });
      dispatch({ type: 'SET_RECEIPT', payload: null });
      dispatch({ type: 'SET_INSTITUTIONAL_RECEIPT', payload: null });
      dispatch({ type: 'SET_INSTITUTIONAL_RECEIPT_RECOVERY_MESSAGE', payload: null });
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
        await issueInstitutionalReceiptForZeroTotalInvoice(invoice);
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
      dispatch({ type: 'SET_PAYMENT_AMOUNT', payload: state.issuedInvoice.balance_due });
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
      const paymentPayload = {
        cash_session_id: sessionToUse.id,
        method: state.paymentMethod,
        amount: appliedAmount,
        reference: state.paymentReference.trim() || null,
      };
      const result = await apiClient.registerPayment(invoiceToPay.id, paymentPayload, {
        idempotencyKey: payloadScopedIdempotencyKey(
          submitPaymentIdempotencyKeyRef,
          submitPaymentIdempotencySignatureRef,
          { invoiceId: invoiceToPay.id, payload: paymentPayload },
        ),
      });
      resetPayloadScopedIdempotencyKey(submitPaymentIdempotencyKeyRef, submitPaymentIdempotencySignatureRef);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.cashSessions.current() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.cashSessions.movements(sessionToUse.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.reports.dashboard(), refetchType: 'none' }),
      ]);
      latestPaymentResultRef.current = result.payment;
      dispatch({ type: 'SET_ISSUED_INVOICE', payload: result.invoice });
      dispatch({ type: 'SET_PAYMENT_AMOUNT', payload: result.invoice.balance_due });

      const paymentOutcome = interpretPaymentOutcome(result);

      if (paymentOutcome.kind === 'receipt_ready') {
        dispatch({ type: 'SET_INSTITUTIONAL_RECEIPT', payload: paymentOutcome.receipt });
        dispatch({ type: 'SET_INSTITUTIONAL_RECEIPT_RECOVERY_MESSAGE', payload: null });
        dispatch({ type: 'SET_RECEIPT', payload: null });
        dispatch({ type: 'SET_SHOW_RECEIPT', payload: false });
        dispatch({ type: 'SET_ALERT_MESSAGE', payload: null });
        dispatch({ type: 'SET_WARNING_MESSAGE', payload: null });

        dispatch({ type: 'SET_SHOW_PAYMENT', payload: false });
        dispatch({ type: 'SET_SHOW_SUCCESS', payload: true });
        try {
          await openInstitutionalReceiptPdf(paymentOutcome.receipt);
          onStatus(`Pago registrado. PDF institucional ${paymentOutcome.receipt.receipt_number_full} abierto.`);
        } catch (error) {
          const message = userSafeErrorMessage(
            error,
            `Pago registrado. Recibo institucional ${paymentOutcome.receipt.receipt_number_full} emitido, pero no se pudo abrir el PDF.`,
          );
          const recoveryMessage = `Recibo institucional ${paymentOutcome.receipt.receipt_number_full} emitido, pero no se pudo abrir el PDF. Use Imprimir recibo institucional para intentar de nuevo o reimprima desde Historial.`;
          dispatch({ type: 'SET_INSTITUTIONAL_RECEIPT_RECOVERY_MESSAGE', payload: recoveryMessage });
          dispatch({ type: 'SET_WARNING_MESSAGE', payload: recoveryMessage });
          onStatus(message);
        }
        return;
      }

      if (paymentOutcome.kind === 'receipt_recovery') {
        const recoveryMessage = paymentOutcome.message;
        dispatch({ type: 'SET_RECEIPT', payload: null });
        dispatch({ type: 'SET_INSTITUTIONAL_RECEIPT', payload: null });
        dispatch({ type: 'SET_INSTITUTIONAL_RECEIPT_RECOVERY_MESSAGE', payload: recoveryMessage });
        dispatch({ type: 'SET_SHOW_PAYMENT', payload: false });
        dispatch({ type: 'SET_SHOW_RECEIPT', payload: false });
        dispatch({ type: 'SET_SHOW_SUCCESS', payload: true });
        dispatch({ type: 'SET_ALERT_MESSAGE', payload: null });
        dispatch({ type: 'SET_WARNING_MESSAGE', payload: recoveryMessage });
        onStatus(recoveryMessage);

        return;
      }

      dispatch({ type: 'SET_RECEIPT', payload: null });
      dispatch({ type: 'SET_INSTITUTIONAL_RECEIPT', payload: null });
      dispatch({ type: 'SET_INSTITUTIONAL_RECEIPT_RECOVERY_MESSAGE', payload: null });
      dispatch({ type: 'SET_SHOW_PAYMENT', payload: false });
      dispatch({ type: 'SET_SHOW_RECEIPT', payload: false });
      dispatch({ type: 'SET_SHOW_SUCCESS', payload: true });
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: null });
      dispatch({ type: 'SET_WARNING_MESSAGE', payload: null });
      onStatus(paymentOutcome.message);
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
    const idempotencyKey = receiptPdfIdempotencyKeyRef.current ??= createClientIdempotencyKey();
    await apiClient.registerInstitutionalReceiptPrintEvent(receipt.id, trimmedReason || undefined, { idempotencyKey });
    const blob = await apiClient.getInstitutionalReceiptPdf(receipt.id);

    receiptPdfIdempotencyKeyRef.current = null;
    openBlobInNewTab(blob, institutionalReceiptPdfFilename(receipt.receipt_number_full));
  }

  async function issueInstitutionalReceiptForZeroTotalInvoice(invoice: Invoice) {
    const receiptPayload = {
      invoice_id: invoice.id,
      ...(state.loadedCashSession ? { cash_session_id: state.loadedCashSession.id } : {}),
    };

    try {
      const receipt = await institutionalReceipts.store(receiptPayload, {
        idempotencyKey: payloadScopedIdempotencyKey(
          receiptGenerationIdempotencyKeyRef,
          receiptGenerationIdempotencySignatureRef,
          receiptPayload,
        ),
      });
      resetPayloadScopedIdempotencyKey(receiptGenerationIdempotencyKeyRef, receiptGenerationIdempotencySignatureRef);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all }),
        queryClient.invalidateQueries({ queryKey: ['audit'] }),
      ]);

      dispatch({ type: 'SET_INSTITUTIONAL_RECEIPT', payload: receipt });
      dispatch({ type: 'SET_INSTITUTIONAL_RECEIPT_RECOVERY_MESSAGE', payload: null });
      dispatch({ type: 'SET_RECEIPT', payload: null });
      dispatch({ type: 'SET_SHOW_RECEIPT', payload: false });
      dispatch({ type: 'SET_SHOW_SUCCESS', payload: true });
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: null });
      dispatch({ type: 'SET_WARNING_MESSAGE', payload: null });

      try {
        await openInstitutionalReceiptPdf(receipt);
        onStatus(`Factura emitida ${invoice.invoice_number}. PDF institucional ${receipt.receipt_number_full} abierto.`);
      } catch (error) {
        const message = userSafeErrorMessage(
          error,
          `Factura emitida. Recibo institucional ${receipt.receipt_number_full} emitido, pero no se pudo abrir el PDF.`,
        );
        const recoveryMessage = `Recibo institucional ${receipt.receipt_number_full} emitido, pero no se pudo abrir el PDF. Use Imprimir recibo institucional para intentar de nuevo o reimprima desde Historial.`;
        dispatch({ type: 'SET_INSTITUTIONAL_RECEIPT_RECOVERY_MESSAGE', payload: recoveryMessage });
        dispatch({ type: 'SET_WARNING_MESSAGE', payload: recoveryMessage });
        onStatus(message);
      }
    } catch (error) {
      const detail = userSafeErrorMessage(error, 'No se pudo emitir el recibo institucional.');
      const recoveryMessage = `Factura emitida, pero no se pudo emitir el recibo institucional: ${detail} Genere el recibo institucional desde Historial antes de entregar comprobante.`;
      dispatch({ type: 'SET_RECEIPT', payload: null });
      dispatch({ type: 'SET_INSTITUTIONAL_RECEIPT', payload: null });
      dispatch({ type: 'SET_INSTITUTIONAL_RECEIPT_RECOVERY_MESSAGE', payload: recoveryMessage });
      dispatch({ type: 'SET_SHOW_RECEIPT', payload: false });
      dispatch({ type: 'SET_SHOW_SUCCESS', payload: true });
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: null });
      dispatch({ type: 'SET_WARNING_MESSAGE', payload: recoveryMessage });
      onStatus(recoveryMessage);
    }
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

  async function handleSaveIssuedReceiptPdf() {
    if (!state.institutionalReceipt) return;

    try {
      const blob = await apiClient.getInstitutionalReceiptPdf(state.institutionalReceipt.id);
      downloadBlob(blob, institutionalReceiptPdfFilename(state.institutionalReceipt.receipt_number_full));
      onStatus(`PDF institucional ${state.institutionalReceipt.receipt_number_full} guardado.`);
    } catch (error) {
      onStatus(userSafeErrorMessage(error, 'No se pudo guardar el PDF institucional.'));
    }
  }

  function handleNuevaFactura() {
    latestPaymentResultRef.current = null;
    dispatch({ type: 'RESET_FORM', payload: { loadedCashSession: state.loadedCashSession } });
    window.setTimeout(() => patientInputRef.current?.focus(), 0);
  }

  function handlePaymentOpenChange(nextOpen: boolean) {
    if (state.paying) {
      return;
    }
    if (!nextOpen) {
      resetPayloadScopedIdempotencyKey(submitPaymentIdempotencyKeyRef, submitPaymentIdempotencySignatureRef);
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
      dispatch({ type: 'SET_SHOW_SUCCESS', payload: true });
    }
  }

  return (
    <NewInvoiceViewLayout
      state={state}
      paymentResult={latestPaymentResultRef.current}
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
      onSaveIssuedReceiptPdf={() => void handleSaveIssuedReceiptPdf()}
      onNuevaFactura={handleNuevaFactura}
      onSuccessDialogChange={(val) => dispatch({ type: 'SET_SHOW_SUCCESS', payload: val })}
      onReceiptOpenChange={handleReceiptOpenChange}
      onClearCart={handleClearCart}
      onClearConfirmChange={(val) => dispatch({ type: 'SET_SHOW_CLEAR_CONFIRM', payload: val })}
      patientInputRef={patientInputRef}
      searchInputRef={searchInputRef}
      scannerInputRef={scannerInputRef}
    />
  );
}
