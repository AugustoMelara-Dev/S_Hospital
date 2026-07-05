import { type FormEvent, type RefObject } from 'react';
import { AlertTriangle, ClipboardCheck } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  return (
    <Card className="border-operational-border">
      <CardHeader className="gap-2 border-b border-border">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded bg-muted text-secondary ring-1 ring-border">
            <ClipboardCheck data-icon aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <CardTitle>Cerrar caja</CardTitle>
            <CardDescription>Cierre auditado de la sesión actual</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <form onSubmit={onSubmit} className="flex flex-col gap-4" aria-busy={isSubmitting}>
          <FormField
            id="closing_amount"
            label="Monto contado (L.) *"
            hint="Cuente el efectivo físico en gaveta. No incluya tarjeta ni transferencia."
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

          {hasCashDifference ? (
            <Alert variant="warning" icon={<AlertTriangle data-icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}>
              <div>
                Hay una diferencia de <strong>{formatLempirasUI(difference)}</strong>. Se requerirá una nota explicativa al cerrar.
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
      </CardContent>
    </Card>
  );
}
