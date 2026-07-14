import { DownloadOutlined, PrinterOutlined, WarningOutlined } from '@ant-design/icons';
import { useEffect, useRef } from 'react';
import { Button, Input, Modal } from 'antd';
import { finiteNumber, formatLempirasUI } from '@/lib/money';
import { cn } from '@/lib/utils';
import { formatDateTimeEs } from '@/lib/format/formatDate';
import { downloadCloseSummaryCsv } from '../cashCloseSummary';

interface CloseSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: {
    id?: number;
    opening_amount: string;
    expected_cash_amount?: string | null;
    expected_amount?: string | null;
    payments_by_method?: { cash: string; transfer: string; card: string; other: string };
    pending_invoice_count?: number;
    pending_amount?: string | null;
    missing_institutional_receipt_count?: number;
    closed_at?: string | null;
  };
  closingAmount: string;
  closingNotes: string;
  difference: number;
  isSubmitting: boolean;
  onClosingNotesChange: (value: string) => void;
  onConfirm: () => void;
}

const MIN_DIFFERENCE_NOTE_LENGTH = 5;

type CashCloseSummarySession = CloseSessionDialogProps['session'];

interface CashCloseSummaryPanelProps {
  session: CashCloseSummarySession;
  closingAmount: string;
  closingNotes: string;
  difference: number;
}

