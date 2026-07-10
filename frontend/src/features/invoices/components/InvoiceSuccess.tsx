import { Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { Button } from '../../../components/ui/button';
import { Dialog } from '../../../components/ui/dialog';
import { SuccessCheckmark } from '../../../components/ui/animations';
import { formatLempirasUIFromCents, parseCents } from '../../../lib/moneyCents';
import type { Payment } from '../../../lib/api';

type InvoiceStatus = 'issued' | 'paid' | 'partial' | 'void';

type InvoiceSuccessProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNumber: string;
  patientName: string;
  total: string;
  status: InvoiceStatus;
  canCollectPayment?: boolean;
  canPrintReceipt?: boolean;
  canSavePdf?: boolean;
  receiptRecoveryMessage?: string;
  paymentMethod?: Payment['method'];
  paymentDate?: string;
  onCobrar: () => void;
  onImprimir: () => void;
  onGuardarPdf?: () => void;
  onNuevaFactura: () => void;
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  issued: 'Emitida',
  paid: 'Pagada',
  partial: 'Parcial',
  void: 'Anulada',
};

const PAYMENT_METHOD_LABELS: Record<Payment['method'], string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  other: 'Otro',
};

export function InvoiceSuccess({
  open,
  onOpenChange,
  invoiceNumber,
  patientName,
  total,
  status,
  canCollectPayment = true,
  canPrintReceipt = true,
  canSavePdf = false,
  receiptRecoveryMessage,
  paymentMethod,
  paymentDate,
  onCobrar,
  onImprimir,
  onGuardarPdf,
  onNuevaFactura,
}: InvoiceSuccessProps) {
  const needsPayment = status === 'issued' || status === 'partial';
  const canShowPaymentAction = needsPayment && canCollectPayment;
  const successTitle = status === 'paid' ? 'Factura pagada' : needsPayment ? 'Factura pendiente' : 'Factura creada';
  const detailHref = `/invoices?invoice_number=${encodeURIComponent(invoiceNumber)}`;
  const hasReceiptRecovery = Boolean(receiptRecoveryMessage?.trim());
  const successDescription =
    status === 'paid'
      ? `Factura ${invoiceNumber} pagada. ${
          canPrintReceipt
            ? 'Recibo listo para imprimir.'
            : receiptRecoveryMessage
              ? 'El recibo requiere atención en Historial.'
              : 'Impresion de recibo restringida por permisos.'
        }`
      : needsPayment
        ? `Factura ${invoiceNumber} creada y pendiente de pago.`
        : `Factura ${invoiceNumber} creada.`;
  const paymentDateLabel = formatPaymentDate(paymentDate);
  const primaryActionRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => primaryActionRef.current?.focus(), 0);
    }
  }, [open, canShowPaymentAction]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={successTitle}
      description={successDescription}
    >
      <div className="flex flex-col gap-4">
        <div className="flex justify-center py-2 animate-[scale-in_0.3s_ease-out_both] motion-reduce:animate-none">
          <SuccessCheckmark size="lg" />
        </div>
        <div className="border-y border-operational-border py-4">
          <p className="text-lg font-semibold text-foreground">{invoiceNumber}</p>
          <p className="mt-1 text-sm text-muted-foreground">Paciente: <strong className="text-foreground">{patientName}</strong></p>
          <p className="text-sm text-muted-foreground">Total: <strong className="font-mono tabular-nums text-foreground">{moneyLabel(total)}</strong></p>
          {paymentMethod ? (
            <p className="text-sm text-muted-foreground">Método: <strong className="text-foreground">{PAYMENT_METHOD_LABELS[paymentMethod]}</strong></p>
          ) : null}
          {paymentDateLabel ? (
            <p className="text-sm text-muted-foreground">Fecha de pago: <strong className="text-foreground">{paymentDateLabel}</strong></p>
          ) : null}
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Estado: {STATUS_LABELS[status]}
          </p>
        </div>

        {needsPayment ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground text-center">
              {canShowPaymentAction
                ? 'La factura ya fue emitida. El siguiente paso operativo es registrar el cobro.'
                : 'La factura ya fue emitida y queda pendiente de cobro para caja.'}
            </p>
            {canShowPaymentAction ? (
              <>
                <Button ref={primaryActionRef} type="button" size="lg" className="w-full font-semibold" onClick={onCobrar}>
                  Cobrar ahora
                </Button>
                <Button type="button" variant="secondary" className="min-h-11 w-full" onClick={onNuevaFactura}>
                  Nueva factura
                </Button>
              </>
            ) : (
              <Button ref={primaryActionRef} type="button" size="lg" className="min-h-11 w-full font-semibold" onClick={onNuevaFactura}>
                Nueva factura
              </Button>
            )}
          </div>
        ) : canPrintReceipt ? (
          <div className="flex flex-col gap-3">
            {receiptRecoveryMessage ? (
              <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground">
                {receiptRecoveryMessage}
              </p>
            ) : null}
            <Button ref={primaryActionRef} type="button" size="lg" className="w-full font-semibold" onClick={onImprimir}>
              Imprimir recibo
            </Button>
            {canSavePdf && onGuardarPdf ? (
              <Button type="button" variant="secondary" className="min-h-11 w-full" onClick={onGuardarPdf}>
                Guardar PDF
              </Button>
            ) : null}
            <Button type="button" variant="secondary" className="min-h-11 w-full" onClick={onNuevaFactura}>
              Nueva factura
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {hasReceiptRecovery ? (
              <>
                <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground">
                  {receiptRecoveryMessage}
                </p>
                <Button asChild size="lg" className="w-full font-semibold">
                  <Link className="min-h-11" to={detailHref}>Resolver recibo en Historial</Link>
                </Button>
                <Button ref={primaryActionRef} type="button" variant="secondary" className="min-h-11 w-full" onClick={onNuevaFactura}>
                  Nueva factura
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground text-center">
                  La factura ya fue pagada. Solicite a caja imprimir el recibo institucional.
                </p>
                <Button ref={primaryActionRef} type="button" size="lg" className="min-h-11 w-full font-semibold" onClick={onNuevaFactura}>
                  Nueva factura
                </Button>
              </>
            )}
          </div>
        )}

        {!hasReceiptRecovery || canPrintReceipt ? (
          <Button asChild variant="ghost" className="min-h-11 w-full">
            <Link to="/invoices">Ir al historial</Link>
          </Button>
        ) : null}
      </div>
    </Dialog>
  );
}

function moneyLabel(value: string | number | null | undefined): string {
  return formatLempirasUIFromCents(parseCents(value));
}

function formatPaymentDate(value?: string): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('es-HN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
