import { Link } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Dialog } from '../../../components/ui/dialog';

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

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Factura emitida exitosamente"
      description={`Factura ${invoiceNumber} creada. ${needsPayment ? 'Pendiente de pago.' : 'Pagada.'}`}
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="font-semibold text-emerald-900 text-lg">{invoiceNumber}</p>
          <p className="text-sm text-emerald-700 mt-1">Paciente: <strong>{patientName}</strong></p>
          <p className="text-sm text-emerald-700">Total: <strong>L. {total}</strong></p>
          <p className="text-xs text-emerald-600 mt-2 uppercase font-medium tracking-wide">
            Estado: {STATUS_LABELS[status]}
          </p>
        </div>

        {needsPayment ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground text-center">
              Que desea hacer a continuacion?
            </p>
            <Button type="button" size="lg" className="w-full font-semibold" onClick={onCobrar}>
              Cobrar ahora
            </Button>
            <Button type="button" variant="secondary" className="w-full" onClick={onNuevaFactura}>
              Crear otra factura
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Button type="button" size="lg" className="w-full font-semibold" onClick={onImprimir}>
              Imprimir recibo termico
            </Button>
            <Button type="button" variant="secondary" className="w-full" onClick={onNuevaFactura}>
              Crear otra factura
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onImprimir}>
            <Printer className="h-4 w-4 mr-2" />
            Ver recibo
          </Button>
          <Button asChild variant="outline">
            <Link to="/invoices">Ver facturas</Link>
          </Button>
        </div>
      </div>
    </Dialog>
  );
}