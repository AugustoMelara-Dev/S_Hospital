import { Link } from 'react-router-dom';
import { Printer, ReceiptText } from 'lucide-react';
import { Alert } from '../../../components/ui/alert';
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
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Factura emitida"
      description="Documento fiscal creado exitosamente."
    >
      <div className="flex flex-col gap-4">
        <Alert variant="success" title={invoiceNumber}>
          Paciente <strong>{patientName}</strong>. Total L. {total}. Estado: {STATUS_LABELS[status]}.
        </Alert>

        {status === 'issued' || status === 'partial' ? (
          <Button type="button" size="lg" className="w-full" onClick={onCobrar}>
            Cobrar ahora
          </Button>
        ) : (
          <Button type="button" size="lg" className="w-full" onClick={onImprimir}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir recibo
          </Button>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" onClick={onImprimir}>
            <ReceiptText className="h-4 w-4 mr-2" />
            Ver recibo
          </Button>
          <Button asChild variant="secondary">
            <Link to="/invoices">Ver historial</Link>
          </Button>
        </div>

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => {
            onOpenChange(false);
            onNuevaFactura();
          }}
        >
          Crear otra factura
        </Button>
      </div>
    </Dialog>
  );
}