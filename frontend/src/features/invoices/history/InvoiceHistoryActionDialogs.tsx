import { useEffect, useId, useState, type ReactNode } from 'react';
import type { Invoice, Payment } from '../../../lib/api';
import { AdminDialog } from '@/design-system/admin/components';
import { cn } from '@/lib/utils';
import { PaymentModal } from '../components/PaymentModal';
import { invoicePatientNameLabel } from './invoiceHistoryFormat';
import {
  DANGER_BUTTON,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  TEXTAREA_CLASS,
} from './adminOverlayUi';

/**
 * Confirmaciones admin con motivo opcional u obligatorio.
 *
 * Cada diálogo declara una descripción propia y legible (nada de texto
 * automático genérico): qué va a suceder y qué no toca (sin cobros ni números
 * nuevos cuando aplica). No deciden reglas de negocio.
 */
type InvoiceHistoryActionDialogsProps = {
  invoice: Invoice | null;
  // Reimpresión explícita (menú/panel de detalle)
  confirmingReprint: boolean;
  reprintingReceipt: boolean;
  onCancelReprint: () => void;
  onConfirmReprint: (reason?: string) => void;
  /** Aviso de paginas/ejemplares antes de confirmar la reimpresion. */
  reprintPrintInfo?: ReactNode;
  // Impresión auditada del comprobante histórico (vista previa legacy)
  confirmingReceiptPrint: boolean;
  onCancelReceiptPrint: () => void;
  onConfirmReceiptPrint: (reason?: string) => void;
  // Anulación
  confirmingVoid: boolean;
  voidingInvoice: boolean;
  voidReason: string;
  voidReasonError: string;
  onVoidReasonChange: (value: string) => void;
  onCancelVoid: () => void;
  onConfirmVoid: (invoice?: Invoice | null, reason?: string) => void;
  // Reversa
  confirmingReverse: boolean;
  reversingInvoice: boolean;
  reverseReason: string;
  reverseReasonError: string;
  onReverseReasonChange: (value: string) => void;
  onCancelReverse: () => void;
  onConfirmReverse: (invoice?: Invoice | null, reason?: string) => void;
  // Cobro de saldo en historial
  confirmingPayment?: boolean;
  collectingPayment?: boolean;
  collectionAmount?: string;
  collectionMethod?: Payment['method'];
  collectionReference?: string;
  collectionError?: string | null;
  onPaymentMethodChange?: (method: Payment['method']) => void;
  onPaymentAmountChange?: (amount: string) => void;
  onPaymentReferenceChange?: (reference: string) => void;
  onCancelPayment?: () => void;
  onConfirmPayment?: (amount: string) => void;
};

type HistoryAdminDialogProps = {
  open: boolean;
  title: string;
  /** Contexto legible del diálogo: qué sucede y qué no toca, para lector y vista. */
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: (reason?: string) => void;
  children: ReactNode;
  confirmDisabled?: boolean;
  cancelDisabled?: boolean;
  danger?: boolean;
  requireReasonTextarea?: boolean;
  requireReasonMinLength?: number;
  requireReasonMaxLength?: number;
  reasonLabel?: string;
  reasonHelpText?: string;
};

/**
 * Confirmación admin con motivo opcional u obligatorio.
 *
 * Conserva el foco del disparador al cerrar y valida el rango humano antes de
 * habilitar la confirmación. No decide la regla de negocio: solo habilita la
 * confirmación y entrega el motivo escrito. Misma semántica de diálogo
 * (`role="dialog"`, título y descripción asociados) que el patrón compartido,
 * con superficie admin dentro del portal.
 */
