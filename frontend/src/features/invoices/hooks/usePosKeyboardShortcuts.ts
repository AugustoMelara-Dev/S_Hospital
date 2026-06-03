import { useEffect, type RefObject } from 'react';
import type { NewInvoiceState } from '../state/types';

export type UsePosKeyboardShortcutsArgs = {
  state: NewInvoiceState;
  canEmit: boolean;
  onEmit: () => void;
  onValidate: () => boolean;
  onShowClearConfirm: () => void;
  patientInputRef: RefObject<HTMLInputElement | null>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  scannerInputRef: RefObject<HTMLInputElement | null>;
};

/**
 * Wires the cashier keyboard shortcuts for the NewInvoiceView:
 *   - Ctrl+N focus patient
 *   - Ctrl+B focus search
 *   - Ctrl+K focus scanner
 *   - Esc       ask to clear when the form has data
 *   - Ctrl+Enter emit (or validate) when no dialog is open
 */
export function usePosKeyboardShortcuts({
  state,
  canEmit,
  onEmit,
  onValidate,
  onShowClearConfirm,
  patientInputRef,
  searchInputRef,
  scannerInputRef,
}: UsePosKeyboardShortcutsArgs): void {
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
          onShowClearConfirm();
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
    onEmit,
    onValidate,
    onShowClearConfirm,
    state.cartItems.length,
    state.patientName,
    state.scanCode,
    state.search,
    state.showClearConfirm,
    state.showConfirmation,
    state.showPayment,
    state.showReceipt,
    state.showSuccess,
    patientInputRef,
    searchInputRef,
    scannerInputRef,
  ]);
}
