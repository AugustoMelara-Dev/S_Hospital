import { useEffect, useRef } from 'react';
import { Button } from '../../../components/ui/button';
import { Dialog } from '../../../components/ui/dialog';

type CartItem = {
  service: import('../../../lib/api').Service;
  quantity: string;
  dialysisPrescription: boolean;
};

type InvoiceConfirmationProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName: string;
  items: CartItem[];
  preview: { subtotal: string; tax: string; total: string };
  cashSessionId?: number;
  onConfirm: () => void;
  submitting?: boolean;
};

export function InvoiceConfirmation({
  open,
  onOpenChange,
  patientName,
  items,
  preview,
  cashSessionId,
  onConfirm,
  submitting,
}: InvoiceConfirmationProps) {
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const willOpenPayment = Boolean(cashSessionId) && Number(preview.total) > 0;

  useEffect(() => {
    if (open) {
      window.setTimeout(() => confirmButtonRef.current?.focus(), 0);
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={willOpenPayment ? 'Confirmar emisión y cobro' : 'Confirmar factura'}
      description={
        willOpenPayment
          ? 'Se emitirá la factura y el sistema abrirá el cobro inmediatamente.'
          : 'Revise los detalles antes de emitir la factura.'
      }
    >
      <div className="flex flex-col gap-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Paciente:</span>
            <span className="font-medium">{patientName || 'Sin nombre'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Caja:</span>
            <span className="font-medium">#{cashSessionId ?? 'Sin caja'}</span>
          </div>
        </div>

        <div className="rounded-md border border-border p-3">
          <p className="font-semibold text-sm mb-2">Servicios:</p>
          <ul className="space-y-1.5 text-sm max-h-[200px] overflow-y-auto">
            {items.map((item, index) => (
              <li key={`${item.service.id}-${index}`} className="flex justify-between">
                <span>
                  {item.quantity} x {item.service.name}
                </span>
                {item.dialysisPrescription && item.service.special_rule_code === 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION' ? (
                    <span className="text-emerald-600 font-medium">GRATIS</span>
                  ) : (
                    <span className="text-muted-foreground">L. {item.service.price}</span>
                  )}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-1.5 text-sm border-t border-border pt-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal:</span>
            <span>L. {preview.subtotal}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">ISV (15%):</span>
            <span>L. {preview.tax}</span>
          </div>
          <div className="flex justify-between font-bold text-base">
            <span>Total:</span>
            <span>L. {preview.total}</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Los precios finales seran calculados por el backend al emitir la factura.
        </p>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            ref={confirmButtonRef}
            type="button"
            className="flex-1"
            onClick={onConfirm}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || e.altKey)) {
                e.preventDefault();
                return;
              }

              if (e.key === 'Enter' && !submitting) {
                e.preventDefault();
                onConfirm();
              }
            }}
            disabled={submitting}
          >
            {submitting ? 'Emitiendo...' : willOpenPayment ? 'Emitir y abrir cobro' : 'Confirmar emisión'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
