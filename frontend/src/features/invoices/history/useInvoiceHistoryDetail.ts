import { useEffect, useRef, useState, type RefObject } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import { type Invoice, apiClient, userSafeErrorMessage } from '../../../lib/api';

type UseInvoiceHistoryDetailOptions = {
  detailInvoiceId: number;
  /**
   * Parametro de URL del detalle. Por defecto `invoice` (historial historico);
   * la pantalla nueva de Recibos usa `operacion`.
   */
  detailParam?: string;
  historySectionRef: RefObject<HTMLElement | null>;
  invoicesList: Invoice[];
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
};

/**
 * Detalle de factura del historial: carga bajo demanda, sincronizacion con el
 * deep-link `?invoice=`/`?operacion=` y restauracion de foco al cerrar el panel.
 */
export function useInvoiceHistoryDetail({
  detailInvoiceId,
  detailParam = 'invoice',
  historySectionRef,
  invoicesList,
  searchParams,
  setSearchParams,
}: UseInvoiceHistoryDetailOptions) {
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const detailRequestRef = useRef(0);
  const detailRequestedInvoiceIdRef = useRef(0);
  const detailReturnFocusRef = useRef<HTMLElement | null>(null);
  const detailReturnFocusInvoiceIdRef = useRef<number | null>(null);
  const previousDetailInvoiceIdRef = useRef(detailInvoiceId);

  // Cerrar con el control del panel o navegar Atrás elimina el parámetro. En
  // ambos casos el foco vuelve a la fila que abrió el detalle; un enlace
  // directo usa la región del historial como alternativa segura.
  useEffect(() => {
    const previousDetailInvoiceId = previousDetailInvoiceIdRef.current;
    previousDetailInvoiceIdRef.current = detailInvoiceId;

    if (previousDetailInvoiceId > 0 && detailInvoiceId === 0) {
      restoreInvoiceDetailFocus();
    }
    // El efecto reacciona sólo a la identidad de URL; la función usa refs
    // mutables para encontrar el disparador actual después del desmontaje.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailInvoiceId]);

  useEffect(() => {
    if (!detailInvoiceId) {
      if (detailRequestedInvoiceIdRef.current !== 0) {
        detailRequestRef.current += 1;
        detailRequestedInvoiceIdRef.current = 0;
        setDetailInvoice(null);
        setDetailError('');
        setDetailLoading(false);
      }
      return;
    }
    if (detailRequestedInvoiceIdRef.current === detailInvoiceId) return;

    const summary = invoicesList.find((invoice) => invoice.id === detailInvoiceId) ?? null;
    void openInvoiceDetail(summary ?? detailInvoiceId, false);
  // The detail loader deliberately reacts only to URL identity and list availability.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, invoicesList]);

  async function openInvoiceDetail(
    invoice: Invoice | number,
    updateUrl = true,
    returnFocus: HTMLElement | null = null,
  ) {
    const invoiceId = typeof invoice === 'number' ? invoice : invoice.id;
    const previousRequestedInvoiceId = detailRequestedInvoiceIdRef.current;
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    detailRequestedInvoiceIdRef.current = invoiceId;
    if (updateUrl) detailReturnFocusRef.current = returnFocus;
    if (updateUrl) detailReturnFocusInvoiceIdRef.current = invoiceId;
    else if (previousRequestedInvoiceId !== invoiceId) detailReturnFocusRef.current = null;
    setDetailInvoice(typeof invoice === 'number' ? null : invoice);
    setDetailError('');
    setDetailLoading(true);

    if (updateUrl) {
      const next = new URLSearchParams(searchParams);
      next.set(detailParam, String(invoiceId));
      setSearchParams(next);
    }

    try {
      const detail = await apiClient.getInvoice(invoiceId);
      if (detailRequestRef.current === requestId) setDetailInvoice(detail);
    } catch (error) {
      if (detailRequestRef.current === requestId) {
        setDetailError(userSafeErrorMessage(error, 'No se pudo cargar el detalle de la factura.'));
      }
    } finally {
      if (detailRequestRef.current === requestId) setDetailLoading(false);
    }
  }

  function closeInvoiceDetail() {
    detailRequestRef.current += 1;
    setDetailInvoice(null);
    setDetailError('');
    setDetailLoading(false);
    const next = new URLSearchParams(searchParams);
    next.delete(detailParam);
    setSearchParams(next);
  }

  function restoreInvoiceDetailFocus() {
    const returnInvoiceId = detailReturnFocusInvoiceIdRef.current;
    const originalFocusTarget = detailReturnFocusRef.current;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const currentTriggers = returnInvoiceId
          ? Array.from(document.querySelectorAll<HTMLElement>(`[data-invoice-detail-trigger="${returnInvoiceId}"]`))
          : [];
        const visibleCurrentTrigger = currentTriggers.find((trigger) => trigger.getClientRects().length > 0)
          ?? currentTriggers[0]
          ?? null;
        const focusTarget = originalFocusTarget?.isConnected
          ? originalFocusTarget
          : visibleCurrentTrigger ?? historySectionRef.current;
        focusTarget?.focus();
        detailReturnFocusRef.current = null;
        detailReturnFocusInvoiceIdRef.current = null;
      });
    });
  }

  function synchronizeDetailInvoice(invoice: Invoice) {
    if (detailRequestedInvoiceIdRef.current === invoice.id) {
      setDetailInvoice(invoice);
      setDetailError('');
    }
  }

  return {
    detailInvoice,
    detailLoading,
    detailError,
    openInvoiceDetail,
    closeInvoiceDetail,
    restoreInvoiceDetailFocus,
    synchronizeDetailInvoice,
  };
}
