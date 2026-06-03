import { useCallback, useReducer, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CashSession } from '../../lib/api';
import { newInvoiceReducer } from './state/reducer';
import { getInitialNewInvoiceState, type NewInvoiceState } from './state/types';
import { usePosDataLoader } from './hooks/usePosDataLoader';
import { usePosCartActions } from './hooks/usePosCartActions';
import { useInvoiceLifecycle } from './hooks/useInvoiceLifecycle';
import { usePaymentLifecycle } from './hooks/usePaymentLifecycle';
import { usePosKeyboardShortcuts } from './hooks/usePosKeyboardShortcuts';
import { NewInvoiceViewLayout } from './components/NewInvoiceViewLayout';

export type NewInvoiceViewProps = {
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
  const [state, dispatch] = useReducer(newInvoiceReducer, cashSession, getInitialNewInvoiceState);
  const queryClient = useQueryClient();

  const patientInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const scannerInputRef = useRef<HTMLInputElement | null>(null);
  const initialPatientNameRef = useRef<string>(state.patientName);

  const { fiscalSettings } = usePosDataLoader({
    state,
    dispatch,
    canViewCatalog,
    cashSession,
    onCashSessionChange,
    onStatus,
    patientInputRef,
    searchInputRef,
    initialPatientNameRef,
  });

  const {
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
  } = usePosCartActions({
    state,
    dispatch,
    onStatus,
    fiscalTaxRate: fiscalSettings?.default_tax_rate,
    patientInputRef,
    searchInputRef,
    scannerInputRef,
  });

  const { validateForm, handleEmitClick, submitInvoice, handleNuevaFactura, handleCobrarClick } = useInvoiceLifecycle({
    state,
    dispatch,
    onStatus,
    canCreatePayments,
    canViewReceipts,
    patientInputRef,
  });

  const { submitPayment, loadReceipt, handlePaymentOpenChange, handleReceiptOpenChange } = usePaymentLifecycle({
    state,
    dispatch,
    onStatus,
    queryClient,
  });

  const handleClearCart = useCallback(() => {
    clearCart();
    onStatus('Carrito limpiado.');
    window.setTimeout(() => patientInputRef.current?.focus(), 0);
  }, [clearCart, onStatus]);

  usePosKeyboardShortcuts({
    state,
    canEmit,
    onEmit: handleEmitClick,
    onValidate: validateForm,
    onShowClearConfirm: () => dispatch({ type: 'SET_SHOW_CLEAR_CONFIRM', payload: true }),
    patientInputRef,
    searchInputRef,
    scannerInputRef,
  });

  return (
    <NewInvoiceViewLayout
      state={state}
      preview={preview}
      emitBlockReasons={emitBlockReasons}
      canEmit={canEmit}
      canCreatePayments={canCreatePayments}
      canViewReceipts={canViewReceipts}
      onOpenCash={onOpenCash}
      onPatientNameChange={handlePatientNameChange}
      onPatientSubmit={handlePatientSubmit}
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
      onPreviewBeforePrintChange={(val) => dispatch({ type: 'SET_PREVIEW_BEFORE_PRINT', payload: val })}
      onSubmitInvoice={() => void submitInvoice()}
      onCobrar={handleCobrarClick}
      onPaymentOpenChange={handlePaymentOpenChange}
      onSubmitPayment={(appliedAmount) => void submitPayment(appliedAmount)}
      onLoadReceipt={loadReceipt}
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

export type { NewInvoiceState };
