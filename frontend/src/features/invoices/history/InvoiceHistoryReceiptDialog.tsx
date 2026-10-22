import type { ReactNode } from 'react';
import type { Invoice, ReceiptData } from '../../../lib/api';
import { AdminDialog } from '@/design-system/admin/components';
import { InstitutionalReceiptPreviewFrame } from '../../receipts/InstitutionalReceiptPreviewFrame';
import { ReceiptPreview } from '../../receipts/ReceiptPreview';
import { hasInstitutionalPrintEvents } from './invoiceHistoryReceiptRules';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from './adminOverlayUi';

type InvoiceHistoryReceiptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  institutionalReceipt: NonNullable<Invoice['institutional_receipt']> | null;
  receipt: ReceiptData | null;
  loadingActionInvoiceId: number | null;
  onDownload: (invoice: Invoice) => void;
  onPrintInstitutional: () => void;
  onPrintLegacy: () => void | Promise<void>;
  /** Aviso de paginas/ejemplares antes de imprimir (identidad Recibos). */
  printInfo?: ReactNode;
};

/**
 * Vista previa del comprobante desde historial: recibo institucional exacto o
 * comprobante histórico no institucional. La impresión legacy se delega al
 * flujo auditado del historial (motivo humano / documento ya auditado).
 */
export function InvoiceHistoryReceiptDialog({
  open,
  onOpenChange,
  invoice,
  institutionalReceipt,
  receipt,
  loadingActionInvoiceId,
  onDownload,
  onPrintInstitutional,
  onPrintLegacy,
  printInfo,
}: InvoiceHistoryReceiptDialogProps) {
  const busy = loadingActionInvoiceId === invoice?.id;
  const title = invoice?.invoice_number
    ? `Comprobante ${invoice.invoice_number}`
    : 'Comprobante de la operación';
  const description = institutionalReceipt
    ? 'Revise el recibo emitido y elija si desea guardarlo o imprimirlo.'
    : 'Revise la copia histórica conservada para esta operación.';
  const footer = institutionalReceipt ? (
    <>
      <button type="button" className={SECONDARY_BUTTON} onClick={() => onOpenChange(false)}>
        Cerrar
      </button>
      <button
        type="button"
        className={SECONDARY_BUTTON}
        disabled={busy}
        onClick={() => invoice && onDownload(invoice)}
      >
        Guardar PDF
      </button>
      <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={onPrintInstitutional}>
        {hasInstitutionalPrintEvents(institutionalReceipt) ? 'Registrar reimpresión' : 'Abrir para imprimir'}
      </button>
    </>
  ) : undefined;

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={footer}
      closeDisabled={busy}
      className="sm:max-w-4xl"
    >
      <div className="grid gap-4">
        {printInfo ? (
          <p
            className="border-b border-[var(--ui-line)] pb-3 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]"
            data-receipt-print-info
          >
            {printInfo}
          </p>
        ) : null}
        {institutionalReceipt ? (
          <InstitutionalReceiptPreviewFrame
            receiptId={institutionalReceipt.id}
            receiptNumber={institutionalReceipt.receipt_number_full}
          />
        ) : receipt && invoice ? (
          <ReceiptPreview receipt={receipt} onPrint={onPrintLegacy} />
        ) : (
          /*
           * Sin documento todavía: el diálogo declara **su** estado en vez de
           * anunciar «recibo disponible» antes de tenerlo. Cargando y ausente son
           * estados distintos y ambos son visibles para el cajero.
           */
          <p
            role="status"
            className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]"
          >
            {busy
              ? 'Preparando el comprobante…'
              : 'Todavía no hay comprobante generado para esta factura.'}
          </p>
        )}
      </div>
    </AdminDialog>
  );
}