export function CashCloseSummaryPanel({
  session,
  closingAmount,
  closingNotes,
  difference,
}: CashCloseSummaryPanelProps) {
  const openingAmount = finiteNumber(session.opening_amount);
  const expectedAmount = finiteNumber(session.expected_cash_amount ?? session.expected_amount ?? session.opening_amount);
  const pendingAmount = finiteNumber(session.pending_amount);
  const pendingInvoiceCount = session.pending_invoice_count ?? 0;
  const closedAtLabel = session.closed_at ? formatDateTimeEs(session.closed_at) : null;
  const methods = session.payments_by_method ?? {
    cash: '0.00',
    transfer: '0.00',
    card: '0.00',
    other: '0.00',
  };

  function exportCloseSummary() {
    downloadCloseSummaryCsv({
      cashSessionId: session.id,
      closedAt: session.closed_at,
      openingAmount,
      expectedAmount,
      methods,
      pendingAmount,
      pendingInvoiceCount,
      closingAmount,
      difference,
      closingNotes,
    });
  }

  function printCloseSummary() {
    const previousPrinting = document.body.dataset.printingCashClose;
    document.body.dataset.printingCashClose = 'true';

    try {
      window.print();
    } finally {
      if (previousPrinting) {
        document.body.dataset.printingCashClose = previousPrinting;
      } else {
        delete document.body.dataset.printingCashClose;
      }
    }
  }

  return (
    <section
      aria-labelledby="cash-close-confirmed-summary-title"
      className="border border-success/35 bg-success/10 p-5 text-sm "
      data-cash-close-print-root
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="cash-close-confirmed-summary-title" className="text-base font-semibold text-foreground">
            Resumen de cierre confirmado
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Conserve este resumen para impresion o archivo del turno cerrado.
          </p>
        </div>
        <div className="print-hidden flex flex-wrap gap-2">
          <Button onClick={printCloseSummary}>
            <PrinterOutlined aria-hidden="true" />
            Imprimir resumen
          </Button>
          <Button onClick={exportCloseSummary}>
            <DownloadOutlined aria-hidden="true" />
            Exportar resumen
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 border border-border bg-card/80 p-4 sm:grid-cols-2">
        {session.id ? (
          <div className="flex justify-between gap-3">
            <span>Caja:</span>
            <strong>Caja #{session.id}</strong>
          </div>
        ) : null}
        {closedAtLabel ? (
          <div className="flex justify-between gap-3">
            <span>Cerrada:</span>
            <strong>{closedAtLabel}</strong>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <span>Monto apertura:</span>
          <strong>{formatLempirasUI(openingAmount)}</strong>
        </div>
        <div className="flex justify-between gap-3">
          <span>Efectivo esperado:</span>
          <strong>{formatLempirasUI(expectedAmount)}</strong>
        </div>
        <div className="flex justify-between gap-3">
          <span>Monto contado:</span>
          <strong>{formatLempirasUI(closingAmount || '0.00')}</strong>
        </div>
        <div className="flex justify-between gap-3">
          <span>Diferencia:</span>
          <strong className={cn(difference !== 0 ? 'text-destructive' : 'text-success-foreground')}>
            {formatLempirasUI(difference)}
          </strong>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-4">
        <div className="flex justify-between gap-2 border border-border bg-card/70 px-2 py-1">
          <span>Efectivo</span>
          <strong>{formatLempirasUI(methods.cash)}</strong>
        </div>
        <div className="flex justify-between gap-2 border border-border bg-card/70 px-2 py-1">
          <span>Transferencia</span>
          <strong>{formatLempirasUI(methods.transfer)}</strong>
        </div>
        <div className="flex justify-between gap-2 border border-border bg-card/70 px-2 py-1">
          <span>Tarjeta</span>
          <strong>{formatLempirasUI(methods.card)}</strong>
        </div>
        <div className="flex justify-between gap-2 border border-border bg-card/70 px-2 py-1">
          <span>Otros</span>
          <strong>{formatLempirasUI(methods.other)}</strong>
        </div>
      </div>

      <div className="mt-3 text-sm text-muted-foreground">
        Nota: <span className="text-foreground">{closingNotes.trim() || 'Sin nota'}</span>
      </div>
    </section>
  );
}

export function CloseSessionDialog({
  open,
  onOpenChange,
  session,
  closingAmount,
  closingNotes,
  difference,
  isSubmitting,
  onClosingNotesChange,
  onConfirm,
}: CloseSessionDialogProps) {
  const closingNotesRef = useRef<HTMLTextAreaElement | null>(null);
  const openingAmount = finiteNumber(session.opening_amount);
  const expectedAmount = finiteNumber(session.expected_cash_amount ?? session.expected_amount ?? session.opening_amount);
  const pendingAmount = finiteNumber(session.pending_amount);
  const pendingInvoiceCount = session.pending_invoice_count ?? 0;
  const missingInstitutionalReceiptCount = session.missing_institutional_receipt_count ?? 0;
  const hasPendingBalance = pendingInvoiceCount > 0 || pendingAmount > 0;
  const isDifference = difference !== 0;
  const trimmedClosingNotes = closingNotes.trim();
  const hasValidDifferenceNote = !isDifference || trimmedClosingNotes.length >= MIN_DIFFERENCE_NOTE_LENGTH;
  const methods = session.payments_by_method ?? {
    cash: '0.00',
    transfer: '0.00',
    card: '0.00',
    other: '0.00',
  };

  useEffect(() => {
    if (open && isDifference) {
      window.setTimeout(() => closingNotesRef.current?.focus(), 0);
    }
  }, [isDifference, open]);

  function exportCloseSummary() {
    downloadCloseSummaryCsv({
      cashSessionId: session.id,
      closedAt: session.closed_at,
      openingAmount,
      expectedAmount,
      methods,
      pendingAmount,
      pendingInvoiceCount,
      closingAmount,
      difference,
      closingNotes,
    });
  }

  function printCloseSummary() {
    const previousPrinting = document.body.dataset.printingCashClose;
    document.body.dataset.printingCashClose = 'true';

    try {
      window.print();
    } finally {
      if (previousPrinting) {
        document.body.dataset.printingCashClose = previousPrinting;
      } else {
        delete document.body.dataset.printingCashClose;
      }
    }
  }

  return (
    <Modal open={open} onCancel={() => onOpenChange(false)} footer={null} width={720} destroyOnHidden title="Cierre de caja">
      <div data-cash-close-print-root="">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">¿Cerrar caja?</h2>
          <div className="text-sm text-muted-foreground">
            <div className="mt-3 grid gap-3">
              <h3 className="text-xs font-semibold text-foreground">
                1. Resumen del turno
              </h3>
              <div className="border border-border bg-muted/40 p-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span>Monto apertura:</span>
                  <strong>{formatLempirasUI(openingAmount)}</strong>
                </div>
                <div className="mt-2 flex justify-between gap-4">
                  <span>Efectivo esperado:</span>
                  <strong>{formatLempirasUI(expectedAmount)}</strong>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 border border-border p-4 text-xs sm:grid-cols-2">
                <div className="flex justify-between gap-2">
                  <span>Efectivo</span>
                  <strong>{formatLempirasUI(methods.cash)}</strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Transferencia</span>
                  <strong>{formatLempirasUI(methods.transfer)}</strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Tarjeta</span>
                  <strong>{formatLempirasUI(methods.card)}</strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Otros</span>
                  <strong>{formatLempirasUI(methods.other)}</strong>
                </div>
              </div>
              <div className="flex justify-between gap-4 text-sm">
                <span>Saldo pendiente:</span>
                <strong>{formatLempirasUI(pendingAmount)}</strong>
              </div>
              {pendingInvoiceCount > 0 ? (
                <div className="border border-warning/35 bg-warning/10 p-3 text-xs font-medium text-warning-foreground">
                  Hay {pendingInvoiceCount} factura(s) pendientes o parciales. El servidor no permitira cerrar hasta revisarlas.
                </div>
              ) : pendingAmount > 0 ? (
                <div className="border border-warning/35 bg-warning/10 p-3 text-xs font-medium text-warning-foreground">
                  Hay saldo pendiente en esta caja. Revise Historial antes de cerrar.
                </div>
              ) : null}
              {missingInstitutionalReceiptCount > 0 ? (
                <div className="border border-warning/35 bg-warning/10 p-3 text-xs font-medium text-warning-foreground">
                  Hay {missingInstitutionalReceiptCount} recibo(s) institucional(es) pendiente(s). El servidor no permitira cerrar hasta emitirlos.
                </div>
              ) : null}
              <h3 className="text-xs font-semibold text-foreground">
                2. Conteo de efectivo
              </h3>
              <div className="grid grid-cols-1 gap-3 border border-border p-4 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-4">
                  <span>Contado:</span>
                  <strong>{formatLempirasUI(closingAmount || '0.00')}</strong>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Diferencia:</span>
                  <strong className={cn(isDifference ? 'text-destructive' : 'text-success-foreground')}>
                    {formatLempirasUI(difference)}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {isDifference && (
          <div className="mt-4 space-y-2">
            <label className="text-sm font-semibold" htmlFor="closing_difference_notes">
              Nota sobre la diferencia *
            </label>
            <Input.TextArea
              ref={(control) => { closingNotesRef.current = control?.resizableTextArea?.textArea ?? null; }}
              id="closing_difference_notes"
              value={closingNotes}
              onChange={(e) => onClosingNotesChange(e.target.value)}
              placeholder="Explique la diferencia..."
              rows={2}
              aria-invalid={isDifference && !hasValidDifferenceNote}
              aria-describedby={isDifference && !hasValidDifferenceNote ? 'closing-notes-error' : undefined}
            />
          </div>
        )}

        <section className="mt-5 grid gap-2" aria-labelledby="close-session-confirm-step">
          <h3 id="close-session-confirm-step" className="text-xs font-semibold text-foreground">
            3. Confirmar cierre
          </h3>
          <p className="text-sm text-muted-foreground">
            Confirme solo despues de revisar el resumen, el conteo fisico y la diferencia calculada.
          </p>
        </section>

        <div className="print-hidden mt-6 flex flex-wrap justify-end gap-2">
          <Button onClick={printCloseSummary} disabled={isSubmitting}>
            <PrinterOutlined aria-hidden="true" />
            Imprimir resumen
          </Button>
          <Button onClick={exportCloseSummary} disabled={isSubmitting}>
            <DownloadOutlined aria-hidden="true" />
            Exportar resumen
          </Button>
          <Button onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="primary" onClick={onConfirm} disabled={isSubmitting || hasPendingBalance || missingInstitutionalReceiptCount > 0 || !hasValidDifferenceNote}>
            {isSubmitting ? 'Cerrando...' : 'Cerrar caja'}
          </Button>
        </div>

        {isDifference && !hasValidDifferenceNote && (
          <div id="closing-notes-error" role="alert" className="mt-2 flex items-center gap-2 text-sm text-destructive">
            <WarningOutlined />
            <span>La nota es obligatoria y debe tener al menos 5 caracteres cuando hay diferencia.</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
