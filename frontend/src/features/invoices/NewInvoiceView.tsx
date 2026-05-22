import { useEffect, useCallback, useMemo, useRef, useReducer } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Dialog } from '../../components/ui/dialog';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { ReceiptPreview } from '../receipts/ReceiptPreview';
import { PatientStep } from './components/PatientStep';
import { ServiceSearch } from './components/ServiceSearch';
import { InvoiceCart, type CartItem } from './components/InvoiceCart';
import { InvoiceConfirmation } from './components/InvoiceConfirmation';
import { PaymentModal } from './components/PaymentModal';
import { InvoiceSuccess } from './components/InvoiceSuccess';
import { type Category, type CashSession, type Invoice, type Payment, type ReceiptData, type Service, apiClient, userSafeErrorMessage } from '../../lib/api';
import { invoiceSchema } from '../../schemas/invoice.schema';

const ERYTHROPOIETIN_RULE = 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION';
const POS_SERVICE_PAGE_SIZE = 24;

interface POSState {
  patientName: string;
  patientError: string | undefined;
  search: string;
  scanCode: string;
  categories: Category[];
  services: Service[];
  loadedCashSession: CashSession | null;
  selectedCategoryId: number | 'all' | undefined;
  cartItems: CartItem[];
  issuedInvoice: Invoice | null;
  paymentMethod: Payment['method'];
  paymentAmount: string;
  previewBeforePrint: boolean;
  receiptWidth: ReceiptData['width'];
  receipt: ReceiptData | null;
  alertMessage: string | null;
  warningMessage: string | null;
  successMessage: string | null;
  autoPrintReceipt: boolean;
  showConfirmation: boolean;
  showPayment: boolean;
  showSuccess: boolean;
  showReceipt: boolean;
  showClearConfirm: boolean;
  loadingServices: boolean;
  submitting: boolean;
  paying: boolean;
}

type POSAction =
  | { type: 'SET_PATIENT_NAME'; payload: string }
  | { type: 'SET_PATIENT_ERROR'; payload: string | undefined }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_SCAN_CODE'; payload: string }
  | { type: 'SET_CATEGORIES'; payload: Category[] }
  | { type: 'SET_SERVICES'; payload: Service[] }
  | { type: 'SET_LOADED_CASH_SESSION'; payload: CashSession | null }
  | { type: 'SET_SELECTED_CATEGORY_ID'; payload: number | 'all' | undefined }
  | { type: 'SET_CART_ITEMS'; payload: CartItem[] }
  | { type: 'SET_ISSUED_INVOICE'; payload: Invoice | null }
  | { type: 'SET_PAYMENT_METHOD'; payload: Payment['method'] }
  | { type: 'SET_PAYMENT_AMOUNT'; payload: string }
  | { type: 'SET_PREVIEW_BEFORE_PRINT'; payload: boolean }
  | { type: 'SET_RECEIPT_WIDTH'; payload: ReceiptData['width'] }
  | { type: 'SET_RECEIPT'; payload: ReceiptData | null }
  | { type: 'SET_ALERT_MESSAGE'; payload: string | null }
  | { type: 'SET_WARNING_MESSAGE'; payload: string | null }
  | { type: 'SET_SUCCESS_MESSAGE'; payload: string | null }
  | { type: 'SET_AUTO_PRINT_RECEIPT'; payload: boolean }
  | { type: 'SET_SHOW_CONFIRMATION'; payload: boolean }
  | { type: 'SET_SHOW_PAYMENT'; payload: boolean }
  | { type: 'SET_SHOW_SUCCESS'; payload: boolean }
  | { type: 'SET_SHOW_RECEIPT'; payload: boolean }
  | { type: 'SET_SHOW_CLEAR_CONFIRM'; payload: boolean }
  | { type: 'SET_LOADING_SERVICES'; payload: boolean }
  | { type: 'SET_SUBMITTING'; payload: boolean }
  | { type: 'SET_PAYING'; payload: boolean }
  | { type: 'RESET_FORM'; payload: { loadedCashSession: CashSession | null } }
  | { type: 'LOAD_DATA_SUCCESS'; payload: { loadedCashSession: CashSession | null; categories: Category[]; services: Service[] } }
  | { type: 'SEARCH_SERVICES_SUCCESS'; payload: Service[] }
  | { type: 'ADD_TO_CART'; payload: Service }
  | { type: 'UPDATE_QUANTITY'; payload: { index: number; quantity: string } }
  | { type: 'UPDATE_DIALYSIS'; payload: { index: number; checked: boolean } }
  | { type: 'REMOVE_ITEM'; payload: number }
  | { type: 'CLEAR_CART_COMPLETELY' }
  | { type: 'CLEAR_SUCCESS_MESSAGE'; payload: string };

