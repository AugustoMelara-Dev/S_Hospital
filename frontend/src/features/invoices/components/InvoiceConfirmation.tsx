import { useEffect, useRef } from 'react';
import { AlertTriangle, Banknote, ReceiptText } from 'lucide-react';
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
  canOpenPayment?: boolean;
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
  canOpenPayment = true,
  onConfirm,
  submitting,
}: InvoiceConfirmationProps) {
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const willOpenPayment = canOpenPayment && Boolean(cashSessionId) && (parseCents(preview.total) ?? 0) > 0;

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
        <div className="rounded-panel border border-operational-border bg-operational-panel/70 p-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <span className="shrink-0 text-muted-foreground">Paciente:</span>
            <span className="min-w-0 break-words text-right font-medium">{patientName || 'Sin nombre'}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="shrink-0 text-muted-foreground">Caja:</span>
            <span className="min-w-0 break-words text-right font-medium">#{cashSessionId ?? 'Sin caja'}</span>
          </div>
        </div>

        <div className="rounded-md border border-operational-border bg-card p-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <ReceiptText className="size-4 text-secondary" aria-hidden="true" />
            Servicios:
          </p>
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

        <div className="rounded-md border border-secondary/25 bg-secondary/10 p-3 text-sm">
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
          <div className="mt-2 flex items-start justify-between gap-3 border-t border-secondary/25 pt-2 text-base font-bold">
            <span className="flex shrink-0 items-center gap-2">
              <Banknote className="size-4" aria-hidden="true" />
              Total estimado:
            </span>
            <span className="shrink-0 whitespace-nowrap text-right tabular-nums">{moneyLabel(preview.total)}</span>
          </div>
        </div>

        <p className="flex gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>Los precios finales seran calculados por el backend al emitir la factura.</span>
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
