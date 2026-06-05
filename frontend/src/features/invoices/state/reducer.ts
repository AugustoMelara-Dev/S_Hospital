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
    case 'SET_SCANNER_ENABLED':
      return { ...state, scannerEnabled: action.payload };
    case 'SET_PARTIAL_PAYMENTS_ENABLED':
      return { ...state, partialPaymentsEnabled: action.payload };
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
      const nextCart = addServiceToCart(state.cartItems, action.payload);
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
        selectedCategoryId: 'all',
      };
    case 'CLEAR_SUCCESS_MESSAGE':
      if (state.successMessage === action.payload) {
        return { ...state, successMessage: null };
      }
      return state;
    case 'RESET_FORM':
      return getInitialNewInvoiceState(action.payload.loadedCashSession);
    default:
      return state;
  }
}

function addServiceToCart(cartItems: CartItem[], service: CartItem['service']): CartItem[] {
  const existingIndex = cartItems.findIndex(
    (item) => item.service.id === service.id && !item.dialysisPrescription,
  );

  if (existingIndex === -1) {
    return [...cartItems, { service, quantity: '1', dialysisPrescription: false }];
  }

  return cartItems.map((item, idx) =>
    idx === existingIndex
      ? { ...item, quantity: incrementQuantityFromString(item.quantity) }
      : item,
  );
}
