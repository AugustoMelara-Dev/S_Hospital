import type { Category, CashSession, InstitutionalReceipt, Invoice, Payment, ReceiptData, Service, ServiceArea } from '../../../lib/api';
import type { CartItem } from '../components/InvoiceCart';

export interface NewInvoiceState {
  patientName: string;
  patientError: string | undefined;
  search: string;
  scanCode: string;
  categories: Category[];
  serviceAreas: ServiceArea[];
  services: Service[];
  loadedCashSession: CashSession | null;
  selectedAreaId: number | 'all' | undefined;
  selectedCategoryId: number | 'all' | undefined;
  cartItems: CartItem[];
  issuedInvoice: Invoice | null;
  paymentMethod: Payment['method'];
  paymentAmount: string;
  paymentReference: string;
  previewBeforePrint: boolean;
  receiptWidth: ReceiptData['width'];
  scannerEnabled: boolean;
  partialPaymentsEnabled: boolean;
  receipt: ReceiptData | null;
  institutionalReceipt: InstitutionalReceipt | null;
  pointOfSaleLoadError: string | null;
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
  scanningCode: boolean;
  submitting: boolean;
  paying: boolean;
}

export type NewInvoiceAction =
  | { type: 'SET_PATIENT_NAME'; payload: string }
  | { type: 'SET_PATIENT_ERROR'; payload: string | undefined }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_SCAN_CODE'; payload: string }
  | { type: 'SET_CATEGORIES'; payload: Category[] }
  | { type: 'SET_SERVICE_AREAS'; payload: ServiceArea[] }
  | { type: 'SET_SERVICES'; payload: Service[] }
  | { type: 'SET_LOADED_CASH_SESSION'; payload: CashSession | null }
  | { type: 'SET_SELECTED_AREA_ID'; payload: number | 'all' | undefined }
  | { type: 'SET_SELECTED_CATEGORY_ID'; payload: number | 'all' | undefined }
  | { type: 'SET_CART_ITEMS'; payload: CartItem[] }
  | { type: 'SET_ISSUED_INVOICE'; payload: Invoice | null }
  | { type: 'SET_PAYMENT_METHOD'; payload: Payment['method'] }
  | { type: 'SET_PAYMENT_AMOUNT'; payload: string }
  | { type: 'SET_PAYMENT_REFERENCE'; payload: string }
  | { type: 'SET_PREVIEW_BEFORE_PRINT'; payload: boolean }
  | { type: 'SET_RECEIPT_WIDTH'; payload: ReceiptData['width'] }
  | { type: 'SET_SCANNER_ENABLED'; payload: boolean }
  | { type: 'SET_PARTIAL_PAYMENTS_ENABLED'; payload: boolean }
  | { type: 'SET_RECEIPT'; payload: ReceiptData | null }
  | { type: 'SET_INSTITUTIONAL_RECEIPT'; payload: InstitutionalReceipt | null }
  | { type: 'SET_POINT_OF_SALE_LOAD_ERROR'; payload: string | null }
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
  | { type: 'SET_SCANNING_CODE'; payload: boolean }
  | { type: 'SET_SUBMITTING'; payload: boolean }
  | { type: 'SET_PAYING'; payload: boolean }
  | { type: 'RESET_FORM'; payload: { loadedCashSession: CashSession | null } }
  | { type: 'LOAD_DATA_SUCCESS'; payload: { loadedCashSession: CashSession | null; categories: Category[]; serviceAreas: ServiceArea[]; services: Service[] } }
  | { type: 'SEARCH_SERVICES_SUCCESS'; payload: Service[] }
  | { type: 'ADD_TO_CART'; payload: Service }
  | { type: 'UPDATE_QUANTITY'; payload: { index: number; quantity: string } }
  | { type: 'UPDATE_DIALYSIS'; payload: { index: number; checked: boolean } }
  | { type: 'REMOVE_ITEM'; payload: number }
  | { type: 'CLEAR_CART_COMPLETELY' }
  | { type: 'CLEAR_SUCCESS_MESSAGE'; payload: string };

export function getInitialNewInvoiceState(cashSession: CashSession | null): NewInvoiceState {
  return {
    patientName: '',
    patientError: undefined,
    search: '',
    scanCode: '',
    categories: [],
    serviceAreas: [],
    services: [],
    loadedCashSession: cashSession,
    selectedAreaId: undefined,
    selectedCategoryId: undefined,
    cartItems: [],
    issuedInvoice: null,
    paymentMethod: 'cash',
    paymentAmount: '',
    paymentReference: '',
    previewBeforePrint: false,
    receiptWidth: 'half_letter',
    scannerEnabled: false,
    partialPaymentsEnabled: false,
    receipt: null,
    institutionalReceipt: null,
    pointOfSaleLoadError: null,
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
    scanningCode: false,
    submitting: false,
    paying: false,
  };
}
