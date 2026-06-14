import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Dialog } from '../../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Checkbox } from '../../../components/ui/checkbox';
import type { Payment } from '../../../lib/api';
import { formatCents, formatLempirasFromCents, parseCents } from '../../../lib/moneyCents';

type PaymentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewBeforePrint?: boolean;
  invoiceNumber: string;
  patientName: string;
  total: string;
  balanceDue: string;
  paymentMethod: Payment['method'];
  paymentAmount: string;
  onPaymentMethodChange: (method: Payment['method']) => void;
  onPaymentAmountChange: (amount: string) => void;
  onPreviewBeforePrintChange?: (enabled: boolean) => void;
  onConfirm: (appliedAmount: string) => void;
  submitting?: boolean;
  partialPaymentsEnabled?: boolean;
};

export function PaymentModal({
  open,
  onOpenChange,
  previewBeforePrint = false,
  invoiceNumber,
  patientName,
  total,
  balanceDue,
  paymentMethod,
  paymentAmount,
  onPaymentMethodChange,
  onPaymentAmountChange,
  onPreviewBeforePrintChange,
  onConfirm,
  submitting,
  partialPaymentsEnabled = false,
}: PaymentModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [capNotice, setCapNotice] = useState<string | null>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);

  const balanceCents = parseCents(balanceDue);
  const paymentCents = parseCents(paymentAmount);
  const overpaymentCents = paymentCents !== null && balanceCents !== null && paymentCents > balanceCents
    ? paymentCents - balanceCents
    : null;
  const changeCents = overpaymentCents;
  const remainingBalanceCents = paymentCents !== null && balanceCents !== null && paymentCents > 0 && paymentCents < balanceCents
    ? balanceCents - paymentCents
    : null;
  const appliedAmountCents = paymentCents !== null && balanceCents !== null && paymentCents >= balanceCents
    ? balanceCents
    : paymentCents;
  const needsAmount = paymentCents === null || paymentCents <= 0;
  const exceedsPending = paymentCents !== null && balanceCents !== null && paymentCents > balanceCents;
  const pendingAmountLabel = balanceCents !== null ? formatCents(balanceCents) : '0.00';

  useEffect(() => {
    if (open) {
      setError(null);
      setCapNotice(null);
      window.setTimeout(() => amountInputRef.current?.focus(), 0);
    }
  }, [open]);

  function handleAmountChange(value: string) {
    setError(null);
    if (value === '') {
      setCapNotice(null);
      onPaymentAmountChange('');
      return;
    }

    if (!/^\d*(\.\d{0,2})?$/.test(value)) {
      return;
    }

    const cents = parseCents(value);
    const cap = balanceCents;
    if (cap !== null && cents !== null && cents > cap) {
      const capped = formatCents(cap);
      setCapNotice(`El pago no puede superar el saldo pendiente (L. ${pendingAmountLabel}).`);
      onPaymentAmountChange(capped);
      return;
    }

    setCapNotice(null);
    onPaymentAmountChange(value);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const amountCents = parseCents(paymentAmount);
    if (amountCents === null || amountCents <= 0) {
      setError('Ingrese un monto válido');
      amountInputRef.current?.focus();
      return;
    }
    if (balanceCents !== null && amountCents > balanceCents) {
      setError('El pago no puede superar el saldo pendiente.');
      amountInputRef.current?.focus();
      return;
    }
    if (balanceCents !== null && amountCents < balanceCents && !partialPaymentsEnabled) {
      setError('El monto recibido es menor al total.');
      amountInputRef.current?.focus();
      return;
    }
    setError(null);
    onConfirm(formatCents(appliedAmountCents ?? amountCents));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar pago"
      description={`Factura ${invoiceNumber} ya fue emitida. Si sale de este paso quedara pendiente de cobro.`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Paciente:</span>
            <span className="font-medium">{patientName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total:</span>
            <span className="font-medium">{formatLempirasFromCents(parseCents(total))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Saldo pendiente:</span>
            <span className="font-bold">{formatLempirasFromCents(parseCents(balanceDue))}</span>
          </div>
          {changeCents !== null && (
            <div className="flex justify-between text-success-foreground">
              <span className="text-muted-foreground">Cambio:</span>
              <span className="font-bold">{formatLempirasFromCents(changeCents)}</span>
            </div>
          )}
          {remainingBalanceCents !== null && (
            <div className="flex justify-between text-warning-foreground">
              <span className="text-muted-foreground">Saldo pendiente:</span>
              <span className="font-bold">{formatLempirasFromCents(remainingBalanceCents)}</span>
            </div>
          )}
          {remainingBalanceCents !== null && !partialPaymentsEnabled ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive" role="alert">
              El monto recibido es menor al total.
            </div>
          ) : null}
          {remainingBalanceCents !== null && partialPaymentsEnabled ? (
            <div className="rounded-md border border-warning/35 bg-warning/10 px-3 py-2 text-sm text-warning-foreground" role="alert">
              Este pago quedara como abono parcial y mantendra saldo pendiente.
            </div>
          ) : null}
          {appliedAmountCents !== null && appliedAmountCents > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pago aplicado:</span>
              <span className="font-medium">{formatLempirasFromCents(appliedAmountCents)}</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {needsAmount && !error ? (
            <div className="rounded-md border border-warning/35 bg-warning/10 px-3 py-2 text-sm text-warning-foreground" role="alert">
              Ingrese el monto recibido para registrar el cobro.
            </div>
          ) : null}

          <div>
            <Label htmlFor="payment-method" className="mb-1.5 block">Método de pago</Label>
            <Select value={paymentMethod} onValueChange={(v) => onPaymentMethodChange(v as Payment['method'])}>
              <SelectTrigger id="payment-method">
                <SelectValue placeholder="Seleccione método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Efectivo</SelectItem>
                <SelectItem value="card">Tarjeta</SelectItem>
                <SelectItem value="transfer">Transferencia</SelectItem>
                <SelectItem value="other">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="payment-amount" className="mb-1.5 block">Monto recibido (L.)</Label>
            <Input
              ref={amountInputRef}
              id="payment-amount"
              type="text"
              inputMode="decimal"
              value={paymentAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.00"
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? 'payment-amount-error' : capNotice ? 'payment-amount-cap' : undefined}
            />
            {capNotice && !error ? (
              <p id="payment-amount-cap" className="mt-1 text-sm text-warning-foreground" role="status">
                {capNotice}
              </p>
            ) : null}
            {error && <p id="payment-amount-error" className="mt-1 text-sm text-destructive" role="alert">{error}</p>}
          </div>

          <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm">
            <Checkbox
              id="preview-before-print"
              checked={previewBeforePrint}
              onCheckedChange={(checked) => onPreviewBeforePrintChange?.(checked === true)}
              className="mt-0.5"
            />
            <Label htmlFor="preview-before-print" className="grid gap-0.5 leading-none cursor-pointer select-none">
              <span className="font-medium text-foreground">
                Ver preview antes de imprimir
              </span>
              <span className="text-xs text-muted-foreground mt-0.5 font-normal">
                Desactivado: al confirmar cobro se registra el pago y se abre impresión directa.
              </span>
            </Label>
          </div>

          <p className="text-xs text-muted-foreground">
            Cancelar la ventana de impresión no revierte el pago. Si necesita corregir una factura pagada, use el flujo de anulación autorizado.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>
            Dejar pendiente
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={submitting || exceedsPending || needsAmount}
            aria-label={previewBeforePrint ? 'Confirmar cobro y ver preview' : 'Confirmar cobro e imprimir'}
          >
            {submitting ? 'Cobrando...' : previewBeforePrint ? 'Registrar cobro y ver preview' : 'Registrar cobro e imprimir'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

