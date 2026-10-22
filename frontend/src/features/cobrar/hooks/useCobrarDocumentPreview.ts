import { useCallback, useRef, useState } from 'react';
import { userSafeErrorMessage, type InvoicePayload } from '@/lib/api';
import { billing, type InvoiceReceiptPreview } from '@/lib/api/billing';

export function useCobrarDocumentPreview() {
  const [open, setOpen] = useState(false);
  const [document, setDocument] = useState<InvoiceReceiptPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const payloadRef = useRef<InvoicePayload | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async (payload: InvoicePayload) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    payloadRef.current = payload;
    setOpen(true);
    setDocument(null);
    setError(null);
    setLoading(true);

    try {
      const next = await billing.previewInvoiceReceipt(payload);
      if (requestId !== requestIdRef.current) return;
      setDocument(next);
    } catch (cause) {
      if (requestId !== requestIdRef.current) return;
      setError(
        userSafeErrorMessage(
          cause,
          'No se pudo preparar la vista previa. Revise la conexión y vuelva a intentar.',
        ),
      );
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  const retry = useCallback(() => {
    if (payloadRef.current) void load(payloadRef.current);
  }, [load]);

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) requestIdRef.current += 1;
  }, []);

  return { open, onOpenChange, document, loading, error, load, retry };
}
