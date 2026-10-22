import { useEffect, useRef, useState } from 'react';
import { apiClient, userSafeErrorMessage, type InvoicePreview } from '@/lib/api';
import { ERYTHROPOIETIN_RULE } from '../state/domain';
import type { CobrarLine } from '../state/types';

type UseCobrarPreviewArgs = {
  lines: CobrarLine[];
  patientName: string;
  canMarkDialysisPrescription: boolean;
  enabled: boolean;
  /** Revisión vigente de la cuenta; etiqueta la valoración que corresponde. */
  revision: number;
  /** Cambia para forzar una nueva valoración (Reintentar). */
  reloadToken?: number;
};

export type CobrarPreviewState = {
  preview: InvoicePreview | null;
  previewing: boolean;
  previewError: string | null;
  /** Revisión a la que pertenece `preview`; `null` si no hay valoración. */
  previewRevision: number | null;
};

/**
 * Valoración autoritativa del servidor (`POST /api/invoices/preview`).
 *
 * Cualquier cambio de paciente, línea, cantidad o condición cambia la firma y
 * dispara una nueva valoración; la anterior deja de corresponder a la revisión
 * y no puede confirmarse. Las respuestas tardías se descartan por id.
 * Un fallo deja `preview` en `null`; nunca se fabrica un total cero.
 */
export function useCobrarPreview({
  lines,
  patientName,
  canMarkDialysisPrescription,
  enabled,
  revision,
  reloadToken = 0,
}: UseCobrarPreviewArgs): CobrarPreviewState {
  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewRevision, setPreviewRevision] = useState<number | null>(null);
  const requestIdRef = useRef(0);
  const hasPrescription =
    canMarkDialysisPrescription
    && lines.some(
      (line) => line.dialysisPrescription && line.service.special_rule_code === ERYTHROPOIETIN_RULE,
    );

  useEffect(() => {
    if (!enabled || lines.length === 0) {
      requestIdRef.current += 1;
      setPreview(null);
      setPreviewing(false);
      setPreviewError(null);
      setPreviewRevision(null);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setPreviewing(true);
    setPreviewError(null);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const next = await apiClient.previewInvoice({
            items: lines.map((line) => ({ service_id: line.service.id, quantity: line.quantity })),
            ...(hasPrescription ? { dialysis_prescription: true } : {}),
          });

          if (requestId !== requestIdRef.current) return;

          setPreview(next);
          setPreviewRevision(revision);
          setPreviewing(false);
        } catch (error) {
          if (requestId !== requestIdRef.current) return;

          setPreview(null);
          setPreviewRevision(null);
          setPreviewError(
            userSafeErrorMessage(
              error,
              'No se pudo confirmar el total. Revise la conexión y vuelva a intentar; no se emitió nada.',
            ),
          );
          setPreviewing(false);
        }
      })();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [enabled, hasPrescription, lines, patientName, reloadToken, revision]);

  return { preview, previewing, previewError, previewRevision };
}
