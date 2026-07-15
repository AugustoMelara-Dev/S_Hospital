import { DollarOutlined as Banknote, PrinterOutlined as Printer, FileTextOutlined as ReceiptText } from '@ant-design/icons';
import { Alert, Button, Divider, Input, Modal, Typography, type InputRef } from 'antd';
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import type { Payment } from '../../../lib/api';
import { formatLempirasUIFromCents, parseCents as parseCentsNullable } from '../../../lib/moneyCents';

type PaymentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

const paymentMethods: Array<{ value: Payment['method']; label: string }> = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'other', label: 'Otro' },
];

export function PaymentModal({
  open,
  onOpenChange,
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
  onConfirm,
  submitting,
  partialPaymentsEnabled = false,
}: PaymentModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const amountInputRef = useRef<InputRef | null>(null);
  const referenceInputRef = useRef<InputRef | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const submitLockRef = useRef(false);

  const balanceCents = parseMoneyCents(balanceDue);
  const paymentCents = parseMoneyCents(paymentAmount);
  const cashCanReturnChange = paymentMethod === 'cash';
  const effectivePaymentCents = cashCanReturnChange ? paymentCents : balanceCents;
  const overpaymentCents = cashCanReturnChange && paymentCents !== null && balanceCents !== null && paymentCents > balanceCents
    ? paymentCents - balanceCents
    : null;
  const changeCents = overpaymentCents;
  const remainingBalanceCents = effectivePaymentCents !== null && balanceCents !== null && effectivePaymentCents > 0 && effectivePaymentCents < balanceCents
    ? balanceCents - effectivePaymentCents
    : null;
  const appliedAmountCents = effectivePaymentCents !== null && balanceCents !== null && effectivePaymentCents >= balanceCents
    ? balanceCents
    : effectivePaymentCents;
  const needsAmount = effectivePaymentCents === null || effectivePaymentCents <= 0;
  const requiresReference = paymentMethod === 'card' || paymentMethod === 'transfer';
  const summaryColumnCount = 2 + (cashCanReturnChange ? 1 : 0) + (remainingBalanceCents !== null ? 1 : 0);
  const amountDescribedBy = [
    'payment-amount-help',
    error ? 'payment-amount-error' : null,
  ].filter(Boolean).join(' ');
  const patientLabel = (patientName ?? '').trim() || 'Paciente no especificado';

  useEffect(() => {
    if (open) {
      setError(null);
      setReferenceError(null);
      window.setTimeout(() => {
        if (cashCanReturnChange) {
          amountInputRef.current?.focus();
          amountInputRef.current?.select();
        } else if (requiresReference) {
          referenceInputRef.current?.focus();
        }
      }, 0);
    }
  }, [cashCanReturnChange, invoiceNumber, open, requiresReference]);

  useEffect(() => {
    if (!submitting) {
      submitLockRef.current = false;
    }
  }, [submitting]);

  function handleAmountChange(value: string) {
    setError(null);
    const normalizedValue = value.trim().replace(',', '.');
    if (normalizedValue === '') {
      onPaymentAmountChange('');
      return;
    }

    if (!/^\d*(\.\d{0,2})?$/.test(normalizedValue)) {
      return;
    }

    onPaymentAmountChange(normalizedValue);
  }

  function applyCashPreset(cents: number) {
    setError(null);
    onPaymentAmountChange(formatMoneyCents(cents));
    window.setTimeout(() => amountInputRef.current?.focus(), 0);
  }

  function handlePaymentMethodChange(method: Payment['method']) {
    setReferenceError(null);
    onPaymentMethodChange(method);
    if (method === 'cash' || method === 'other') {
      onPaymentReferenceChange('');
    }
  }

  function handlePaymentMethodKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (submitting) return;

    const offsets: Partial<Record<string, number>> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    const radios = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    const targetIndex = radios.indexOf(event.target as HTMLButtonElement);
    const currentIndex = targetIndex >= 0
      ? targetIndex
      : paymentMethods.findIndex((method) => method.value === paymentMethod);
    let nextIndex: number;

    if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = paymentMethods.length - 1;
    } else if (offsets[event.key] !== undefined) {
      nextIndex = (currentIndex + (offsets[event.key] ?? 0) + paymentMethods.length) % paymentMethods.length;
    } else {
      return;
    }

    event.preventDefault();
    handlePaymentMethodChange(paymentMethods[nextIndex].value);
    window.setTimeout(() => radios[nextIndex]?.focus(), 0);
  }

  function handleReferenceChange(value: string) {
    setReferenceError(null);
    onPaymentReferenceChange(value);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || submitLockRef.current) {
      return;
    }

    const amountCents = cashCanReturnChange ? parseMoneyCents(paymentAmount) : balanceCents;
    if (amountCents === null || amountCents <= 0) {
      setError('Ingrese un monto válido');
      amountInputRef.current?.focus();
      return;
    }
    if (balanceCents !== null && amountCents < balanceCents && !partialPaymentsEnabled) {
      setError('El monto recibido es menor al total.');
      amountInputRef.current?.focus();
      return;
    }
    if (requiresReference && paymentReference.trim() === '') {
      setReferenceError('Ingrese la referencia del comprobante.');
      referenceInputRef.current?.focus();
      return;
    }
    setError(null);
    setReferenceError(null);
    submitLockRef.current = true;
    onConfirm(formatMoneyCents(appliedAmountCents ?? amountCents));
  }

  function handleAmountKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!e.ctrlKey || e.key !== 'Enter' || submitting) {
      return;
    }

    e.preventDefault();
    formRef.current?.requestSubmit();
  }

  function requestClose() {
    if (!submitting) {
      onOpenChange(false);
    }
  }

  return (
    <Modal
      open={open}
      onCancel={requestClose}
      title="Registrar pago"
      aria-describedby="payment-dialog-description"
      footer={null}
      width={720}
      destroyOnHidden
    >
      <Typography.Paragraph id="payment-dialog-description">
        Factura {invoiceNumber} ya fue emitida. Si sale de este paso quedara pendiente de cobro.
      </Typography.Paragraph>
      <form
        ref={formRef}
        aria-busy={submitting ? 'true' : undefined}
        onSubmit={handleSubmit}
        className="flex min-w-0 flex-col gap-5"
      >
        {submitting ? <p role="status">Registrando cobro...</p> : null}
        <section
          aria-label="Resumen de factura"
          className="overflow-hidden border border-border bg-surface p-5"
        >
          <div className="flex flex-col gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary-foreground">
                <ReceiptText className="size-3.5 text-secondary" aria-hidden="true" />
                Factura
              </p>
              <p className="break-words font-semibold tabular-nums text-foreground">{invoiceNumber}</p>
              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Paciente</p>
              <p className="break-words font-medium text-foreground">{patientLabel}</p>
            </div>
          </div>
          <Divider className="my-4" />
          <section
            aria-label="Resumen del cobro"
            data-summary-columns={String(summaryColumnCount)}
            className={`grid border border-border bg-muted ${summaryColumnCount === 4 ? 'grid-cols-2 sm:grid-cols-4' : summaryColumnCount === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}
          >
            <div className="border-r border-border p-3">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">Total</span>
              <strong className="mt-1 block font-mono text-lg tabular-nums text-foreground">{moneyLabel(total)}</strong>
            </div>
            <div className="p-3">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {cashCanReturnChange ? 'Recibido' : 'A cobrar'}
              </span>
              <strong className="mt-1 block font-mono text-lg tabular-nums text-foreground">{moneyLabelFromCents(effectivePaymentCents ?? 0)}</strong>
            </div>
            {cashCanReturnChange ? (
              <div className="p-3">
                <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">Cambio:</span>
                <strong className="mt-1 block font-mono text-lg tabular-nums text-foreground">{moneyLabelFromCents(changeCents ?? 0)}</strong>
              </div>
            ) : null}
            {remainingBalanceCents !== null ? (
              <div className="border-l border-border p-3">
                <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">Saldo después del pago</span>
                <strong className="mt-1 block font-mono text-lg tabular-nums text-warning-foreground">{moneyLabelFromCents(remainingBalanceCents)}</strong>
              </div>
            ) : null}
          </section>
        </section>

        <div className="grid gap-3">
          {needsAmount && !error ? (
            <Alert type="warning" showIcon className="py-3" title="Ingrese el monto recibido para registrar el cobro." />
          ) : null}

          {remainingBalanceCents !== null && !partialPaymentsEnabled ? (
            <Alert type="error" showIcon className="py-3" title="El monto recibido es menor al total." />
          ) : null}

          {remainingBalanceCents !== null && partialPaymentsEnabled ? (
            <Alert type="warning" showIcon className="py-3" title="Este pago quedara como abono parcial y mantendra saldo pendiente." />
          ) : null}

          {submitting ? (
            <Alert type="info" showIcon className="py-3" aria-live="polite" title="Registrando cobro, no repita la operacion." />
          ) : null}
        </div>

        <section aria-label="Datos del pago" className="grid gap-5 border border-operational-border bg-card p-5">
          <fieldset className="grid gap-1.5">
            <legend className="text-sm font-medium">Método de pago</legend>
            <div
              role="radiogroup"
              aria-label="Método de pago"
              aria-describedby="payment-method-help"
              tabIndex={-1}
              className="grid grid-cols-2 gap-2 bg-muted p-2 sm:grid-cols-4"
              onKeyDown={handlePaymentMethodKeyDown}
            >
              {paymentMethods.map((method) => (
                <Button
                  key={method.value}
                  htmlType="button"
                  role="radio"
                  aria-checked={paymentMethod === method.value}
                  aria-label={method.label}
                  tabIndex={paymentMethod === method.value ? 0 : -1}
                  type={paymentMethod === method.value ? 'primary' : 'default'}
                  className="min-h-11"
                  disabled={submitting}
                  onClick={() => handlePaymentMethodChange(method.value)}
                >
                  {method.label}
                </Button>
              ))}
            </div>
            <p id="payment-method-help" className="text-xs text-muted-foreground">
              {methodHelp[paymentMethod]}
            </p>
          </fieldset>

          {cashCanReturnChange ? <div className="grid gap-1.5">
            <label htmlFor="payment-amount">Monto recibido (L.)</label>
            <div className="relative">
              <Banknote className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary" aria-hidden="true" />
              <Input
                ref={amountInputRef}
                id="payment-amount"
                type="text"
                inputMode="decimal"
                value={paymentAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                onKeyDown={handleAmountKeyDown}
                placeholder="0.00"
                disabled={submitting}
                aria-invalid={error ? 'true' : 'false'}
                aria-describedby={amountDescribedBy || undefined}
                className="min-h-12 pl-10 text-lg font-semibold tabular-nums"
              />
            </div>
            <div className="grid grid-cols-4 gap-2" aria-label="Montos rápidos de efectivo">
              <Button htmlType="button" disabled={submitting} onClick={() => applyCashPreset(balanceCents ?? 0)}>Exacto</Button>
              {[100, 200, 500].map((amount) => (
                <Button key={amount} htmlType="button" disabled={submitting} onClick={() => applyCashPreset(amount * 100)}>
                  L {amount}
                </Button>
              ))}
            </div>
            <p id="payment-amount-help" className="text-xs text-muted-foreground">
              Use hasta dos decimales. Se registrara el monto aplicado a la factura.
            </p>
            {error ? (
              <p id="payment-amount-error" className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div> : null}

          {requiresReference ? (
            <div className="grid gap-1.5">
              <label htmlFor="payment-reference">Referencia de pago</label>
              <Input
                ref={referenceInputRef}
                id="payment-reference"
                value={paymentReference}
                onChange={(e) => handleReferenceChange(e.target.value)}
                disabled={submitting}
                placeholder="Número de transacción o comprobante"
                aria-invalid={referenceError ? 'true' : 'false'}
                aria-describedby={referenceError ? 'payment-reference-help payment-reference-error' : 'payment-reference-help'}
                className="break-words"
              />
              <p id="payment-reference-help" className="text-xs text-muted-foreground">
                Use la referencia real del comprobante cuando aplique.
              </p>
              {referenceError ? (
                <p id="payment-reference-error" className="text-sm text-destructive" role="alert">
                  {referenceError}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        <p className="text-xs text-muted-foreground">
          Cancelar la ventana de impresión no revierte el pago. Si necesita corregir una factura pagada, use el flujo de anulación autorizado.
        </p>

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button htmlType="button" className="sm:min-w-36" onClick={requestClose} disabled={submitting}>
            Dejar pendiente
          </Button>
          <Button
            htmlType="submit"
            type="primary"
            className="min-h-11 sm:min-w-56"
            disabled={submitting || needsAmount}
            aria-label={`Confirmar cobro de ${moneyLabel(balanceDue)} e imprimir`}
          >
            {submitting ? 'Cobrando...' : (
              <span className="inline-flex items-center gap-2">
                <Printer className="size-4" aria-hidden="true" />
                Cobrar {moneyLabel(balanceDue)} e imprimir
              </span>
            )}
          </Button>
        </div>
      </form>
    </Modal>
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
