import type { CartItem } from '../components/InvoiceCart';
import { incrementQuantityFromString } from './posMath';
import { getInitialNewInvoiceState, type NewInvoiceAction, type NewInvoiceState } from './types';

export function newInvoiceReducer(state: NewInvoiceState, action: NewInvoiceAction): NewInvoiceState {
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
    case 'SET_SERVICE_AREAS':
      return { ...state, serviceAreas: action.payload };
    case 'SET_SERVICES':
      return { ...state, services: action.payload };
    case 'APPEND_SERVICES_PAGE': {
      const existingIds = new Set(state.services.map((service) => service.id));
      return {
        ...state,
        services: [...state.services, ...action.payload.services.filter((service) => !existingIds.has(service.id))],
        servicePage: action.payload.page,
        hasMoreServices: action.payload.hasMore,
      };
    }
    case 'SET_SERVICE_PAGE_STATE':
      return { ...state, servicePage: action.payload.page, hasMoreServices: action.payload.hasMore };
    case 'SET_LOADING_MORE_SERVICES':
      return { ...state, loadingMoreServices: action.payload };
    case 'SET_LOADED_CASH_SESSION':
      return { ...state, loadedCashSession: action.payload };
    case 'SET_SELECTED_AREA_ID':
      return { ...state, selectedAreaId: action.payload };
    case 'SET_SELECTED_CATEGORY_ID':
      return { ...state, selectedCategoryId: action.payload };
    case 'SET_CART_ITEMS':
      return { ...state, cartItems: normalizeErythropoietinPrescription(action.payload) };
    case 'SET_ISSUED_INVOICE':
      return { ...state, issuedInvoice: action.payload };
    case 'SET_PAYMENT_METHOD':
      return { ...state, paymentMethod: action.payload };
    case 'SET_PAYMENT_AMOUNT':
      return { ...state, paymentAmount: action.payload };
    case 'SET_PAYMENT_REFERENCE':
      return { ...state, paymentReference: action.payload };
    case 'SET_PAYMENT_ERROR':
      return { ...state, paymentError: action.payload };
    case 'SET_COMPLETED_PAYMENT_CASH':
      return {
        ...state,
        completedPaymentReceivedAmount: action.payload.receivedAmount,
        completedPaymentChangeAmount: action.payload.changeAmount,
      };
    case 'SET_RECEIPT_WIDTH':
      return { ...state, receiptWidth: action.payload };
    case 'SET_SCANNER_ENABLED':
      return { ...state, scannerEnabled: action.payload };
    case 'SET_PARTIAL_PAYMENTS_ENABLED':
      return { ...state, partialPaymentsEnabled: action.payload };
    case 'SET_RECEIPT':
      return { ...state, receipt: action.payload };
    case 'SET_INSTITUTIONAL_RECEIPT':
      return {
        ...state,
        institutionalReceipt: action.payload,
        institutionalReceiptRecoveryMessage: action.payload ? null : state.institutionalReceiptRecoveryMessage,
      };
    case 'SET_INSTITUTIONAL_RECEIPT_RECOVERY_MESSAGE':
      return { ...state, institutionalReceiptRecoveryMessage: action.payload };
    case 'SET_POINT_OF_SALE_LOAD_ERROR':
      return { ...state, pointOfSaleLoadError: action.payload };
    case 'SET_ALERT_MESSAGE':
      return { ...state, alertMessage: action.payload };
    case 'SET_WARNING_MESSAGE':
      return { ...state, warningMessage: action.payload };
    case 'SET_SUCCESS_MESSAGE':
      return { ...state, successMessage: action.payload };
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
    case 'SET_SCANNING_CODE':
      return { ...state, scanningCode: action.payload };
    case 'SET_SUBMITTING':
      return { ...state, submitting: action.payload };
    case 'SET_PAYING':
      return { ...state, paying: action.payload };
    case 'LOAD_DATA_SUCCESS':
      return {
        ...state,
        loadedCashSession: action.payload.loadedCashSession,
        categories: action.payload.categories,
        serviceAreas: action.payload.serviceAreas,
        services: action.payload.services,
        pointOfSaleLoadError: null,
      };
    case 'SEARCH_SERVICES_SUCCESS':
      return { ...state, services: action.payload, servicePage: 1 };
    case 'ADD_TO_CART': {
      const nextCart = addServiceToCart(state.cartItems, action.payload);
      return {
        ...state,
        cartItems: nextCart,
        issuedInvoice: null,
        institutionalReceipt: null,
        institutionalReceiptRecoveryMessage: null,
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
    case 'UPDATE_DIALYSIS': {
      const targetService = state.cartItems[action.payload.index]?.service;

      if (!isErythropoietin(targetService)) {
        return state;
      }

      return {
        ...state,
        cartItems: state.cartItems.map((item) =>
          isErythropoietin(item.service)
            ? { ...item, dialysisPrescription: action.payload.checked }
            : item,
        ),
      };
    }
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
        institutionalReceiptRecoveryMessage: null,
        pointOfSaleLoadError: null,
        search: '',
        scanCode: '',
        selectedAreaId: undefined,
        selectedCategoryId: undefined,
      };
    case 'CLEAR_SUCCESS_MESSAGE':
      if (state.successMessage === action.payload) {
        return { ...state, successMessage: null };
      }
      return state;
    case 'RESET_FORM': {
      const initialState = getInitialNewInvoiceState(action.payload.loadedCashSession);
      return {
        ...initialState,
        categories: state.categories,
        serviceAreas: state.serviceAreas,
        services: state.services,
        servicePage: state.servicePage,
        hasMoreServices: state.hasMoreServices,
        scannerEnabled: state.scannerEnabled,
        partialPaymentsEnabled: state.partialPaymentsEnabled,
        loadingServices: false,
      };
    }
    default:
      return state;
  }
}

function addServiceToCart(cartItems: CartItem[], service: CartItem['service']): CartItem[] {
  const normalizedCartItems = normalizeErythropoietinPrescription(cartItems);
  const existingIndex = normalizedCartItems.findIndex((item) => item.service.id === service.id);

  if (existingIndex === -1) {
    const dialysisPrescription = isErythropoietin(service)
      && normalizedCartItems.some((item) => isErythropoietin(item.service) && item.dialysisPrescription);
    return [...normalizedCartItems, { service, quantity: '1', dialysisPrescription }];
  }

  return normalizedCartItems.map((item, idx) =>
    idx === existingIndex
      ? { ...item, quantity: incrementQuantityFromString(item.quantity) }
      : item,
  );
}

const ERYTHROPOIETIN_RULE = 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION';

function isErythropoietin(service: CartItem['service'] | undefined): boolean {
  return service?.special_rule_code === ERYTHROPOIETIN_RULE;
}

function normalizeErythropoietinPrescription(cartItems: CartItem[]): CartItem[] {
  const dialysisPrescription = cartItems.some(
    (item) => isErythropoietin(item.service) && item.dialysisPrescription,
  );

  return cartItems.map((item) => ({
    ...item,
    dialysisPrescription: isErythropoietin(item.service) ? dialysisPrescription : false,
  }));
}
