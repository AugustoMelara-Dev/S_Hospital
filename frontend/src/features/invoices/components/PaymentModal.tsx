import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Dialog } from '../../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Checkbox } from '../../../components/ui/checkbox';
import type { Payment } from '../../../lib/api';
import { formatLempirasFromCents, parseCents } from '../../../lib/moneyCents';

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
  const amountInputRef = useRef<HTMLInputElement | null>(null);

  const balanceCents = parseMoneyCents(balanceDue);
  const paymentCents = parseMoneyCents(paymentAmount);
  const changeCents = paymentCents !== null && balanceCents !== null && paymentCents > balanceCents
    ? paymentCents - balanceCents
    : null;
  const remainingBalanceCents = paymentCents !== null && balanceCents !== null && paymentCents > 0 && paymentCents < balanceCents
    ? balanceCents - paymentCents
    : null;
  const appliedAmountCents = paymentCents !== null && balanceCents !== null && paymentCents >= balanceCents
    ? balanceCents
    : paymentCents;
  const needsAmount = paymentCents === null || paymentCents <= 0;

  useEffect(() => {
    if (open) {
      setError(null);
      window.setTimeout(() => amountInputRef.current?.focus(), 0);
    }
  }, [open]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const amountCents = parseMoneyCents(paymentAmount);
    if (amountCents === null || amountCents <= 0) {
      setError('Ingrese un monto valido');
      amountInputRef.current?.focus();
      return;
    }
    if (balanceCents !== null && amountCents < balanceCents && !partialPaymentsEnabled) {
      setError('El monto recibido es menor al total.');
      amountInputRef.current?.focus();
      return;
    }
    setError(null);
    onConfirm(formatMoneyCents(appliedAmountCents ?? amountCents));
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
            <span className="font-medium">{moneyLabel(total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Saldo pendiente:</span>
            <span className="font-bold">{moneyLabel(balanceDue)}</span>
          </div>
          {changeCents !== null && (
            <div className="flex justify-between text-emerald-600">
              <span className="text-muted-foreground">Cambio:</span>
              <span className="font-bold">{moneyLabelFromCents(changeCents)}</span>
            </div>
          )}
          {remainingBalanceCents !== null && (
            <div className="flex justify-between text-amber-700">
              <span className="text-muted-foreground">Saldo pendiente:</span>
              <span className="font-bold">{moneyLabelFromCents(remainingBalanceCents)}</span>
            </div>
          )}
          {remainingBalanceCents !== null && !partialPaymentsEnabled ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive" role="alert">
              El monto recibido es menor al total.
            </div>
          ) : null}
          {remainingBalanceCents !== null && partialPaymentsEnabled ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="alert">
              Este pago quedara como abono parcial y mantendra saldo pendiente.
            </div>
          ) : null}
          {appliedAmountCents !== null && appliedAmountCents > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pago aplicado:</span>
              <span className="font-medium">{moneyLabelFromCents(appliedAmountCents)}</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {needsAmount && !error ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="alert">
              Ingrese el monto recibido para registrar el cobro.
            </div>
          ) : null}

          <div>
            <Label htmlFor="payment-method" className="mb-1.5 block">Metodo de pago</Label>
            <Select value={paymentMethod} onValueChange={(v) => onPaymentMethodChange(v as Payment['method'])}>
              <SelectTrigger id="payment-method">
                <SelectValue placeholder="Seleccione metodo" />
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
              type="number"
              step="0.01"
              min="0"
              value={paymentAmount}
              onChange={(e) => {
                setError(null);
                onPaymentAmountChange(e.target.value);
              }}
              placeholder="0.00"
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? 'payment-amount-error' : undefined}
            />
            {error && <p id="payment-amount-error" className="mt-1 text-sm text-destructive" role="alert">{error}</p>}
          </div>

          <label className="flex items-start gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm cursor-pointer select-none">
            <Checkbox
              id="preview-before-print"
              checked={previewBeforePrint}
              onCheckedChange={(checked) => onPreviewBeforePrintChange?.(checked === true)}
              className="mt-0.5"
            />
            <div className="grid gap-0.5 leading-none">
              <span className="font-medium text-foreground">
                Ver preview antes de imprimir
              </span>
              <span className="text-xs text-muted-foreground mt-0.5">
                Desactivado: al confirmar cobro se registra el pago y se abre impresion directa.
              </span>
            </div>
          </label>

          <p className="text-xs text-muted-foreground">
            Cancelar la ventana de impresion no revierte el pago. Si necesita corregir una factura pagada, use el flujo de anulacion autorizado.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>
            Dejar pendiente
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={submitting}
            aria-label={previewBeforePrint ? 'Confirmar cobro y ver preview' : 'Confirmar cobro e imprimir'}
          >
            {submitting ? 'Cobrando...' : previewBeforePrint ? 'Registrar cobro y ver preview' : 'Registrar cobro e imprimir'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function parseMoneyCents(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const [integer, decimal = '00'] = normalized.split('.');
  return Number(integer) * 100 + Number(decimal.padEnd(2, '0').slice(0, 2));
}

function formatMoneyCents(cents: number): string {
  return `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

function moneyLabel(value: string | number | null | undefined): string {
  return formatLempirasFromCents(parseCents(value));
}

function moneyLabelFromCents(cents: number): string {
  return formatLempirasFromCents(cents);
}
