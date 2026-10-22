import { BanknoteIcon as Banknote, CheckCircle2Icon, ReceiptTextIcon as ReceiptText } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { AdminCallout, AdminDialog, MoneyText } from '@/design-system/admin/components';
import { cn } from '@/lib/utils';
import type { Payment } from '../../../lib/api';
import { formatLempirasUIFromCents, parseCents, toExchangeDecimal } from '../../../lib/moneyCents';
const FOCUS_RING = 'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]';
const INPUT_CLASS = `h-11 w-full rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-3 text-[length:var(--ui-text-base)] text-[color:var(--ui-ink)] placeholder:text-[color:var(--ui-ink-soft)] ${FOCUS_RING}`;
const PRIMARY_BUTTON = `inline-flex h-11 items-center justify-center gap-2 rounded-[var(--ui-radius-control)] bg-[var(--ui-action)] px-4 text-[length:var(--ui-text-base)] font-semibold text-[color:var(--ui-action-foreground)] transition-[background-color,transform] duration-[140ms] ease-out enabled:hover:bg-[var(--ui-action-hover)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;
const SECONDARY_BUTTON = `inline-flex h-11 items-center justify-center gap-2 rounded-[var(--ui-radius-control)] border border-[var(--ui-line-strong)] bg-[var(--ui-surface)] px-3 text-[length:var(--ui-text-base)] font-medium text-[color:var(--ui-ink)] transition-[background-color,transform] duration-[140ms] ease-out enabled:hover:bg-[var(--ui-surface-alt)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;
const METRIC_LABEL = 'text-[length:var(--ui-text-xs)] font-semibold uppercase tracking-[0.06em] text-[color:var(--ui-ink-soft)]';

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
  errorMessage?: string | null;
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

const methodTileClass =
  `inline-flex min-h-11 items-center justify-center rounded-[var(--ui-radius-control)] border px-2 text-[length:var(--ui-text-base)] font-medium transition-[background-color,border-color,color,transform] duration-[140ms] ease-out enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

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
  errorMessage,
}: PaymentModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const referenceInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const submitLockRef = useRef(false);

  const balanceCents = parseCents(balanceDue);
  const paymentCents = parseCents(paymentAmount);
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
  const isPartialPayment = partialPaymentsEnabled
    && appliedAmountCents !== null
    && appliedAmountCents > 0
    && balanceCents !== null
    && appliedAmountCents < balanceCents;
  const actionAmountLabel = moneyLabelFromCents(appliedAmountCents);
  const actionLabel = errorMessage
    ? isPartialPayment ? 'Reintentar abono' : 'Reintentar cobro'
    : isPartialPayment ? 'Registrar abono' : 'Confirmar cobro';
  const visibleActionLabel = errorMessage || isPartialPayment
    ? `${actionLabel} ${actionAmountLabel}`
    : `Cobrar ${actionAmountLabel}`;
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
    onPaymentAmountChange(toExchangeDecimal(cents));
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

    const amountCents = cashCanReturnChange ? parseCents(paymentAmount) : balanceCents;
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
    onConfirm(toExchangeDecimal(appliedAmountCents ?? amountCents));
  }

  /**
   * El cobro es irreversible. Un Enter suelto en un campo no puede disparar el
   * envío implícito del formulario; solo Ctrl/Cmd+Enter confirma. Los botones
   * conservan su activación nativa con Enter/Espacio porque son interactivos.
   */
  function handleFieldKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') {
      return;
    }

    e.preventDefault();
    if ((e.ctrlKey || e.metaKey) && !submitting) {
      formRef.current?.requestSubmit();
    }
  }

  function requestClose() {
    if (!submitting) {
      onOpenChange(false);
    }
  }

  return (
    <AdminDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) requestClose();
      }}
      closeDisabled={Boolean(submitting)}
      title="Registrar pago"
      description={`Factura ${invoiceNumber} ya fue emitida. Si sale de este paso quedará pendiente de cobro.`}
      className="sm:max-w-3xl"
      footer={
        <>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            onClick={requestClose}
            disabled={submitting}
          >
            Dejar pendiente
          </button>
          <button
            type="submit"
            form="payment-form"
            className={PRIMARY_BUTTON}
            disabled={submitting || needsAmount}
            aria-label={`${actionLabel} de ${actionAmountLabel}`}
          >
            {submitting ? 'Cobrando…' : (
              <>
                <CheckCircle2Icon className="size-4" aria-hidden="true" strokeWidth={2} />
                {visibleActionLabel}
              </>
            )}
          </button>
        </>
      }
    >
      <form
        id="payment-form"
        ref={formRef}
        aria-busy={submitting ? 'true' : undefined}
        onSubmit={handleSubmit}
        className="flex min-w-0 flex-col gap-5"
      >
        {submitting ? <p role="status" className="sr-only">Registrando cobro…</p> : null}

        <section
          aria-label="Resumen de factura"
          data-ui-surface="invoice-summary"
          className="border-b border-[var(--ui-line)] bg-[var(--ui-surface-alt)] px-4 py-4"
        >
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <p className={cn(METRIC_LABEL, 'flex items-center gap-2')}>
                <ReceiptText className="size-3.5" aria-hidden="true" strokeWidth={2} />
                Factura
              </p>
              <p className="mt-1 break-words font-semibold tabular-nums text-[color:var(--ui-ink)]">{invoiceNumber}</p>
            </div>
            <div className="min-w-0 sm:text-right">
              <p className={METRIC_LABEL}>Paciente</p>
              <p className="mt-1 break-words font-medium text-[color:var(--ui-ink)]">{patientLabel}</p>
            </div>
          </div>

          <section
            aria-label="Resumen del cobro"
            data-summary-columns={String(summaryColumnCount)}
            className={cn(
              'mt-4 grid divide-x divide-[var(--ui-line)] border-y border-[var(--ui-line)] bg-[var(--ui-surface)]',
              summaryColumnCount === 4 ? 'grid-cols-2 sm:grid-cols-4' : summaryColumnCount === 3 ? 'grid-cols-3' : 'grid-cols-2',
            )}
          >
            <div className="p-3">
              <span className={cn(METRIC_LABEL, 'block')}>Total</span>
              <MoneyText as="p" cents={parseCents(total)} emphasis="total" className="mt-1" />
            </div>
            <div className="p-3">
              <span className={cn(METRIC_LABEL, 'block')}>
                {isPartialPayment ? 'Abono aplicado' : cashCanReturnChange ? 'Recibido' : 'A cobrar'}
              </span>
              <MoneyText as="p" cents={effectivePaymentCents} emphasis="strong" className="mt-1" />
            </div>
            {cashCanReturnChange ? (
              <div className="p-3">
                <span className={cn(METRIC_LABEL, 'block')}>Cambio</span>
                <MoneyText as="p" cents={changeCents} emphasis="strong" className="mt-1" />
              </div>
            ) : null}
            {remainingBalanceCents !== null ? (
              <div className="p-3">
                <span className={cn(METRIC_LABEL, 'block')}>Saldo después del pago</span>
                <MoneyText as="p" cents={remainingBalanceCents} emphasis="strong" className="mt-1 text-[color:var(--ui-warn)]" />
              </div>
            ) : null}
          </section>
        </section>

        {errorMessage ? (
          <AdminCallout tone="error" title="No se completó el cobro">
            {errorMessage} Revise los datos y vuelva a intentar.
          </AdminCallout>
        ) : null}
        {needsAmount && !error ? <AdminCallout tone="info">Ingrese el monto recibido para registrar el cobro.</AdminCallout> : null}
        {remainingBalanceCents !== null && !partialPaymentsEnabled ? <AdminCallout tone="error">El monto recibido es menor al total.</AdminCallout> : null}
        {remainingBalanceCents !== null && partialPaymentsEnabled ? <AdminCallout tone="warn">Este pago quedará como abono parcial y mantendrá saldo pendiente.</AdminCallout> : null}
        {submitting ? <AdminCallout tone="info">Registrando cobro, no repita la operación.</AdminCallout> : null}

        <section aria-label="Datos del pago" className="grid gap-4">
          <fieldset className="grid gap-2">
            <legend className="text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">Método de pago</legend>
            <div
              role="radiogroup"
              aria-label="Método de pago"
              aria-describedby="payment-method-help"
              tabIndex={-1}
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              onKeyDown={handlePaymentMethodKeyDown}
            >
              {paymentMethods.map((method) => {
                const selected = paymentMethod === method.value;
                return (
                  <button
                    key={method.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={method.label}
                    tabIndex={selected ? 0 : -1}
                    className={cn(
                      methodTileClass,
                      selected
                        ? 'border-[var(--ui-action)] bg-[var(--ui-action)] text-[color:var(--ui-action-foreground)]'
                        : 'border-[var(--ui-line-strong)] bg-[var(--ui-surface)] text-[color:var(--ui-ink)] enabled:hover:bg-[var(--ui-surface-alt)]',
                    )}
                    disabled={submitting}
                    onClick={() => handlePaymentMethodChange(method.value)}
                  >
                    {method.label}
                  </button>
                );
              })}
            </div>
            <p id="payment-method-help" className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
              {methodHelp[paymentMethod]}
            </p>
          </fieldset>

          {cashCanReturnChange ? (
            <div className="grid gap-2 border-t border-[var(--ui-line)] pt-4">
              <label htmlFor="payment-amount" className="text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">
                Monto recibido (L.)
              </label>
              <div className="relative">
                <Banknote className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--ui-ink-soft)]" aria-hidden="true" />
                <input
                  ref={amountInputRef}
                  id="payment-amount"
                  type="text"
                  inputMode="decimal"
                  value={paymentAmount}
                  onChange={(event) => handleAmountChange(event.target.value)}
                  onKeyDown={handleFieldKeyDown}
                  placeholder="0.00"
                  disabled={submitting}
                  aria-invalid={error ? 'true' : 'false'}
                  aria-describedby={amountDescribedBy || undefined}
                  className={cn(INPUT_CLASS, 'pl-10 text-[length:var(--ui-text-lg)] font-semibold tabular-nums')}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Montos rápidos de efectivo">
                <button type="button" className={SECONDARY_BUTTON} disabled={submitting} onClick={() => applyCashPreset(balanceCents ?? 0)}>Exacto</button>
                {[100, 200, 500].map((amount) => (
                  <button key={amount} type="button" className={SECONDARY_BUTTON} disabled={submitting} onClick={() => applyCashPreset(amount * 100)}>
                    L {amount}
                  </button>
                ))}
              </div>
              <p id="payment-amount-help" className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
                Use hasta dos decimales. Se registrará el monto aplicado a la factura.
              </p>
              {error ? <p id="payment-amount-error" className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-danger)]" role="alert">{error}</p> : null}
            </div>
          ) : null}

          {requiresReference ? (
            <div className="grid gap-2 border-t border-[var(--ui-line)] pt-4">
              <label htmlFor="payment-reference" className="text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">
                Referencia de pago
              </label>
              <input
                ref={referenceInputRef}
                id="payment-reference"
                value={paymentReference}
                onChange={(event) => handleReferenceChange(event.target.value)}
                onKeyDown={handleFieldKeyDown}
                disabled={submitting}
                placeholder="Número de transacción o comprobante"
                aria-invalid={referenceError ? 'true' : 'false'}
                aria-describedby={referenceError ? 'payment-reference-help payment-reference-error' : 'payment-reference-help'}
                className={INPUT_CLASS}
              />
              <p id="payment-reference-help" className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Use la referencia real del comprobante.</p>
              {referenceError ? <p id="payment-reference-error" className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-danger)]" role="alert">{referenceError}</p> : null}
            </div>
          ) : null}
        </section>

        <p className="border-t border-[var(--ui-line)] pt-3 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
          El cobro se registra una sola vez. Ver, guardar o imprimir el recibo son acciones posteriores.
        </p>
      </form>
    </AdminDialog>
  );
}

function moneyLabelFromCents(cents: number | null | undefined): string {
  return formatLempirasUIFromCents(cents) ?? 'No disponible';
}