function HistoryAdminDialog({
  cancelDisabled,
  cancelLabel = 'Cancelar',
  children,
  confirmDisabled,
  confirmLabel,
  danger,
  description,
  onCancel,
  onConfirm,
  open,
  reasonHelpText,
  reasonLabel = 'Motivo *',
  requireReasonMaxLength,
  requireReasonMinLength = 0,
  requireReasonTextarea,
  title,
}: HistoryAdminDialogProps) {
  const [reason, setReason] = useState('');
  const idPrefix = useId().replaceAll(':', '');
  const reasonInputId = `${idPrefix}-reason`;
  const reasonHelpId = `${idPrefix}-reason-help`;

  useEffect(() => {
    if (open) {
      setReason('');
    }
  }, [open]);

  const reasonLength = reason.trim().length;
  const reasonTooShort = Boolean(requireReasonTextarea) && reasonLength < requireReasonMinLength;
  const reasonTooLong =
    Boolean(requireReasonTextarea) && requireReasonMaxLength !== undefined && reasonLength > requireReasonMaxLength;
  const reasonPlaceholder =
    requireReasonMinLength > 0
      ? `Explique el motivo (mínimo ${requireReasonMinLength} caracteres)...`
      : 'Explique el motivo...';

  const footer = (
    <>
      <button type="button" className={SECONDARY_BUTTON} disabled={cancelDisabled} onClick={onCancel}>
        {cancelLabel}
      </button>
      <button
        type="button"
        className={danger ? DANGER_BUTTON : PRIMARY_BUTTON}
        disabled={confirmDisabled || reasonTooShort || reasonTooLong}
        onClick={() => onConfirm(reason)}
      >
        {confirmLabel}
      </button>
    </>
  );

  return (
    <AdminDialog
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen && !cancelDisabled) onCancel(); }}
      title={title}
      description={description}
      footer={footer}
      closeDisabled={Boolean(cancelDisabled)}
    >
      <div className="flex flex-col gap-4">
          {children}
          {requireReasonTextarea ? (
            <div className="flex flex-col gap-2">
              <label
                htmlFor={reasonInputId}
                className="text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]"
              >
                {reasonLabel}
              </label>
              <textarea
                id={reasonInputId}
                className={TEXTAREA_CLASS}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={reasonPlaceholder}
                rows={3}
                aria-invalid={reasonTooLong ? true : undefined}
                aria-describedby={reasonHelpText ? reasonHelpId : undefined}
              />
              {reasonHelpText ? (
                <p id={reasonHelpId} className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
                  {reasonHelpText}
                </p>
              ) : null}
              {requireReasonMaxLength !== undefined ? (
                <p
                  aria-live="polite"
                  className={cn(
                    'text-[length:var(--ui-text-xs)]',
                    reasonTooLong
                      ? 'font-medium text-[color:var(--ui-danger)]'
                      : 'text-[color:var(--ui-ink-soft)]',
                  )}
                >
                  {reasonLength}/{requireReasonMaxLength} caracteres.
                </p>
              ) : null}
              {reasonTooLong ? (
                <p role="alert" className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-danger)]">
                  El motivo no puede superar {requireReasonMaxLength} caracteres.
                </p>
              ) : null}
            </div>
          ) : null}
      </div>
    </AdminDialog>
  );
}

