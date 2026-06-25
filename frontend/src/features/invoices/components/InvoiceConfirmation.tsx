import { useEffect, useRef } from 'react';
import { Button } from '../../../components/ui/button';
import { Dialog } from '../../../components/ui/dialog';
import { formatLempirasUIFromCents, parseCents } from '../../../lib/moneyCents';

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
  taxRate?: string;
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
  taxRate,
  cashSessionId,
  onConfirm,
  submitting,
}: InvoiceConfirmationProps) {
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const willOpenPayment = Boolean(cashSessionId) && (parseCents(preview.total) ?? 0) > 0;

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
          <div className="flex items-start justify-between gap-3">
            <span className="shrink-0 text-muted-foreground">Paciente:</span>
            <span className="min-w-0 break-words text-right font-medium">{patientName || 'Sin nombre'}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="shrink-0 text-muted-foreground">Caja:</span>
            <span className="min-w-0 break-words text-right font-medium">#{cashSessionId ?? 'Sin caja'}</span>
          </div>
        </div>

        <div className="rounded-md border border-border p-3">
          <p className="font-semibold text-sm mb-2">Servicios:</p>
          <ul aria-label="Servicios por confirmar" className="space-y-1.5 text-sm max-h-[200px] overflow-y-auto">
            {items.map((item, index) => (
              <li key={`${item.service.id}-${index}`} className="flex items-start justify-between gap-3">
                <span className="min-w-0 break-words">
                  {item.quantity} x {item.service.name}
                </span>
                {item.dialysisPrescription && item.service.special_rule_code === 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION' ? (
                  <span className="shrink-0 whitespace-nowrap font-medium text-success-foreground">GRATIS</span>
                ) : (
                  <span className="shrink-0 whitespace-nowrap text-right text-muted-foreground tabular-nums">{moneyLabel(item.service.price)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-1.5 text-sm border-t border-border pt-3">
          <div className="flex items-start justify-between gap-3">
            <span className="shrink-0 text-muted-foreground">Subtotal:</span>
            <span className="shrink-0 whitespace-nowrap text-right tabular-nums">{moneyLabel(preview.subtotal)}</span>
          </div>
          {taxRate && (
            <div className="flex items-start justify-between gap-3">
              <span className="shrink-0 text-muted-foreground">ISV ({taxRate}%):</span>
              <span className="shrink-0 whitespace-nowrap text-right tabular-nums">{moneyLabel(preview.tax)}</span>
            </div>
          )}
          <div className="flex items-start justify-between gap-3 font-bold text-base">
            <span className="shrink-0">Total estimado:</span>
            <span className="shrink-0 whitespace-nowrap text-right tabular-nums">{moneyLabel(preview.total)}</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Los precios finales seran calculados por el backend al emitir la factura.
        </p>

        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:gap-3">
          <Button type="button" variant="secondary" className="w-full sm:flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            ref={confirmButtonRef}
            type="button"
            className="w-full sm:flex-1"
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? 'Emitiendo...' : willOpenPayment ? 'Emitir y abrir cobro' : 'Confirmar emisión'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function moneyLabel(value: string | number | null | undefined): string {
  return formatLempirasUIFromCents(parseCents(value));
}