function getInitialState(cashSession: CashSession | null): POSState {
  return {
    patientName: '',
    patientError: undefined,
    search: '',
    scanCode: '',
    categories: [],
    services: [],
    loadedCashSession: cashSession,
    selectedCategoryId: undefined,
    cartItems: [],
    issuedInvoice: null,
    paymentMethod: 'cash',
    paymentAmount: '',
    previewBeforePrint: false,
    receiptWidth: '80mm',
    receipt: null,
    alertMessage: null,
    warningMessage: null,
    successMessage: null,
    autoPrintReceipt: false,
    showConfirmation: false,
    showPayment: false,
    showSuccess: false,
    showReceipt: false,
    showClearConfirm: false,
    loadingServices: true,
    submitting: false,
    paying: false,
  };
}

function posReducer(state: POSState, action: POSAction): POSState {
  switch (action.type) {
    case 'SET_PATIENT_NAME':
      return { ...state, patientName: action.payload };
    case 'SET_PATIENT_ERROR':
      return { ...state, patientError: action.payload };
    case 'SET_SEARCH':
      return { ...state, search: action.payload };
    case 'SET_SCAN_CODE':
      return { ...state, scanCode: action.payload };
    case 'SET_CATEGORIES':
      return { ...state, categories: action.payload };
    case 'SET_SERVICES':
      return { ...state, services: action.payload };
    case 'SET_LOADED_CASH_SESSION':
      return { ...state, loadedCashSession: action.payload };
    case 'SET_SELECTED_CATEGORY_ID':
      return { ...state, selectedCategoryId: action.payload };
    case 'SET_CART_ITEMS':
      return { ...state, cartItems: action.payload };
    case 'SET_ISSUED_INVOICE':
      return { ...state, issuedInvoice: action.payload };
    case 'SET_PAYMENT_METHOD':
      return { ...state, paymentMethod: action.payload };
    case 'SET_PAYMENT_AMOUNT':
      return { ...state, paymentAmount: action.payload };
    case 'SET_PREVIEW_BEFORE_PRINT':
      return { ...state, previewBeforePrint: action.payload };
    case 'SET_RECEIPT_WIDTH':
      return { ...state, receiptWidth: action.payload };
    case 'SET_RECEIPT':
      return { ...state, receipt: action.payload };
    case 'SET_ALERT_MESSAGE':
      return { ...state, alertMessage: action.payload };
    case 'SET_WARNING_MESSAGE':
      return { ...state, warningMessage: action.payload };
    case 'SET_SUCCESS_MESSAGE':
      return { ...state, successMessage: action.payload };
    case 'SET_AUTO_PRINT_RECEIPT':
      return { ...state, autoPrintReceipt: action.payload };
    case 'SET_SHOW_CONFIRMATION':
      return { ...state, showConfirmation: action.payload };
    case 'SET_SHOW_PAYMENT':
      return { ...state, showPayment: action.payload };
    case 'SET_SHOW_SUCCESS':
      return { ...state, showSuccess: action.payload };
    case 'SET_SHOW_RECEIPT':
      return { ...state, showReceipt: action.payload };
    case 'SET_SHOW_CLEAR_CONFIRM':
      return { ...state, showClearConfirm: action.payload };
    case 'SET_LOADING_SERVICES':
      return { ...state, loadingServices: action.payload };
    case 'SET_SUBMITTING':
      return { ...state, submitting: action.payload };
    case 'SET_PAYING':
      return { ...state, paying: action.payload };
    case 'LOAD_DATA_SUCCESS':
      return {
        ...state,
        loadedCashSession: action.payload.loadedCashSession,
        categories: action.payload.categories,
        services: action.payload.services,
      };
    case 'SEARCH_SERVICES_SUCCESS':
      return { ...state, services: action.payload };
    case 'ADD_TO_CART': {
      const service = action.payload;
      const existingIndex = state.cartItems.findIndex(
        (item) => item.service.id === service.id && !item.dialysisPrescription,
      );

      let nextCart: CartItem[];
      if (existingIndex === -1) {
        nextCart = [
          ...state.cartItems,
          { service, quantity: '1', dialysisPrescription: false },
        ];
      } else {
        nextCart = state.cartItems.map((item, idx) =>
          idx === existingIndex
            ? { ...item, quantity: incrementQuantity(item.quantity) }
            : item,
        );
      }
      return {
        ...state,
        cartItems: nextCart,
        issuedInvoice: null,
        patientError: undefined,
      };
    }
    case 'UPDATE_QUANTITY':
      return {
        ...state,
        cartItems: state.cartItems.map((item, idx) =>
          idx === action.payload.index ? { ...item, quantity: action.payload.quantity } : item,
        ),
      };
    case 'UPDATE_DIALYSIS':
      return {
        ...state,
        cartItems: state.cartItems.map((item, idx) =>
          idx === action.payload.index ? { ...item, dialysisPrescription: action.payload.checked } : item,
        ),
      };
    case 'REMOVE_ITEM':
      return {
        ...state,
        cartItems: state.cartItems.filter((_, idx) => idx !== action.payload),
      };
    case 'CLEAR_CART_COMPLETELY':
      return {
        ...state,
        cartItems: [],
        patientName: '',
        patientError: undefined,
        alertMessage: null,
        warningMessage: null,
        successMessage: null,
        search: '',
        scanCode: '',
        selectedCategoryId: undefined,
      };
    case 'CLEAR_SUCCESS_MESSAGE':
      if (state.successMessage === action.payload) {
        return { ...state, successMessage: null };
      }
      return state;
    case 'RESET_FORM':
      return getInitialState(action.payload.loadedCashSession);
    default:
      return state;
  }
}