export function InvoiceHistoryActionDialogs({
  invoice,
  confirmingReprint,
  reprintingReceipt,
  onCancelReprint,
  onConfirmReprint,
  reprintPrintInfo,
  confirmingReceiptPrint,
  onCancelReceiptPrint,
  onConfirmReceiptPrint,
  confirmingVoid,
  voidingInvoice,
  voidReason,
  voidReasonError,
  onVoidReasonChange,
  onCancelVoid,
  onConfirmVoid,
  confirmingReverse,
  reversingInvoice,
  reverseReason,
  reverseReasonError,
  onReverseReasonChange,
  onCancelReverse,
  onConfirmReverse,
  confirmingPayment,
  collectingPayment,
  collectionAmount,
  collectionMethod,
  collectionReference,
  collectionError,
  onPaymentMethodChange,
  onPaymentAmountChange,
  onPaymentReferenceChange,
  onCancelPayment,
  onConfirmPayment,
}: InvoiceHistoryActionDialogsProps) {
  return (
    <>
      <HistoryAdminDialog
        confirmLabel={reprintingReceipt ? 'Reimprimiendo...' : 'Reimprimir'}
        description="Se entregará otra copia del comprobante ya emitido. No genera cobros ni números nuevos; el motivo escrito queda registrado."
        onCancel={onCancelReprint}
        cancelDisabled={reprintingReceipt}
        confirmDisabled={reprintingReceipt}
        onConfirm={onConfirmReprint}
        open={confirmingReprint}
        requireReasonTextarea
        requireReasonMinLength={5}
        requireReasonMaxLength={500}
        reasonHelpText="Explique por qué se entrega otra copia. Quedará registrado."
        title={`Reimprimir ${invoice?.invoice_number ?? ''}`}
      >
        <p className="text-[length:var(--ui-text-sm)]">
          <strong className="font-semibold">Paciente:</strong> {invoicePatientNameLabel(invoice)}
        </p>
        {reprintPrintInfo ? (
          <p
            className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]"
            data-reprint-print-info
          >
            {reprintPrintInfo}
          </p>
        ) : null}
        <p className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
          El motivo quedará asociado a esta reimpresión.
        </p>
      </HistoryAdminDialog>

      <HistoryAdminDialog
        confirmLabel={reprintingReceipt ? 'Reimprimiendo...' : 'Reimprimir'}
        description="Se entregará otra copia del comprobante histórico con la leyenda REIMPRESIÓN. No genera cobros ni números nuevos."
        onCancel={onCancelReceiptPrint}
        cancelDisabled={reprintingReceipt}
        confirmDisabled={reprintingReceipt}
        onConfirm={onConfirmReceiptPrint}
        open={confirmingReceiptPrint}
        requireReasonTextarea
        requireReasonMinLength={5}
        requireReasonMaxLength={500}
        reasonHelpText="Explique por qué se entrega otra copia. Quedará registrado."
        title={`Reimprimir ${invoice?.invoice_number ?? ''}`}
      >
        <p className="text-[length:var(--ui-text-sm)]">
          <strong className="font-semibold">Paciente:</strong> {invoicePatientNameLabel(invoice)}
        </p>
        {reprintPrintInfo ? (
          <p
            className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]"
            data-reprint-print-info
          >
            {reprintPrintInfo}
          </p>
        ) : null}
        <p className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
          La copia se identificará como REIMPRESIÓN y conservará el motivo indicado.
        </p>
      </HistoryAdminDialog>

      <HistoryAdminDialog
        confirmLabel={voidingInvoice ? 'Anulando...' : 'Anular Factura'}
        danger
        onCancel={onCancelVoid}
        cancelDisabled={voidingInvoice}
        confirmDisabled={voidingInvoice || voidReason.trim().length < 5}
        onConfirm={() => onConfirmVoid(invoice, voidReason)}
        open={confirmingVoid}
        description="Anulación auditable con permiso y motivo. La factura no se elimina: quedará marcada como anulada."
        title={`¿Anular factura ${invoice?.invoice_number}?`}
      >
        <p className="text-[length:var(--ui-text-sm)]">
          <strong className="font-semibold">Paciente:</strong> {invoicePatientNameLabel(invoice)}
        </p>
        <div className="flex flex-col gap-2">
          <label
            htmlFor="voidReason"
            className="text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]"
          >
            Motivo de anulación *
          </label>
          <textarea
            id="voidReason"
            className={TEXTAREA_CLASS}
            aria-describedby={voidReasonError ? 'voidReason-help voidReason-error' : 'voidReason-help'}
            aria-invalid={Boolean(voidReasonError)}
            aria-label="Motivo de anulación"
            value={voidReason}
            disabled={voidingInvoice}
            onChange={(event) => {
              onVoidReasonChange(event.target.value);
            }}
            placeholder="Explique el motivo de la anulación (mínimo 5 caracteres)..."
            rows={3}
          />
          <p id="voidReason-help" className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
            Esta acción no se puede deshacer. La factura será marcada como anulada.
          </p>
          {voidReasonError ? (
            <p
              id="voidReason-error"
              role="alert"
              className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-danger)]"
            >
              {voidReasonError}
            </p>
          ) : null}
        </div>
      </HistoryAdminDialog>

      <HistoryAdminDialog
        confirmLabel={reversingInvoice ? 'Revirtiendo...' : 'Revertir factura'}
        danger
        onCancel={onCancelReverse}
        cancelDisabled={reversingInvoice}
        confirmDisabled={reversingInvoice || reverseReason.trim().length < 5}
        onConfirm={() => onConfirmReverse(invoice, reverseReason)}
        open={confirmingReverse}
        description="La reversión cancela los pagos registrados de la factura y queda en auditoría con el motivo escrito."
        title={`¿Revertir factura ${invoice?.invoice_number}?`}
      >
        <p className="text-[length:var(--ui-text-sm)]">
          <strong className="font-semibold">Paciente:</strong> {invoicePatientNameLabel(invoice)}
        </p>
        <div className="flex flex-col gap-2">
          <label
            htmlFor="reverseReason"
            className="text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]"
          >
            Motivo de reversión *
          </label>
          <textarea
            id="reverseReason"
            className={TEXTAREA_CLASS}
            aria-describedby={reverseReasonError ? 'reverseReason-help reverseReason-error' : 'reverseReason-help'}
            aria-invalid={Boolean(reverseReasonError)}
            aria-label="Motivo de reversión"
            value={reverseReason}
            disabled={reversingInvoice}
            onChange={(event) => {
              onReverseReasonChange(event.target.value);
            }}
            placeholder="Explique por qué se revierten los pagos y la factura..."
            rows={3}
          />
          <p id="reverseReason-help" className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
            Se cancelarán los pagos registrados y quedará constancia del motivo. Escriba al menos 5 caracteres.
          </p>
          {reverseReasonError ? (
            <p
              id="reverseReason-error"
              role="alert"
              className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-danger)]"
            >
              {reverseReasonError}
            </p>
          ) : null}
        </div>
      </HistoryAdminDialog>

      {confirmingPayment && invoice ? (
        <PaymentModal
          open={confirmingPayment}
          onOpenChange={(open) => {
            if (!open && !collectingPayment) onCancelPayment?.();
          }}
          invoiceNumber={invoice.invoice_number}
          patientName={invoice.patient_name}
          total={invoice.total}
          balanceDue={invoice.balance_due}
          paymentMethod={collectionMethod ?? 'cash'}
          paymentAmount={collectionAmount ?? invoice.balance_due}
          paymentReference={collectionReference ?? ''}
          onPaymentMethodChange={(method) => onPaymentMethodChange?.(method)}
          onPaymentAmountChange={(amount) => onPaymentAmountChange?.(amount)}
          onPaymentReferenceChange={(ref) => onPaymentReferenceChange?.(ref)}
          onConfirm={(amount) => onConfirmPayment?.(amount)}
          submitting={collectingPayment}
          errorMessage={collectionError}
        />
      ) : null}
    </>
  );
}
