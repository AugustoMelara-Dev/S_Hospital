import { type FormEvent, type RefObject } from 'react';
import { AlertTriangle, ClipboardCheck } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatLempirasUI } from '@/lib/money';

type CashClosingPanelProps = {
  canCloseCash: boolean;
  closingAmount: string;
  closingAmountError: string | null;
  closingAmountRef: RefObject<HTMLInputElement | null>;
  closingNotes: string;
  difference: number | null;
  hasCashDifference: boolean;
  hasPendingBalance: boolean;
  isSubmitting: boolean;
  onClosingAmountChange: (value: string) => void;
  onClosingNotesChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  pendingAmount: string;
  pendingInvoiceCount: number;
};

export function CashClosingPanel({
  canCloseCash,
  closingAmount,
  closingAmountError,
  closingAmountRef,
  closingNotes,
  difference,
  hasCashDifference,
  hasPendingBalance,
  isSubmitting,
  onClosingAmountChange,
  onClosingNotesChange,
  onSubmit,
  pendingAmount,
  pendingInvoiceCount,
}: CashClosingPanelProps) {
  const liveDifferenceLabel =
    difference === null
      ? 'Ingrese monto contado'
      : difference === 0
        ? 'Sin diferencia'
        : formatLempirasUI(difference);

  return (
    <section
      aria-labelledby="cash-close-guided-title"
      className="rounded-md border border-border bg-background p-4"
    >
      <div className="border-b border-border pb-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded bg-muted text-secondary ring-1 ring-border">
            <ClipboardCheck data-icon aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 id="cash-close-guided-title" className="text-lg font-semibold leading-tight">
              Cierre guiado
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cuente efectivo, revise diferencia y confirme.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4 pt-5" aria-busy={isSubmitting}>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(13rem,0.45fr)]">
          <FormField
            id="closing_amount"
            label="Monto contado (L.) *"
            hint="Cuente el efectivo fisico en gaveta. No incluya tarjeta ni transferencia."
            error={closingAmountError ?? undefined}
          >
            {({ id, describedBy, invalid }) => (
              <Input
                ref={closingAmountRef}
                id={id}
                name="closing_amount"
                type="text"
                inputMode="decimal"
                value={closingAmount}
                onChange={(event) => onClosingAmountChange(event.target.value)}
                placeholder="0.00"
                autoComplete="off"
                disabled={isSubmitting}
                className="font-mono text-lg tabular-nums"
                aria-invalid={invalid}
                aria-describedby={describedBy}
              />
            )}
          </FormField>

          <div className="rounded-md border border-border bg-card p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Diferencia
            </p>
            <output
              aria-live="polite"
              aria-label="Diferencia en vivo"
              className="mt-2 block text-lg font-semibold tabular-nums text-foreground"
            >
              {liveDifferenceLabel}
            </output>
          </div>
        </div>

        {hasCashDifference ? (
          <Alert variant="warning" icon={<AlertTriangle data-icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}>
            <div>
              Hay una diferencia de <strong>{formatLempirasUI(difference)}</strong>. Se requerira una nota explicativa al cerrar.
            </div>
          </Alert>
        ) : null}

        {hasPendingBalance ? (
          <Alert variant="warning" icon={<AlertTriangle data-icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}>
            <div>
              Hay <strong>{pendingInvoiceCount}</strong> factura(s) pendientes o parciales por{' '}
              <strong>{formatLempirasUI(pendingAmount)}</strong>. Revise los cobros antes de cerrar.
            </div>
          </Alert>
        ) : null}

        <FormField id="closing_notes" label="Nota de cierre">
          {({ id }) => (
            <Textarea
              id={id}
              name="closing_notes"
              value={closingNotes}
              onChange={(event) => onClosingNotesChange(event.target.value)}
              placeholder={hasCashDifference ? 'Obligatoria si hay diferencia (sobrante/faltante).' : 'Nota opcional...'}
              rows={2}
              disabled={isSubmitting}
            />
          )}
        </FormField>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="submit"
            variant="default"
            disabled={isSubmitting || !canCloseCash || hasPendingBalance}
          >
            {isSubmitting ? 'Cerrando...' : 'Cerrar caja'}
          </Button>
          {!canCloseCash ? (
            <p className="text-sm text-muted-foreground">
              Solo usuarios con permiso de cierre pueden cerrar caja.
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}
