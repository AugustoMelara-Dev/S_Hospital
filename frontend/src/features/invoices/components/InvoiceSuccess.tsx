import { Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { Button } from '../../../components/ui/button';
import { Dialog } from '../../../components/ui/dialog';
import { SuccessCheckmark } from '../../../components/ui/animations';
import { formatLempirasUIFromCents, parseCents } from '../../../lib/moneyCents';

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
  onCobrar: () => void;
  onImprimir: () => void;
  onNuevaFactura: () => void;
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  issued: 'Emitida',
  paid: 'Pagada',
  partial: 'Parcial',
  void: 'Anulada',
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
  onCobrar,
  onImprimir,
  onNuevaFactura,
}: InvoiceSuccessProps) {
  const needsPayment = status === 'issued' || status === 'partial';
  const canShowPaymentAction = needsPayment && canCollectPayment;
  const successTitle = status === 'paid' ? 'Factura pagada' : 'Factura emitida exitosamente';
  const successDescription =
    status === 'paid'
      ? `Factura ${invoiceNumber} pagada. Recibo listo para imprimir.`
      : `Factura ${invoiceNumber} creada. ${needsPayment ? 'Pendiente de pago.' : 'Pagada.'}`;
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
        <div className="flex justify-center py-2 animate-[scale-in_0.3s_ease-out_both]">
          <SuccessCheckmark size="lg" />
        </div>
        <div className="rounded-lg border border-success/30 bg-success/10 p-4">
          <p className="text-lg font-semibold text-success-foreground">{invoiceNumber}</p>
          <p className="mt-1 text-sm text-success-foreground/90">Paciente: <strong>{patientName}</strong></p>
          <p className="text-sm text-success-foreground/90">Total: <strong>{moneyLabel(total)}</strong></p>
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-success-foreground/80">
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
                <Button type="button" variant="secondary" className="w-full" onClick={onNuevaFactura}>
                  Dejar pendiente y crear otra
                </Button>
              </>
            ) : (
              <Button ref={primaryActionRef} type="button" size="lg" className="w-full font-semibold" onClick={onNuevaFactura}>
                Crear otra factura
              </Button>
            )}
          </div>
        ) : canPrintReceipt ? (
          <div className="flex flex-col gap-3">
            <Button ref={primaryActionRef} type="button" size="lg" className="w-full font-semibold" onClick={onImprimir}>
              Imprimir recibo institucional
            </Button>
            <Button type="button" variant="secondary" className="w-full" onClick={onNuevaFactura}>
              Crear otra factura
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground text-center">
              La factura ya fue emitida. Solicite a caja imprimir el recibo institucional.
            </p>
            <Button ref={primaryActionRef} type="button" size="lg" className="w-full font-semibold" onClick={onNuevaFactura}>
              Crear otra factura
            </Button>
          </div>
        )}

        <Button asChild variant="ghost" className="w-full">
          <Link to={`/invoices?invoice_number=${encodeURIComponent(invoiceNumber)}`}>Ver detalle</Link>
        </Button>
      </div>
    </Dialog>
  );
}

function moneyLabel(value: string | number | null | undefined): string {
  return formatLempirasUIFromCents(parseCents(value));
}
