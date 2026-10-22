import { useQuery } from '@tanstack/react-query';
import { AdminCallout, AdminChip, AdminSpinner } from '@/design-system/admin/components';
import { SECONDARY_BUTTON } from '@/features/invoices/history/adminOverlayUi';
import { institutionalReceipts } from '@/lib/api/institutionalReceipts';
import { userSafeErrorMessage } from '@/lib/api';
import {
  documentExemplarsLabel,
  reprintNoticeLabel,
  summarizeReceiptDocument,
} from './receiptDocumentSummary';

type InstitutionalReceiptPreviewFrameProps = {
  receiptId: number;
  receiptNumber: string;
};

/**
 * Vista previa del comprobante institucional ya emitido.
 *
 * Estados distintos y anunciados por separado: preparando, error, documento
 * incompleto y documento listo. El marco renderiza el documento real que genera
 * el mismo motor del PDF (`?preview=1`), y declara los ejemplares que ese
 * documento trae. El conteo físico de páginas queda en el plan medido del
 * generador; la UI no lo infiere del HTML ni deja un marco en blanco cuando lo
 * recibido no es el comprobante completo.
 */
export function InstitutionalReceiptPreviewFrame({
  receiptId,
  receiptNumber,
}: InstitutionalReceiptPreviewFrameProps) {
  const preview = useQuery({
    queryKey: ['institutional-receipts', receiptId, 'html-preview'],
    queryFn: () => institutionalReceipts.previewHtml(receiptId),
    staleTime: 60_000,
  });

  if (preview.isLoading) {
    return (
      <div
        role="status"
        aria-label="Preparando vista previa del recibo"
        className="flex min-h-48 items-center justify-center gap-2 rounded-[var(--ui-radius-panel)] border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]"
      >
        <AdminSpinner />
        <span>Preparando la vista previa del recibo…</span>
      </div>
    );
  }

  if (preview.isError || !preview.data) {
    return (
      <AdminCallout tone="error" title="No se pudo preparar la vista previa">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>{userSafeErrorMessage(preview.error, 'Vuelva a intentarlo. Si el problema continúa, solicite apoyo.')}</span>
          <button type="button" className={SECONDARY_BUTTON} onClick={() => void preview.refetch()}>
            Reintentar
          </button>
        </div>
      </AdminCallout>
    );
  }

  const summary = summarizeReceiptDocument(preview.data);

  // Documento incompleto: se dice, no se pinta un marco blanco que aparente ser
  // el comprobante.
  if (summary.exemplarCount === 0) {
    return (
      <AdminCallout tone="warn" title="Vista previa incompleta">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Lo recibido para el recibo {receiptNumber} no incluye las páginas del comprobante. Reintente o abra el PDF
            desde las acciones del comprobante.
          </span>
          <button type="button" className={SECONDARY_BUTTON} onClick={() => void preview.refetch()}>
            Reintentar
          </button>
        </div>
      </AdminCallout>
    );
  }

  return (
    <section aria-label="Vista previa del recibo" className="overflow-hidden bg-[var(--ui-surface-alt)]">
      <div
        role="status"
        className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]"
      >
        <span className="font-medium text-[color:var(--ui-ink)]">Vista previa del recibo</span>
        <span className="tabular-nums">{documentExemplarsLabel(summary)}</span>
        {summary.reprintLabel ? (
          <AdminChip tone="warn">{reprintNoticeLabel(summary.reprintLabel)}</AdminChip>
        ) : null}
      </div>
      <iframe
        title={`Vista previa del recibo institucional ${receiptNumber}`}
        srcDoc={preview.data}
        sandbox=""
        className="institutional-receipt-preview-frame w-full border border-[var(--ui-line)] bg-receipt-paper"
      />
    </section>
  );
}
