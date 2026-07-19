import { CircleAlertIcon, CircleCheckIcon, EyeIcon, FileDownIcon, PlusIcon, PrinterIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Payment } from '../../../lib/api';
import { formatLempirasUIFromCents, parseCents } from '../../../lib/moneyCents';

type InvoiceStatus = 'issued' | 'paid' | 'partial' | 'void';
type Props = { open: boolean; onOpenChange: (open: boolean) => void; invoiceNumber: string; patientName: string; total: string; status: InvoiceStatus; canCollectPayment?: boolean; canPrintReceipt?: boolean; canSavePdf?: boolean; receiptRecoveryMessage?: string; paymentMethod?: Payment['method']; paymentDate?: string; receivedAmount?: string | null; changeAmount?: string | null; onCobrar: () => void; onVerRecibo?: () => void; onImprimir: () => void; onGuardarPdf?: () => void; onNuevaFactura: () => void };
const STATUS_LABELS: Record<InvoiceStatus, string> = { issued: 'Emitida', paid: 'Pagada', partial: 'Parcial', void: 'Anulada' };
const PAYMENT_METHOD_LABELS: Record<Payment['method'], string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', other: 'Otro' };

export function InvoiceSuccess({ open, onOpenChange, invoiceNumber, patientName, total, status, canCollectPayment = true, canPrintReceipt = true, canSavePdf = false, receiptRecoveryMessage, paymentMethod, paymentDate, receivedAmount, changeAmount, onCobrar, onVerRecibo, onImprimir, onGuardarPdf, onNuevaFactura }: Props) {
  const needsPayment = status === 'issued' || status === 'partial';
  const canShowPaymentAction = needsPayment && canCollectPayment;
  const title = status === 'paid' ? 'Factura pagada' : needsPayment ? 'Factura pendiente' : 'Factura creada';
  const hasReceiptRecovery = Boolean(receiptRecoveryMessage?.trim());
  const description = status === 'paid' ? canPrintReceipt ? 'La factura ya fue pagada. Recibo listo para imprimir.' : 'La factura ya fue pagada. Solicite a caja imprimir el recibo institucional.' : needsPayment ? 'La factura ya fue emitida y queda pendiente de cobro para caja.' : 'Factura creada.';
  const primaryActionRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (open) window.setTimeout(() => primaryActionRef.current?.focus(), 0); }, [open, canShowPaymentAction]);

  const newInvoiceButton = <Button type="button" variant="outline" ref={!canShowPaymentAction ? primaryActionRef : undefined} onClick={onNuevaFactura}><PlusIcon aria-hidden="true" />Nueva factura</Button>;
  return (
    <Dialog modal={false} open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="items-center text-center">{status === 'paid' || !needsPayment ? <CircleCheckIcon aria-hidden="true" className="size-12 text-success" /> : <CircleAlertIcon aria-hidden="true" className="size-12 text-warning" />}<DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        <dl className="grid gap-2 rounded-lg border border-border p-3 text-sm"><Detail label="Factura" value={invoiceNumber} /><Detail label="Paciente" value={patientName} /><Detail label="Total" value={moneyLabel(total)} /><Detail label="Estado" value={STATUS_LABELS[status]} />{paymentMethod ? <Detail label="Método" value={PAYMENT_METHOD_LABELS[paymentMethod]} /> : null}{paymentMethod === 'cash' && receivedAmount ? <Detail label="Monto recibido" value={moneyLabel(receivedAmount)} /> : null}{paymentMethod === 'cash' && changeAmount ? <Detail label="Cambio" value={moneyLabel(changeAmount)} /> : null}{formatPaymentDate(paymentDate) ? <Detail label="Fecha de pago" value={formatPaymentDate(paymentDate) ?? ''} /> : null}</dl>
        {receiptRecoveryMessage ? <Alert><CircleAlertIcon aria-hidden="true" /><AlertDescription>{receiptRecoveryMessage}</AlertDescription></Alert> : null}
        {needsPayment ? <p className="text-sm text-muted-foreground">{canShowPaymentAction ? 'La factura ya fue emitida. El siguiente paso operativo es registrar el cobro.' : 'La factura ya fue emitida y queda pendiente de cobro para caja.'}</p> : null}
        <div className="grid gap-2">{needsPayment ? <>{canShowPaymentAction ? <Button ref={primaryActionRef} type="button" onClick={onCobrar}>Cobrar ahora</Button> : null}{newInvoiceButton}</> : canPrintReceipt ? <>{onVerRecibo ? <Button ref={primaryActionRef} type="button" onClick={onVerRecibo}><EyeIcon aria-hidden="true" />Ver recibo</Button> : null}<Button ref={onVerRecibo ? undefined : primaryActionRef} type="button" variant="outline" onClick={onImprimir}><PrinterIcon aria-hidden="true" />Imprimir recibo</Button>{canSavePdf && onGuardarPdf ? <Button type="button" variant="outline" onClick={onGuardarPdf}><FileDownIcon aria-hidden="true" />Guardar PDF</Button> : null}{newInvoiceButton}</> : <>{hasReceiptRecovery ? <Button asChild><Link to={`/invoices?invoice_number=${encodeURIComponent(invoiceNumber)}`}>Resolver recibo en Historial</Link></Button> : null}{newInvoiceButton}</>}{!hasReceiptRecovery || canPrintReceipt ? <Button asChild variant="link"><Link to="/invoices">Ir al historial</Link></Button> : null}</div>
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium">{value}</dd></div>; }
function moneyLabel(value: string | number | null | undefined) { return formatLempirasUIFromCents(parseCents(value)); }
function formatPaymentDate(value?: string) { if (!value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date); }
