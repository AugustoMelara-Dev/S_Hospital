import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Banknote, Printer, ReceiptText } from 'lucide-react';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Checkbox } from '../../../components/ui/checkbox';
import { Dialog } from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { MoneyText } from '../../../components/ui/money-text';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Separator } from '../../../components/ui/separator';
import type { Payment } from '../../../lib/api';
import { formatLempirasUIFromCents, parseCents as parseCentsNullable } from '../../../lib/moneyCents';
import { parseCents } from '../../../lib/money';

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
  paymentReference?: string;
  onPaymentMethodChange: (method: Payment['method']) => void;
  onPaymentAmountChange: (amount: string) => void;
  onPaymentReferenceChange?: (reference: string) => void;
  onPreviewBeforePrintChange?: (enabled: boolean) => void;
  onConfirm: (appliedAmount: string) => void;
  submitting?: boolean;
  partialPaymentsEnabled?: boolean;
};

const methodHelp: Record<Payment['method'], string> = {
  cash: 'Solo los pagos en efectivo aumentan el efectivo esperado en caja.',
  card: 'Este método queda separado del efectivo esperado de caja.',
  transfer: 'Este método queda separado del efectivo esperado de caja.',
  other: 'Este método queda separado del efectivo esperado de caja.',
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
  paymentReference = '',
  onPaymentMethodChange,
  onPaymentAmountChange,
  onPaymentReferenceChange = () => undefined,
  onPreviewBeforePrintChange,
  onConfirm,
  submitting,
  partialPaymentsEnabled = false,
}: PaymentModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [capNotice, setCapNotice] = useState<string | null>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);

  const balanceCents = parseMoneyCents(balanceDue);
  const paymentCents = parseMoneyCents(paymentAmount);
  const cashCanReturnChange = paymentMethod === 'cash';
  const overpaymentCents = cashCanReturnChange && paymentCents !== null && balanceCents !== null && paymentCents > balanceCents
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
  const exceedsPending = !cashCanReturnChange && paymentCents !== null && balanceCents !== null && paymentCents > balanceCents;
  const pendingAmountLabel = balanceCents !== null ? formatMoneyCents(balanceCents) : '0.00';
  const amountDescribedBy = [
    'payment-amount-help',
    capNotice && !error ? 'payment-amount-cap' : null,
    error ? 'payment-amount-error' : null,
  ].filter(Boolean).join(' ');
  const patientLabel = patientName.trim() || 'Paciente no especificado';

  useEffect(() => {
    if (open) {
      setError(null);
      setCapNotice(null);
      window.setTimeout(() => amountInputRef.current?.focus(), 0);
    }
  }, [open, invoiceNumber]);

  function handleAmountChange(value: string) {
    setError(null);
    const normalizedValue = value.replace(',', '.');
    if (normalizedValue === '') {
      setCapNotice(null);
      onPaymentAmountChange('');
      return;
    }

    if (!/^\d*(\.\d{0,2})?$/.test(normalizedValue)) {
      return;
    }

    const cents = parseCents(normalizedValue);
    const cap = balanceCents;
    if (!cashCanReturnChange && cap !== null && cents > cap) {
      const capped = formatMoneyCents(cap);
      setCapNotice(`El pago no puede superar el saldo pendiente (L. ${pendingAmountLabel}).`);
      onPaymentAmountChange(capped);
      return;
    }

    setCapNotice(null);
    onPaymentAmountChange(normalizedValue);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const amountCents = parseMoneyCents(paymentAmount);
    if (amountCents === null || amountCents <= 0) {
      setError('Ingrese un monto válido');
      amountInputRef.current?.focus();
      return;
    }
    if (!cashCanReturnChange && balanceCents !== null && amountCents > balanceCents) {
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
    onConfirm(formatMoneyCents(appliedAmountCents ?? amountCents));
  }

  function requestClose() {
    if (!submitting) {
      onOpenChange(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!submitting) {
          onOpenChange(nextOpen);
        }
      }}
      size="lg"
      title="Registrar pago"
      description={`Factura ${invoiceNumber} ya fue emitida. Si sale de este paso quedara pendiente de cobro.`}
    >
      <form
        aria-busy={submitting ? 'true' : undefined}
        onSubmit={handleSubmit}
        className="flex min-w-0 flex-col gap-5"
      >
        <section
          aria-label="Resumen de factura"
          className="rounded-panel border border-operational-border bg-operational-panel/70 p-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <ReceiptText className="size-3.5 text-secondary" aria-hidden="true" />
                Factura
              </p>
              <p className="break-words font-semibold tabular-nums text-foreground">{invoiceNumber}</p>
              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Paciente</p>
              <p className="break-words font-medium text-foreground">{patientLabel}</p>
            </div>
            <div className="grid gap-1 rounded-md border border-secondary/25 bg-secondary/10 px-3 py-2 text-sm sm:min-w-44 sm:text-right">
              <span className="text-muted-foreground">Saldo pendiente</span>
              <MoneyText emphasis="strong" className="text-xl">
                {moneyLabel(balanceDue)}
              </MoneyText>
            </div>
          </div>
          <Separator className="my-4" />
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-3 sm:block">
              <dt className="text-muted-foreground">Total:</dt>
              <dd className="font-medium">
                <MoneyText>{moneyLabel(total)}</MoneyText>
              </dd>
            </div>
            <div className="flex justify-between gap-3 sm:block sm:text-right">
              <dt className="text-muted-foreground">Pago aplicado:</dt>
              <dd className="font-medium">
                {appliedAmountCents !== null && appliedAmountCents > 0 ? (
                  <MoneyText>{moneyLabelFromCents(appliedAmountCents)}</MoneyText>
                ) : (
                  <span className="tabular-nums text-muted-foreground">L 0.00</span>
                )}
              </dd>
            </div>
            {changeCents !== null ? (
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-muted-foreground">Cambio:</dt>
                <dd className="font-semibold">
                  <MoneyText tone="success">{moneyLabelFromCents(changeCents)}</MoneyText>
                </dd>
              </div>
            ) : null}
            {remainingBalanceCents !== null ? (
              <div className="flex justify-between gap-3 sm:block sm:text-right">
                <dt className="text-muted-foreground">Saldo pendiente:</dt>
                <dd className="font-semibold">
                  <MoneyText tone="warning">{moneyLabelFromCents(remainingBalanceCents)}</MoneyText>
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        <div className="grid gap-3">
          {needsAmount && !error ? (
            <Alert variant="warning" className="py-3">
              Ingrese el monto recibido para registrar el cobro.
            </Alert>
          ) : null}

          {remainingBalanceCents !== null && !partialPaymentsEnabled ? (
            <Alert variant="destructive" className="py-3">
              El monto recibido es menor al total.
            </Alert>
          ) : null}

          {remainingBalanceCents !== null && partialPaymentsEnabled ? (
            <Alert variant="warning" className="py-3">
              Este pago quedara como abono parcial y mantendra saldo pendiente.
            </Alert>
          ) : null}

          {submitting ? (
            <Alert variant="default" className="py-3" aria-live="polite">
              Registrando cobro, no repita la operacion.
            </Alert>
          ) : null}
        </div>

        <section aria-label="Datos del pago" className="grid gap-4 rounded-panel border border-operational-border bg-card p-4">
          <div className="grid gap-1.5">
            <Label htmlFor="payment-method">Método de pago</Label>
            <Select value={paymentMethod} onValueChange={(v) => onPaymentMethodChange(v as Payment['method'])}>
              <SelectTrigger id="payment-method" aria-describedby="payment-method-help">
                <SelectValue placeholder="Seleccione método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Efectivo</SelectItem>
                <SelectItem value="card">Tarjeta</SelectItem>
                <SelectItem value="transfer">Transferencia</SelectItem>
                <SelectItem value="other">Otro</SelectItem>
              </SelectContent>
            </Select>
            <p id="payment-method-help" className="text-xs text-muted-foreground">
              {methodHelp[paymentMethod]}
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="payment-amount">Monto recibido (L.)</Label>
            <div className="relative">
              <Banknote className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary" aria-hidden="true" />
              <Input
                ref={amountInputRef}
                id="payment-amount"
                type="text"
                inputMode="decimal"
                value={paymentAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.00"
                aria-invalid={error ? 'true' : 'false'}
                aria-describedby={amountDescribedBy || undefined}
                className="min-h-12 pl-10 text-lg font-semibold tabular-nums"
              />
            </div>
            <p id="payment-amount-help" className="text-xs text-muted-foreground">
              Use hasta dos decimales. El backend registra el pago final.
            </p>
            {capNotice && !error ? (
              <p id="payment-amount-cap" className="text-sm text-warning-foreground" role="status">
                {capNotice}
              </p>
            ) : null}
            {error ? (
              <p id="payment-amount-error" className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          {paymentMethod !== 'cash' ? (
            <div className="grid gap-1.5">
              <Label htmlFor="payment-reference">Referencia de pago</Label>
              <Input
                id="payment-reference"
                value={paymentReference}
                onChange={(e) => onPaymentReferenceChange(e.target.value)}
                placeholder="Número de transacción o comprobante"
                aria-describedby="payment-reference-help"
                className="break-words"
              />
              <p id="payment-reference-help" className="text-xs text-muted-foreground">
                Use la referencia real del comprobante cuando aplique.
              </p>
            </div>
          ) : null}
        </section>

        <div className="flex items-start gap-3 rounded-md border border-operational-border bg-operational-panel/70 px-3 py-2.5 text-sm">
          <Checkbox
            id="preview-before-print"
            checked={previewBeforePrint}
            onCheckedChange={(checked) => onPreviewBeforePrintChange?.(checked === true)}
            className="mt-0.5"
          />
          <Label htmlFor="preview-before-print" className="grid cursor-pointer select-none gap-0.5 leading-none">
            <span className="font-medium text-foreground">
              Ver preview antes de imprimir
            </span>
            <span className="mt-0.5 text-xs font-normal text-muted-foreground">
              Desactivado: al confirmar cobro se registra el pago y se abre impresión directa.
            </span>
          </Label>
        </div>

        <p className="text-xs text-muted-foreground">
          Cancelar la ventana de impresión no revierte el pago. Si necesita corregir una factura pagada, use el flujo de anulación autorizado.
        </p>

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" className="sm:min-w-36" onClick={requestClose} disabled={submitting}>
            Dejar pendiente
          </Button>
          <Button
            type="submit"
            className="sm:min-w-56"
            disabled={submitting || exceedsPending || needsAmount}
            aria-label={previewBeforePrint ? 'Confirmar cobro y ver preview' : 'Confirmar cobro e imprimir'}
          >
            {submitting ? 'Cobrando...' : previewBeforePrint ? 'Registrar cobro y ver preview' : (
              <span className="inline-flex items-center gap-2">
                <Printer className="size-4" aria-hidden="true" />
                Registrar cobro e imprimir
              </span>
            )}
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
  const isNegative = cents < 0;
  const abs = Math.abs(cents);
  const str = String(abs).padStart(3, '0');
  const integer = str.slice(0, -2);
  const decimal = str.slice(-2);
  return `${isNegative ? '-' : ''}${integer}.${decimal}`;
}

function moneyLabel(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return formatLempirasUIFromCents(0);
  }

  return formatLempirasUIFromCents(parseCentsNullable(value));
}

function moneyLabelFromCents(cents: number): string {
  return formatLempirasUIFromCents(cents);
}