type NewInvoiceViewProps = {
  cashSession: CashSession | null;
  canCreatePayments?: boolean;
  canViewCatalog?: boolean;
  canViewReceipts?: boolean;
  onCashSessionChange?: (session: CashSession | null) => void;
  onOpenCash?: () => void;
  onStatus: (message: string) => void;
};

export function NewInvoiceView({
  cashSession,
  canCreatePayments = true,
  canViewCatalog = true,
  canViewReceipts = true,
  onCashSessionChange,
  onOpenCash,
  onStatus,
}: NewInvoiceViewProps) {
  const [state, dispatch] = useReducer(posReducer, cashSession, getInitialState);
  const {
    patientName,
    patientError,
    search,
    scanCode,
    categories,
    services,
    loadedCashSession,
    selectedCategoryId,
    cartItems,
    issuedInvoice,
    paymentMethod,
    paymentAmount,
    previewBeforePrint,
    receiptWidth,
    receipt,
    alertMessage,
    warningMessage,
    successMessage,
    autoPrintReceipt,
    showConfirmation,
    showPayment,
    showSuccess,
    showReceipt,
    showClearConfirm,
    loadingServices,
    submitting,
    paying,
  } = state;

  const patientInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const scannerInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void loadPointOfSaleData();
  }, []);

  useEffect(() => {
    window.setTimeout(() => {
      if (patientName.trim()) {
        searchInputRef.current?.focus();
        return;
      }

      patientInputRef.current?.focus();
    }, 0);
  }, []);

  useEffect(() => {
    if (!canViewCatalog) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void searchPointOfSaleServices();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [canViewCatalog, search, selectedCategoryId]);

  useEffect(() => {
    if (cashSession) {
      dispatch({ type: 'SET_LOADED_CASH_SESSION', payload: cashSession });
    }
  }, [cashSession]);

  const handleClearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART_COMPLETELY' });
    onStatus('Carrito limpiado.');
    window.setTimeout(() => patientInputRef.current?.focus(), 0);
  }, [onStatus]);

  const emitBlockReasons = [
    !loadedCashSession ? 'Abra caja antes de emitir y cobrar una factura.' : null,
    patientName.trim() === '' ? 'Ingrese el nombre del paciente para emitir.' : null,
    cartItems.length === 0 ? 'Agregue al menos un servicio.' : null,
  ].filter((reason): reason is string => Boolean(reason));
  const canEmit = emitBlockReasons.length === 0;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInsideDialog = Boolean(target.closest('[data-dialog-content], [role="dialog"], [role="alertdialog"]'));
      const hasOpenOverlay = showConfirmation || showPayment || showSuccess || showReceipt || showClearConfirm;

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
        if (showConfirmation || showPayment || showSuccess || showReceipt) return;
        if (target.closest('[data-dialog-content]')) return;
        if (patientName || search || scanCode || cartItems.length > 0) {
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
  }, [canEmit, cartItems.length, handleClearCart, patientName, scanCode, search, showClearConfirm, showConfirmation, showPayment, showReceipt, showSuccess]);

  const preview = useMemo(() => calculatePreview(cartItems), [cartItems]);

  async function loadPointOfSaleData() {
    if (!canViewCatalog) {
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: 'Este usuario no tiene permiso para consultar el catalogo de servicios.' });
      dispatch({ type: 'SET_LOADING_SERVICES', payload: false });
      return;
    }

    dispatch({ type: 'SET_LOADING_SERVICES', payload: true });

    try {
      const [currentCashSession, nextCategories, nextServices] = await Promise.all([
        apiClient.getCurrentCashSession(),
        apiClient.getCategories(true),
        apiClient.getServices({ active: true, perPage: POS_SERVICE_PAGE_SIZE }),
      ]);
      dispatch({
        type: 'LOAD_DATA_SUCCESS',
        payload: {
          loadedCashSession: currentCashSession,
          categories: Array.isArray(nextCategories) ? nextCategories : [],
          services: Array.isArray(nextServices) ? nextServices : [],
        },
      });
      onCashSessionChange?.(currentCashSession);
    } catch (error) {
      onStatus(userSafeErrorMessage(error, 'No se pudo cargar servicios activos.'));
    } finally {
      dispatch({ type: 'SET_LOADING_SERVICES', payload: false });
    }
  }

  async function searchPointOfSaleServices() {
    dispatch({ type: 'SET_LOADING_SERVICES', payload: true });

    try {
      const nextServices = await apiClient.getServices({
        active: true,
        search: search.trim() || undefined,
        categoryId: selectedCategoryId && selectedCategoryId !== 'all' ? selectedCategoryId : undefined,
        perPage: POS_SERVICE_PAGE_SIZE,
      });
      dispatch({ type: 'SEARCH_SERVICES_SUCCESS', payload: Array.isArray(nextServices) ? nextServices : [] });
    } catch (error) {
      onStatus(userSafeErrorMessage(error, 'No se pudo buscar servicios activos.'));
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
    const code = scanCode.trim();
    const refocusScanner = () => window.setTimeout(() => scannerInputRef.current?.focus(), 0);

    if (code === '') {
      const message = 'Ingrese o escanee un codigo.';
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: message });
      onStatus(message);
      refocusScanner();
      return;
    }

    try {
      const [service] = await apiClient.getServices({ code, perPage: 1 });

      if (!service) {
        const localMatch = services.find((s) =>
          [s.scan_code, s.barcode, s.qr_code].some((v) => v === code),
        );

        if (localMatch) {
          if (!localMatch.active) {
            const message = 'El servicio esta inactivo y no puede facturarse.';
            dispatch({ type: 'SET_ALERT_MESSAGE', payload: message });
            onStatus(message);
            refocusScanner();
            return;
          }
          addToCart(localMatch);
          dispatch({ type: 'SET_SCAN_CODE', payload: '' });
          dispatch({ type: 'SET_ALERT_MESSAGE', payload: null });
          onStatus(`Servicio agregado por codigo: ${localMatch.name}.`);
          refocusScanner();
          return;
        }

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
      const localMatch = services.find((s) =>
        [s.scan_code, s.barcode, s.qr_code].some((v) => v === code),
      );

      if (localMatch) {
        if (!localMatch.active) {
          const message = 'El servicio esta inactivo y no puede facturarse.';
          dispatch({ type: 'SET_ALERT_MESSAGE', payload: message });
          onStatus(message);
          refocusScanner();
          return;
        }
        addToCart(localMatch);
        dispatch({ type: 'SET_SCAN_CODE', payload: '' });
        dispatch({ type: 'SET_ALERT_MESSAGE', payload: null });
        onStatus(`Servicio agregado por codigo: ${localMatch.name}.`);
        refocusScanner();
        return;
      }

      const message = userSafeErrorMessage(error, 'No se pudo buscar el codigo escaneado.');
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: message });
      onStatus(message);
      refocusScanner();
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
    if (patientError && value.trim()) {
      dispatch({ type: 'SET_PATIENT_ERROR', payload: undefined });
    }
  }

  function handlePatientSubmit() {
    if (patientName.trim() === '') {
      dispatch({ type: 'SET_PATIENT_ERROR', payload: 'Ingrese el nombre del paciente para continuar.' });
      patientInputRef.current?.focus();
      return;
    }

    dispatch({ type: 'SET_PATIENT_ERROR', payload: undefined });
    searchInputRef.current?.focus();
  }

  function validateForm(): boolean {
    if (!loadedCashSession) {
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: 'Abra caja antes de emitir y cobrar una factura.' });
      onStatus('Abra caja antes de emitir y cobrar una factura.');
      return false;
    }

    const validationResult = invoiceSchema.safeParse({
      patient_name: patientName,
      items: cartItems.map((item) => ({
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
    dispatch({ type: 'SET_SUBMITTING', payload: true });
    dispatch({ type: 'SET_SHOW_CONFIRMATION', payload: false });
    dispatch({ type: 'SET_ALERT_MESSAGE', payload: null });
    dispatch({ type: 'SET_WARNING_MESSAGE', payload: null });

    try {
      const invoice = await apiClient.createInvoice({
        patient_name: patientName,
        items: cartItems.map((item) => ({
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
      if (loadedCashSession && Number(invoice.balance_due) > 0) {
        dispatch({ type: 'SET_SHOW_SUCCESS', payload: false });
        dispatch({ type: 'SET_SHOW_PAYMENT', payload: true });
        onStatus(`Factura emitida ${invoice.invoice_number}. Cobro abierto.`);
      } else if (isZeroMoney(invoice.total) && invoice.status === 'paid') {
        const nextReceipt = await apiClient.getReceipt(invoice.id, receiptWidth);
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
  }

  function handleCobrarClick() {
    if (!issuedInvoice || !loadedCashSession) {
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: 'Debe abrir caja antes de cobrar.' });
      return;
    }

    if (!canCreatePayments || !canViewReceipts) {
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: 'Este usuario no tiene permisos completos para cobrar e imprimir recibos.' });
      return;
    }

    dispatch({ type: 'SET_SHOW_SUCCESS', payload: false });
    dispatch({ type: 'SET_WARNING_MESSAGE', payload: null });
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      dispatch({ type: 'SET_PAYMENT_AMOUNT', payload: '0.00' });
    }
    dispatch({ type: 'SET_SHOW_PAYMENT', payload: true });
  }

  async function submitPayment(appliedAmount = paymentAmount) {
    if (!issuedInvoice || !loadedCashSession) {
      dispatch({ type: 'SET_SHOW_PAYMENT', payload: false });
      return;
    }

    const invoiceToPay = issuedInvoice;
    const sessionToUse = loadedCashSession;

    dispatch({ type: 'SET_PAYING', payload: true });
    dispatch({ type: 'SET_SHOW_PAYMENT', payload: false });

    try {
      const result = await apiClient.registerPayment(invoiceToPay.id, {
        cash_session_id: sessionToUse.id,
        method: paymentMethod,
        amount: appliedAmount,
      });

      dispatch({ type: 'SET_ISSUED_INVOICE', payload: result.invoice });
      dispatch({ type: 'SET_PAYMENT_AMOUNT', payload: result.invoice.balance_due });
      const nextReceipt = await apiClient.getReceipt(result.invoice.id, receiptWidth);
      dispatch({ type: 'SET_RECEIPT', payload: nextReceipt });
      dispatch({ type: 'SET_RECEIPT_WIDTH', payload: nextReceipt.width });
      dispatch({ type: 'SET_AUTO_PRINT_RECEIPT', payload: !previewBeforePrint });
      dispatch({ type: 'SET_SHOW_RECEIPT', payload: true });
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: null });
      dispatch({ type: 'SET_WARNING_MESSAGE', payload: null });
      onStatus(
        previewBeforePrint
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
  }

  async function loadReceipt(width: ReceiptData['width']) {
    dispatch({ type: 'SET_RECEIPT_WIDTH', payload: width });

    if (!issuedInvoice) return;

    try {
      const nextReceipt = await apiClient.getReceipt(issuedInvoice.id, width);
      dispatch({ type: 'SET_RECEIPT', payload: nextReceipt });
      dispatch({ type: 'SET_SHOW_RECEIPT', payload: true });
    } catch (error) {
      onStatus(userSafeErrorMessage(error, 'No se pudo generar el recibo.'));
    }
  }

  function handleNuevaFactura() {
    dispatch({ type: 'RESET_FORM', payload: { loadedCashSession } });
    window.setTimeout(() => patientInputRef.current?.focus(), 0);
  }

  function handlePaymentOpenChange(nextOpen: boolean) {
    dispatch({ type: 'SET_SHOW_PAYMENT', payload: nextOpen });

    if (!nextOpen && issuedInvoice && (issuedInvoice.status === 'issued' || issuedInvoice.status === 'partial')) {
      dispatch({ type: 'SET_SHOW_SUCCESS', payload: true });
      dispatch({
        type: 'SET_WARNING_MESSAGE',
        payload: `Factura ${issuedInvoice.invoice_number} emitida. Quedo pendiente de cobro; puede cobrarla desde este panel o desde Historial.`,
      });
      onStatus(`Factura ${issuedInvoice.invoice_number} emitida y pendiente de cobro.`);
    }
  }

  function handleReceiptOpenChange(nextOpen: boolean) {
    dispatch({ type: 'SET_SHOW_RECEIPT', payload: nextOpen });

    if (!nextOpen && (issuedInvoice?.status === 'paid' || issuedInvoice?.status === 'partial')) {
      dispatch({ type: 'SET_AUTO_PRINT_RECEIPT', payload: false });
      dispatch({ type: 'SET_SHOW_SUCCESS', payload: true });
    }
  }

  return (
    <section id="nueva-factura" className="flex flex-col h-full gap-4 p-4 lg:p-6">
      <header className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-normal text-primary">Caja hospitalaria</p>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">Nueva factura</h1>
          <p className="text-sm text-muted-foreground">Factura y cobro en caja</p>
        </div>
        <div className="flex items-center gap-3">
          {loadedCashSession ? (
            <Badge variant="default" className="text-sm">
              Caja #{loadedCashSession.id} - Abierta
            </Badge>
          ) : (
            <Badge variant="destructive" className="text-sm">
              Caja cerrada
            </Badge>
          )}
        </div>
      </header>

      {!loadedCashSession && (
        <Alert variant="warning" title="Caja no abierta">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="flex-1">Debe abrir la caja antes de emitir facturas.</span>
            {onOpenCash ? (
              <Button type="button" variant="secondary" size="sm" onClick={onOpenCash}>
                Abrir Caja
              </Button>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <Link to="/cashbox">Ir a caja</Link>
              </Button>
            )}
          </div>
        </Alert>
      )}

      {alertMessage && (
        <Alert variant="destructive" title="Revise antes de continuar">
          {alertMessage}
        </Alert>
      )}

      {warningMessage && (
        <Alert variant="warning" title="Factura pendiente">
          {warningMessage}
        </Alert>
      )}

      {successMessage && (
        <Alert variant="success" title="Servicio agregado">
          {successMessage.replace(/^Agregado: /, '')}
        </Alert>
      )}

      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_380px] lg:min-h-0">
        <div className="flex flex-col gap-4 lg:min-h-0 lg:overflow-hidden">
          <Card className="lg:shrink-0">
            <CardContent className="pt-5">
              <PatientStep
                ref={patientInputRef}
                patientName={patientName}
                onPatientNameChange={handlePatientNameChange}
                onPatientSubmit={handlePatientSubmit}
                error={patientError}
              />
            </CardContent>
          </Card>

          <Card className="lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
            <CardContent className="lg:flex-1 lg:min-h-0 lg:overflow-hidden">
              <ServiceSearch
                categories={categories}
                services={services}
                selectedCategoryId={selectedCategoryId}
                onCategoryChange={(val) => dispatch({ type: 'SET_SELECTED_CATEGORY_ID', payload: val })}
                search={search}
                onSearchChange={(val) => dispatch({ type: 'SET_SEARCH', payload: val })}
                scanCode={scanCode}
                onScanCodeChange={(val) => dispatch({ type: 'SET_SCAN_CODE', payload: val })}
                onAddService={addToCart}
                onAddByScanCode={addByScanCode}
                searchInputRef={searchInputRef}
                scannerInputRef={scannerInputRef}
                loading={loadingServices}
              />
            </CardContent>
          </Card>
        </div>

        <Card className="lg:sticky lg:top-4 lg:h-fit lg:shrink-0">
          <CardContent className="pt-5">
            <InvoiceCart
              items={cartItems}
              preview={preview}
              onUpdateQuantity={updateQuantity}
              onUpdateDialysisPrescription={updateDialysisPrescription}
              onRemoveItem={removeItem}
              onConfirm={handleEmitClick}
              disabled={submitting || !canEmit}
              disabledReasons={emitBlockReasons}
              actionLabel={canCreatePayments && canViewReceipts ? 'Emitir y cobrar' : 'Emitir factura'}
              emptyActionLabel="Agregue servicios"
              submitting={submitting}
            />
          </CardContent>
        </Card>
      </div>

      <InvoiceConfirmation
        open={showConfirmation}
        onOpenChange={(val) => dispatch({ type: 'SET_SHOW_CONFIRMATION', payload: val })}
        patientName={patientName}
        items={cartItems}
        preview={preview}
        cashSessionId={loadedCashSession?.id}
        onConfirm={() => void submitInvoice()}
        submitting={submitting}
      />

      {issuedInvoice && (
        <PaymentModal
          open={showPayment}
          onOpenChange={handlePaymentOpenChange}
          invoiceNumber={issuedInvoice.invoice_number}
          patientName={issuedInvoice.patient_name}
          total={issuedInvoice.total}
          balanceDue={issuedInvoice.balance_due}
          paymentMethod={paymentMethod}
          paymentAmount={paymentAmount}
          previewBeforePrint={previewBeforePrint}
          onPaymentMethodChange={(val) => dispatch({ type: 'SET_PAYMENT_METHOD', payload: val })}
          onPaymentAmountChange={(val) => dispatch({ type: 'SET_PAYMENT_AMOUNT', payload: val })}
          onPreviewBeforePrintChange={(val) => dispatch({ type: 'SET_PREVIEW_BEFORE_PRINT', payload: val })}
          onConfirm={(appliedAmount) => void submitPayment(appliedAmount)}
          submitting={paying}
        />
      )}

      {issuedInvoice && (
        <InvoiceSuccess
          open={showSuccess}
          onOpenChange={(val) => dispatch({ type: 'SET_SHOW_SUCCESS', payload: val })}
          invoiceNumber={issuedInvoice.invoice_number}
          patientName={issuedInvoice.patient_name}
          total={issuedInvoice.total}
          status={issuedInvoice.status}
          onCobrar={handleCobrarClick}
          onImprimir={() => void loadReceipt(receiptWidth)}
          onNuevaFactura={handleNuevaFactura}
        />
      )}

      <Dialog
        open={showReceipt && Boolean(receipt)}
        onOpenChange={handleReceiptOpenChange}
        size="lg"
        title="Vista previa del recibo"
        description="Solo el ticket se imprime."
      >
        {receipt ? (
          <ReceiptPreview
            autoPrint={autoPrintReceipt}
            receipt={receipt}
            onWidthChange={loadReceipt}
            onNewInvoice={handleNuevaFactura}
            onPrint={() => dispatch({ type: 'SET_AUTO_PRINT_RECEIPT', payload: false })}
          />
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={showClearConfirm}
        title="Limpiar factura en curso"
        confirmLabel="Limpiar"
        cancelLabel="Seguir editando"
        onCancel={() => dispatch({ type: 'SET_SHOW_CLEAR_CONFIRM', payload: false })}
        onConfirm={() => {
          dispatch({ type: 'SET_SHOW_CLEAR_CONFIRM', payload: false });
          handleClearCart();
        }}
      >
        Se borraran paciente, busqueda y servicios agregados. Use esta accion solo si quiere empezar de nuevo.
      </ConfirmDialog>

    </section>
  );
}

function calculatePreview(items: CartItem[]) {
  const subtotal = items.reduce((total, item) => {
    const unitPrice = item.dialysisPrescription && item.service.special_rule_code === ERYTHROPOIETIN_RULE
      ? 0
      : parseCents(item.service.price);
    const quantity = parseQuantityUnits(item.quantity);
    return total + Math.trunc((unitPrice * quantity + 50) / 100);
  }, 0);

  const tax = items.reduce((total, item) => {
    if (!item.service.taxable) return total;
    const unitPrice = item.dialysisPrescription && item.service.special_rule_code === ERYTHROPOIETIN_RULE
      ? 0
      : parseCents(item.service.price);
    const quantity = parseQuantityUnits(item.quantity);
    const lineSubtotal = Math.trunc((unitPrice * quantity + 50) / 100);
    return total + Math.trunc((lineSubtotal * 1500 + 5000) / 10000);
  }, 0);

  return {
    subtotal: formatCents(subtotal),
    tax: formatCents(tax),
    total: formatCents(subtotal + tax),
  };
}

function isZeroMoney(value: string): boolean {
  return Number(value) === 0;
}

function parseCents(value: string): number {
  const [integer, decimal = '00'] = value.split('.');
  return Number(integer) * 100 + Number(decimal.padEnd(2, '0').slice(0, 2));
}

function parseQuantityUnits(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return 0;
  const [integer, decimal = '00'] = value.split('.');
  return Number(integer) * 100 + Number(decimal.padEnd(2, '0').slice(0, 2));
}

function incrementQuantity(value: string): string {
  const units = parseQuantityUnits(value);
  return formatCents(units + 100);
}

function formatCents(cents: number): string {
  return `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

