import { useState } from 'react';
import { AdminDialog, AdminField, FreeMedicationBadge, MoneyText } from '@/design-system/admin/components';
import { asCents, formatLempirasUIFromCents, parseCents, toExchangeDecimal } from '@/lib/moneyCents';
import type { InvoicePreview, Payment } from '@/lib/api';
import type { CobrarStatus } from '../state/status';
import type { CobrarLine } from '../state/types';
import { INPUT_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from './cobrarUi';

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: CobrarStatus;
  patientName: string;
  lines: CobrarLine[];
  preview: InvoicePreview | null;
  previewMatchesRevision: boolean;
  method: Payment['method'];
  onMethodChange: (method: Payment['method']) => void;
  reference: string;
  onReferenceChange: (reference: string) => void;
  onConfirm: () => void;
  submitting: boolean;
};

const PAYMENT_METHODS: Array<{ value: Payment['method']; label: string }> = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'other', label: 'Otro' },
];

/**
 * Confirmación deliberada e idempotente de cobro / liquidación.
 *
 * Soporte de métodos:
 * - Efectivo: cálculo exacto de cambio a entregar y monto recibido con moneda lempiras.
 * - Tarjeta / Transferencia: registro de número de referencia o autorización.
 * - Emisión sin cobro autorizada: no solicita pago, valida autorización por regla médica.
 *
 * Enter en cualquier campo de texto no cobra; solo el botón explícito de confirmación.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  status,
  patientName,
  lines,
  preview,
  previewMatchesRevision,
  method,
  onMethodChange,
  reference,
  onReferenceChange,
  onConfirm,
  submitting,
}: ConfirmDialogProps) {
  const isZero = status.confirmKind === 'zero';
  const totalLabel = status.totalCents !== null ? formatLempirasUIFromCents(status.totalCents) : null;
  const totalCents = status.totalCents ?? 0;

  const [cashTendered, setCashTendered] = useState<string>('');
  const tenderedCents = parseCents(cashTendered);
  const changeCents = tenderedCents !== null && tenderedCents >= totalCents ? tenderedCents - totalCents : 0;
  const isUnderpaid = tenderedCents !== null && tenderedCents < totalCents;

  function handleSetExactCash() {
    if (status.totalCents !== null) {
      setCashTendered(toExchangeDecimal(status.totalCents));
    }
  }

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      closeDisabled={submitting}
      title={isZero ? 'Confirmar emisión sin cobro' : 'Confirmar cobro'}
      description="Revise la cuenta valorada antes de registrar la operación."
      className="sm:max-w-3xl"
      footer={
        <>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            onClick={onConfirm}
            disabled={!status.canConfirm || submitting || (method === 'cash' && isUnderpaid)}
            data-testid="cobrar-confirm"
          >
            {submitting ? 'Emitiendo…' : isZero ? 'Emitir sin cobro' : `Cobrar${totalLabel ? ` · ${totalLabel}` : ''}`}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Cabecera de revisión de la operación */}
        <div className="grid gap-4 border-b border-[var(--ui-line)] pb-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0">
            <p className="text-[length:var(--ui-text-xs)] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-ink-soft)]">
              Paciente
            </p>
            <p className="mt-0.5 text-[length:var(--ui-text-lg)] font-semibold text-[color:var(--ui-ink)] [overflow-wrap:anywhere]">
              {patientName.trim() || '—'}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[length:var(--ui-text-xs)] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-ink-soft)]">
              {isZero ? 'Emisión sin cobro' : 'Total a cobrar'}
            </p>
            <MoneyText cents={status.totalCents} emphasis="total" className="mt-0.5" />
          </div>
        </div>

        {/* Detalle de líneas de la cuenta */}
        <section aria-labelledby="cobrar-review-lines-title">
          <h3 id="cobrar-review-lines-title" className="mb-2 text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">
            Conceptos de la cuenta
          </h3>
        <ul aria-label="Líneas por emitir" className="max-h-52 divide-y divide-[var(--ui-line)] overflow-y-auto border-y border-[var(--ui-line)]">
          {lines.map((line, index) => {
            const item = previewMatchesRevision
              ? preview?.items.find((current) => current.service_id === line.service.id)
              : null;

            return (
            <li key={`${line.service.id}-${index}`} className="flex flex-col gap-1 px-1 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 font-medium [overflow-wrap:anywhere]">{line.service.name}</span>
                <MoneyText cents={item?.line_total_cents ?? null} emphasis="strong" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
                <span>
                  Cantidad {line.quantity} · P. unitario{' '}
                  <MoneyText cents={item?.unit_price_registered_cents ?? parseCents(line.service.price)} />
                </span>
                {item?.special_rule_applied ? (
                  <FreeMedicationBadge label="Sin cobro por receta de diálisis" />
                ) : null}
              </div>
            </li>
            );
          })}
        </ul>
        </section>

        {/* Desglose validado por el servidor */}
        {previewMatchesRevision && preview ? (
          <dl className="ml-auto grid w-full max-w-sm grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-1 text-[length:var(--ui-text-sm)]">
            <dt className="text-[color:var(--ui-ink-soft)]">Subtotal</dt>
            <dd className="text-right">
              <MoneyText cents={preview.totals.subtotal_cents} />
            </dd>
            <dt className="text-[color:var(--ui-ink-soft)]">Exento</dt>
            <dd className="text-right">
              <MoneyText cents={preview.totals.exempt_cents} />
            </dd>
            <dt className="text-[color:var(--ui-ink-soft)]">
              ISV{preview.tax.rate ? ` (${preview.tax.rate}%)` : ''}
            </dt>
            <dd className="text-right">
              <MoneyText cents={preview.totals.tax_cents} />
            </dd>
            <dt className="border-t border-[var(--ui-line)] pt-1 font-semibold">Total</dt>
            <dd className="border-t border-[var(--ui-line)] pt-1 text-right">
              <MoneyText cents={status.totalCents} emphasis="strong" />
            </dd>
          </dl>
        ) : null}

        {/* Selección y configuración de método de pago */}
        {!isZero ? (
          <fieldset className="flex flex-col gap-4 border-t border-[var(--ui-line)] pt-4">
            <legend className="text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]">
              Método de pago
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PAYMENT_METHODS.map((option) => (
                <label
                  key={option.value}
                  className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--ui-radius-control)] border border-[var(--ui-line-strong)] px-3 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink)] transition-[background-color,border-color,color,transform] duration-[140ms] ease-out hover:bg-[var(--ui-surface-alt)] active:scale-[0.96] has-[:checked]:border-[var(--ui-action)] has-[:checked]:bg-[var(--ui-action)] has-[:checked]:font-semibold has-[:checked]:text-[color:var(--ui-action-foreground)] motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  <input
                    type="radio"
                    name="cobrar-payment-method"
                    value={option.value}
                    checked={method === option.value}
                    onChange={() => onMethodChange(option.value)}
                    className="size-4 shrink-0 accent-[var(--ui-action)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]"
                  />
                  {option.label}
                </label>
              ))}
            </div>

            {/* Cálculo de cambio para efectivo */}
            {method === 'cash' ? (
              <div className="grid gap-3 border-y border-[var(--ui-line)] py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="contents">
                  <div className="flex-1 min-w-[12rem]">
                    <AdminField
                      htmlFor="cobrar-cash-tendered"
                      label="Efectivo recibido"
                      hint="Ingrese la cantidad entregada por el paciente"
                    >
                      <input
                        id="cobrar-cash-tendered"
                        type="text"
                        inputMode="decimal"
                        value={cashTendered}
                        onChange={(event) => setCashTendered(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') event.preventDefault();
                        }}
                        placeholder={totalLabel ? totalLabel.replace('L. ', '') : '0.00'}
                        className={INPUT_CLASS}
                        aria-label="Efectivo recibido"
                      />
                    </AdminField>
                  </div>
                  <button
                    type="button"
                    onClick={handleSetExactCash}
                    className={SECONDARY_BUTTON}
                  >
                    Monto exacto
                  </button>
                </div>

                <div className="flex items-center justify-between text-[length:var(--ui-text-sm)] sm:col-span-2">
                  <span className="font-medium text-[color:var(--ui-ink)]">Cambio a entregar:</span>
                  <MoneyText
                    cents={asCents(changeCents)}
                    emphasis="strong"
                    className="text-[length:var(--ui-text-base)] text-[color:var(--ui-action)]"
                  />
                </div>

                {isUnderpaid ? (
                  <p role="alert" className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-danger)]">
                    El monto recibido es menor que el total a cobrar.
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* Referencia (opcional para efectivo, relevante para transferencia y tarjeta) */}
            <AdminField
              htmlFor="cobrar-payment-reference"
              label="Referencia (opcional)"
              className="mt-1"
            >
              <input
                id="cobrar-payment-reference"
                type="text"
                value={reference}
                onChange={(event) => onReferenceChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.preventDefault();
                }}
                className={INPUT_CLASS}
                placeholder={method === 'cash' ? 'Recibo manual o nota de caja' : 'N.º de transferencia o autorización'}
              />
            </AdminField>
          </fieldset>
        ) : (
          <p className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
            El total confirmado es {totalLabel ?? 'L 0.00'}. No se registrará pago.
          </p>
        )}

        {status.detail ? (
          <p
            role="alert"
            className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-warn)]"
          >
            {status.detail}
          </p>
        ) : null}
      </div>
    </AdminDialog>
  );
}
