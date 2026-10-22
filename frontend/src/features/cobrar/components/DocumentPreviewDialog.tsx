import { AdminCallout, AdminChip, AdminDialog, AdminSpinner } from '@/design-system/admin/components';
import type { InvoiceReceiptPreview } from '@/lib/api/billing';
import { SECONDARY_BUTTON } from './cobrarUi';

type DocumentPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: InvoiceReceiptPreview | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  document,
  loading,
  error,
  onRetry,
}: DocumentPreviewDialogProps) {
  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Vista previa del comprobante"
      description="Revise el comprobante antes de cobrar. Este borrador todavía no registra una factura ni un pago."
      className="sm:max-w-5xl"
      footer={
        <button type="button" className={SECONDARY_BUTTON} onClick={() => onOpenChange(false)}>
          Cerrar
        </button>
      }
    >
      {loading ? (
        <div role="status" className="flex min-h-64 items-center justify-center gap-2 text-[color:var(--ui-ink-soft)]">
          <AdminSpinner />
          <span>Preparando documento…</span>
        </div>
      ) : error ? (
        <AdminCallout tone="error" title="No se pudo preparar la vista previa">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button type="button" className={SECONDARY_BUTTON} onClick={onRetry}>
              Reintentar
            </button>
          </div>
        </AdminCallout>
      ) : document ? (
        <div className="flex min-w-0 flex-col gap-2">
          <div role="status" className="flex flex-wrap items-center gap-2 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
            <AdminChip tone="accent">{document.watermark}</AdminChip>
            <span className="tabular-nums">
              {document.document.page_count} {document.document.page_count === 1 ? 'página' : 'páginas'}
            </span>
          </div>
          <iframe
            title="Vista previa del comprobante antes de emitir"
            srcDoc={document.html}
            sandbox=""
            className="h-[62vh] min-h-96 w-full rounded-[var(--ui-radius)] border border-[var(--ui-line)] bg-white"
          />
        </div>
      ) : null}
    </AdminDialog>
  );
}
