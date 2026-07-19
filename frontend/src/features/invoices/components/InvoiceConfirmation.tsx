import { AlertTriangleIcon, BanknoteIcon } from 'lucide-react';
import { type KeyboardEvent, useEffect, useRef } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { formatLempirasUIFromCents, parseCents } from '../../../lib/moneyCents';

type CartItem = { service: import('../../../lib/api').Service; quantity: string; dialysisPrescription: boolean };
type Props = { open: boolean; onOpenChange: (open: boolean) => void; patientName: string; items: CartItem[]; preview: { subtotal: string; tax: string; total: string }; taxRate?: string; cashSessionId?: number; canOpenPayment?: boolean; onConfirm: () => void; submitting?: boolean };

export function InvoiceConfirmation({ open, onOpenChange, patientName, items, preview, taxRate, cashSessionId, canOpenPayment = true, onConfirm, submitting }: Props) {
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialysisPrescription = items.some((item) => item.dialysisPrescription && item.service.special_rule_code === 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION');
  const willOpenPayment = canOpenPayment && Boolean(cashSessionId) && (parseCents(preview.total) ?? 0) > 0;
  const title = willOpenPayment ? 'Confirmar emisión y cobro' : 'Confirmar factura';
  useEffect(() => { if (open) window.setTimeout(() => confirmButtonRef.current?.focus(), 0); }, [open]);
  function handleShortcut(event: KeyboardEvent<HTMLButtonElement>) { if (event.ctrlKey && event.key === 'Enter' && !submitting) { event.preventDefault(); onConfirm(); } }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{willOpenPayment ? 'Se emitirá la factura y el sistema abrirá el cobro inmediatamente.' : 'Revise los detalles antes de emitir la factura.'}</DialogDescription></DialogHeader>
        <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3 text-sm"><div><dt className="text-muted-foreground">Paciente</dt><dd className="font-medium">{patientName || 'Sin nombre'}</dd></div><div><dt className="text-muted-foreground">Caja</dt><dd className="font-medium">#{cashSessionId ?? 'Sin caja'}</dd></div></dl>
        <section aria-labelledby="confirmation-services-title"><h3 id="confirmation-services-title" className="font-semibold">Servicios</h3><ul aria-label="Servicios por confirmar" className="mt-2 divide-y divide-border border-y border-border">{items.map((item, index) => <li key={`${item.service.id}-${index}`} className="flex items-center justify-between gap-4 py-3"><span>{item.quantity} x {item.service.name}</span><span>{dialysisPrescription && item.service.special_rule_code === 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION' ? 'GRATIS' : moneyLabel(item.service.price)}</span></li>)}</ul></section>
        <dl className="grid gap-2 rounded-lg bg-muted/45 p-3 text-sm"><MoneyRow label="Subtotal" value={moneyLabel(preview.subtotal)} />{taxRate ? <MoneyRow label={`ISV (${taxRate}%)`} value={moneyLabel(preview.tax)} /> : null}<div className="flex items-center justify-between border-t border-border pt-2 font-semibold"><dt className="flex items-center gap-2"><BanknoteIcon aria-hidden="true" />Total estimado</dt><dd className="font-mono text-lg tabular-nums">{moneyLabel(preview.total)}</dd></div></dl>
        <Alert><AlertTriangleIcon aria-hidden="true" /><AlertDescription>El total definitivo quedará confirmado al emitir la factura.</AlertDescription></Alert>
        <DialogFooter className="grid grid-cols-1 gap-2 sm:grid-cols-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button ref={confirmButtonRef} type="button" onKeyDown={handleShortcut} onClick={onConfirm} disabled={submitting}>{submitting ? <Spinner aria-hidden="true" /> : null}{willOpenPayment ? 'Emitir y abrir cobro' : 'Confirmar emisión'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MoneyRow({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="font-mono tabular-nums">{value}</dd></div>; }
function moneyLabel(value: string | number | null | undefined) { return formatLempirasUIFromCents(parseCents(value)); }
