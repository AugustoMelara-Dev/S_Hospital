import { useEffect, type Dispatch, type RefObject } from 'react';
import type { NewInvoiceAction } from '../state/types';

type NewInvoiceShortcutState = {
  patientName: string;
  search: string;
  scanCode: string;
  cartItemsLength: number;
  showConfirmation: boolean;
  showPayment: boolean;
  showSuccess: boolean;
  showReceipt: boolean;
  showClearConfirm: boolean;
};

type UseNewInvoiceShortcutsOptions = {
  canEmit: boolean;
  dispatch: Dispatch<NewInvoiceAction>;
  onEmit: () => void;
  onValidate: () => boolean;
  patientInputRef: RefObject<HTMLInputElement | null>;
  scannerInputRef: RefObject<HTMLInputElement | null>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  state: NewInvoiceShortcutState;
};

export function useNewInvoiceShortcuts({
  canEmit,
  dispatch,
  onEmit,
  onValidate,
  patientInputRef,
  scannerInputRef,
  searchInputRef,
  state,
}: UseNewInvoiceShortcutsOptions) {
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
        if (state.patientName || state.search || state.scanCode || state.cartItemsLength > 0) {
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
          onEmit();
        } else {
          onValidate();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    canEmit,
    dispatch,
    onEmit,
    onValidate,
    patientInputRef,
    scannerInputRef,
    searchInputRef,
    state.cartItemsLength,
    state.patientName,
    state.scanCode,
    state.search,
    state.showClearConfirm,
    state.showConfirmation,
    state.showPayment,
    state.showReceipt,
    state.showSuccess,
  ]);
}
