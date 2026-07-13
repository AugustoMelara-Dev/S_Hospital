import { type FormEvent, type RefObject } from 'react';
import { AuditOutlined, WarningOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input } from 'antd';
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
  missingInstitutionalReceiptCount: number;
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
  missingInstitutionalReceiptCount,
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
  const differenceDescription = difference === null
    ? 'Conteo pendiente'
    : difference === 0
      ? 'Sin diferencia'
      : difference > 0
        ? 'Sobrante frente al efectivo esperado'
        : 'Faltante frente al efectivo esperado';

  return (
    <section
      aria-labelledby="cash-close-guided-title"
      className="overflow-hidden border border-operational-border bg-operational-surface "
    >
      <div className="border-b border-border bg-muted/40 px-5 pb-5 pt-6 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center bg-primary text-primary-foreground ">
            <AuditOutlined aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="cash-close-guided-title" className="text-lg font-semibold leading-tight">
              Cierre guiado
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cuente el efectivo, revise la diferencia y confirme el cierre auditado.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-5 px-5 pb-6 pt-5 sm:px-6" aria-busy={isSubmitting}>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(13rem,0.45fr)]">
          <Form.Item label="Monto contado (L.)" htmlFor="closing_amount" required validateStatus={closingAmountError ? 'error' : undefined} help={closingAmountError ?? 'Cuente el efectivo físico en gaveta. No incluya tarjeta ni transferencia.'}>
              <Input
                ref={(control) => { closingAmountRef.current = control?.input ?? null; }}
                id="closing_amount"
                name="closing_amount"
                type="text"
                inputMode="decimal"
                value={closingAmount}
                onChange={(event) => onClosingAmountChange(event.target.value)}
                placeholder="0.00"
                autoComplete="off"
                disabled={isSubmitting}
                className="min-h-11 font-mono text-lg tabular-nums"
                aria-invalid={Boolean(closingAmountError)}
              />
          </Form.Item>

          <div className="border border-secondary/25 bg-accent/35 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Diferencia
            </p>
            <output
              aria-live="polite"
              aria-label="Diferencia en vivo"
              aria-describedby="cash-closing-difference-description"
              className="mt-2 block text-lg font-semibold tabular-nums text-foreground"
            >
              {liveDifferenceLabel}
            </output>
            <p id="cash-closing-difference-description" className="mt-1 text-xs text-muted-foreground">
              {differenceDescription}
            </p>
          </div>
        </div>

        {hasCashDifference ? (
          <Alert type="warning" showIcon icon={<WarningOutlined />} description={<div>
              Hay una diferencia de <strong>{formatLempirasUI(difference)}</strong>. La nota de cierre es obligatoria para dejar el motivo auditado.
            </div>} />
        ) : null}

        {hasPendingBalance ? (
          <Alert type="warning" showIcon icon={<WarningOutlined />} description={<div>
              Hay <strong>{pendingInvoiceCount}</strong> factura(s) pendientes o parciales por{' '}
              <strong>{formatLempirasUI(pendingAmount)}</strong>. Revise los cobros antes de cerrar.
            </div>} />
        ) : null}

        {missingInstitutionalReceiptCount > 0 ? (
          <Alert type="warning" showIcon icon={<WarningOutlined />} description={<div>
              Hay <strong>{missingInstitutionalReceiptCount}</strong> recibo(s) institucional(es) pendiente(s). Genere los recibos antes de cerrar.
            </div>} />
        ) : null}

        <Form.Item label={hasCashDifference ? 'Nota de cierre *' : 'Nota de cierre'} htmlFor="closing_notes" help={hasCashDifference ? 'Nota obligatoria: explique el faltante o sobrante antes de confirmar.' : 'Opcional cuando el conteo coincide.'}>
            <Input.TextArea
              id="closing_notes"
              name="closing_notes"
              value={closingNotes}
              onChange={(event) => onClosingNotesChange(event.target.value)}
              placeholder={hasCashDifference ? 'Obligatoria si hay diferencia (sobrante/faltante).' : 'Nota opcional...'}
              rows={2}
              required={hasCashDifference}
              disabled={isSubmitting}
            />
        </Form.Item>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            htmlType="submit"
            type="primary"
            className="min-h-11"
            disabled={isSubmitting || !canCloseCash || hasPendingBalance || missingInstitutionalReceiptCount > 0}
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
