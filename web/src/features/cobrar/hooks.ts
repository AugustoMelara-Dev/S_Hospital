import { useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { InvoicePreview, InvoicePreviewRequest } from '@/api/types';

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export const PREVIEW_DEBOUNCE_MS = 180;

export type PreviewState = {
  /** Preview for exactly the current request, or undefined. */
  data: InvoicePreview | undefined;
  /** Last preview received (possibly for an older request) — only for dimmed display. */
  last: InvoicePreview | undefined;
  calculating: boolean;
  error: string | null;
};

/**
 * POST /api/invoices/preview on every change (debounced). Responses are tagged with the
 * request they answer; an older response never overwrites a newer one (stale guard), and
 * `data` is only exposed when it matches the current request.
 */
export function useInvoicePreview(request: InvoicePreviewRequest | null): PreviewState {
  const key = request ? JSON.stringify(request) : '';
  const [result, setResult] = useState<{ key: string; data?: InvoicePreview; error?: string }>({ key: '' });
  const [last, setLast] = useState<InvoicePreview | undefined>(undefined);
  const seq = useRef(0);

  useEffect(() => {
    if (!key) return;
    const id = ++seq.current;
    const controller = new AbortController();
    const body = JSON.parse(key) as InvoicePreviewRequest;
    const timer = setTimeout(() => {
      api
        .post<InvoicePreview>('/invoices/preview', body, { signal: controller.signal })
        .then((data) => {
          if (id !== seq.current) return;
          setResult({ key, data });
          setLast(data);
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted || id !== seq.current) return;
          setResult({ key, error: errorMessage(e, 'No se pudo calcular el total.') });
        });
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);

  const fresh = key !== '' && result.key === key;
  return {
    data: fresh ? result.data : undefined,
    last: key ? last : undefined,
    calculating: key !== '' && !fresh,
    error: fresh ? (result.error ?? null) : null,
  };
}
