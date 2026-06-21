import { Link } from 'react-router-dom';
import { Printer } from 'lucide-react';
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
  onCobrar,
  onImprimir,
  onNuevaFactura,
}: InvoiceSuccessProps) {
  const needsPayment = status === 'issued' || status === 'partial';
  const primaryActionRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => primaryActionRef.current?.focus(), 0);
    }
  }, [open, needsPayment]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Factura emitida exitosamente"
      description={`Factura ${invoiceNumber} creada. ${needsPayment ? 'Pendiente de pago.' : 'Pagada.'}`}
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
              La factura ya fue emitida. El siguiente paso operativo es registrar el cobro.
            </p>
            <Button ref={primaryActionRef} type="button" size="lg" className="w-full font-semibold" onClick={onCobrar}>
              Cobrar ahora
            </Button>
            <Button type="button" variant="secondary" className="w-full" onClick={onNuevaFactura}>
              Dejar pendiente y crear otra
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Button ref={primaryActionRef} type="button" size="lg" className="w-full font-semibold" onClick={onImprimir}>
              Imprimir recibo institucional
            </Button>
            <Button type="button" variant="secondary" className="w-full" onClick={onNuevaFactura}>
              Crear otra factura
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="flex flex-col gap-2">
            <Button type="button" variant="outline" onClick={onImprimir} disabled={needsPayment}>
              <Printer className="h-4 w-4 mr-2" />
              Ver recibo
            </Button>
            {needsPayment && (
              <p className="text-xs text-muted-foreground">
                Disponible despues de cobrar.
              </p>
            )}
          </div>
          <Button asChild variant="outline">
            <Link to={`/invoices?invoice_number=${encodeURIComponent(invoiceNumber)}`}>Ver factura</Link>
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function moneyLabel(value: string | number | null | undefined): string {
  return formatLempirasUIFromCents(parseCents(value));
}
