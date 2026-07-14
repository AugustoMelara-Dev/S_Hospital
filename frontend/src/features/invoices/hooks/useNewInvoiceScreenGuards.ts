import { useEffect, type RefObject } from 'react';

type UseNewInvoiceScreenGuardsOptions = {
  cartItemsLength: number;
  patientInputRef: RefObject<HTMLInputElement | null>;
  patientName: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
};

export function useNewInvoiceScreenGuards({
  cartItemsLength,
  patientInputRef,
  patientName,
  searchInputRef,
}: UseNewInvoiceScreenGuardsOptions) {
  useEffect(() => {
    window.setTimeout(() => {
      if (patientName.trim()) {
        searchInputRef.current?.focus();
        return;
      }
      patientInputRef.current?.focus();
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cartItemsLength === 0) {
      return;
    }

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [cartItemsLength]);
}
