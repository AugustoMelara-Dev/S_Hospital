import { type FormEvent, type ReactNode, type RefObject } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AdminCallout, AdminField, AdminPanel, AdminPanelHeader, MoneyText } from '@/design-system/admin/components';
import { parseCents } from '@/lib/moneyCents';
import { formatCashCents } from '../cashMoney';
import { LINK_INLINE, PRIMARY_BUTTON, TEXTAREA_CLASS } from '../cashUi';

type CashClosingPanelProps = {
  canCloseCash: boolean;
  canViewInvoices?: boolean;
  cashSessionId: number;
  closingAmount: string;
  closingAmountReadOnly?: boolean;
  closingAmountError: string | null;
  closingAmountRef: RefObject<HTMLInputElement | null>;
  closingNotes: string;
  differenceCents: number | null;
  hasCashDifference: boolean;
  hasPendingBalance: boolean;
  missingInstitutionalReceiptCount: number;
  isSubmitting: boolean;
  onClosingAmountChange: (value: string) => void;
  onClosingNotesChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  pendingAmount: string | null;
  pendingInvoiceCount: number;
  /** El arqueo declaró explícitamente "sin efectivo": 0 confirmado ≠ no contado. */
  zeroCountConfirmed?: boolean;
};

/**
 * Cierre del turno: un solo conteo a confirmar, la diferencia calculada contra
 * el efectivo esperado y, cuando existe diferencia, el motivo obligatorio.
 * Los bloqueos de cobros/recibos se resuelven antes de habilitar el cierre.
 */
export function CashClosingPanel({
  canCloseCash,
  canViewInvoices = false,
  cashSessionId,
  closingAmount,
  closingAmountReadOnly = false,
  closingAmountError,
  closingAmountRef,
  closingNotes,
  differenceCents,
  hasCashDifference,
  hasPendingBalance,
  missingInstitutionalReceiptCount,
  isSubmitting,
  onClosingAmountChange,
  onClosingNotesChange,
  onSubmit,
  pendingAmount,
  pendingInvoiceCount,
  zeroCountConfirmed = false,
}: CashClosingPanelProps) {
  const liveDifferenceLabel =
    differenceCents === null
      ? 'Ingrese monto contado'
      : differenceCents === 0
        ? 'Sin diferencia'
        : formatCashCents(differenceCents);
  const differenceDescription = zeroCountConfirmed
    ? 'Conteo en cero confirmado: la gaveta se declara sin efectivo.'
    : differenceCents === null
      ? 'Conteo pendiente'
      : differenceCents === 0
        ? 'Sin diferencia'
        : differenceCents > 0
          ? 'Sobrante frente al efectivo esperado'
          : 'Faltante frente al efectivo esperado';

  return (
    <AdminPanel as="section" aria-labelledby="cash-close-title" className="overflow-hidden">
      <AdminPanelHeader
        id="cash-close-title"
        title="Cerrar el turno"
        description="Confirme el conteo y la diferencia. Una diferencia exige el motivo auditado antes de cerrar."
      />

      <form onSubmit={onSubmit} className="grid gap-4 px-4 py-4 sm:px-5" aria-busy={isSubmitting}>
        <div className="grid gap-4 md:grid-cols-2">
          <AdminField
            htmlFor="closing_amount"
            label="Monto contado (L.)"
            required
            error={closingAmountError ?? undefined}
            hint={
              closingAmountReadOnly
                ? zeroCountConfirmed
                  ? 'Conteo en cero confirmado en el arqueo. Regrese a Arqueo para corregirlo.'
                  : 'Monto calculado desde el arqueo por denominaciones. Regrese a Arqueo para corregir el conteo.'
                : 'Cuente el efectivo físico en gaveta. No incluya tarjeta ni transferencia.'
            }
          >
            <input
              ref={(control) => { closingAmountRef.current = control; }}
              id="closing_amount"
              name="closing_amount"
              type="text"
              inputMode="decimal"
              value={closingAmount}
              onChange={(event) => onClosingAmountChange(event.target.value)}
              placeholder="0.00"
              autoComplete="off"
              disabled={isSubmitting}
              readOnly={closingAmountReadOnly}
              aria-invalid={Boolean(closingAmountError)}
              className={`h-[var(--ui-control-h-operational)] w-full rounded-[var(--ui-radius-control)] border border-[var(--ui-line-strong)] bg-[var(--ui-surface)] px-2.5 text-[length:var(--ui-text-lg)] font-semibold tabular-nums text-[color:var(--ui-ink)] placeholder:text-[color:var(--ui-ink-soft)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)] disabled:cursor-not-allowed disabled:opacity-55 read-only:bg-[var(--ui-surface-alt)]`}
            />
          </AdminField>

          <div className="rounded-[var(--ui-radius-control)] border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] px-4 py-3">
            <p className="text-[length:var(--ui-text-xs)] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-ink-soft)]">
              Diferencia
            </p>
            <output
              aria-live="polite"
              aria-label="Diferencia en vivo"
              aria-describedby="cash-closing-difference-description"
              className="mt-1.5 block text-[length:var(--ui-text-xl)] font-semibold tabular-nums text-[color:var(--ui-ink)]"
            >
              {liveDifferenceLabel}
            </output>
            <p id="cash-closing-difference-description" className="mt-1 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
              {differenceDescription}
            </p>
          </div>
        </div>

        {hasCashDifference ? (
          <AdminCallout tone="warn" title="Diferencia detectada">
            <span className="flex items-start gap-2">
              <TriangleAlertIcon aria-hidden="true" data-icon className="mt-0.5 size-4 shrink-0" />
              <span>Hay una diferencia de <strong>{formatCashCents(differenceCents)}</strong> frente al efectivo esperado. Explique el motivo para dejar el cierre auditado.</span>
            </span>
          </AdminCallout>
        ) : null}

        {hasPendingBalance || missingInstitutionalReceiptCount > 0 ? (
          <ul aria-label="Bloqueos del cierre" className="divide-y divide-[var(--ui-line)] rounded-[var(--ui-radius-control)] border border-[var(--ui-line-strong)] bg-[var(--ui-surface-alt)]">
            {hasPendingBalance ? (
              <ClosingBlocker
                canViewInvoices={canViewInvoices}
                resolutionHref={`/recibos?balance_state=pending&reconciliation_cash_session_id=${cashSessionId}`}
              >
                <strong>{pendingInvoiceCount}</strong> {pendingInvoiceCount === 1 ? 'factura pendiente o parcial' : 'facturas pendientes o parciales'} por{' '}
                <strong><MoneyText cents={parseCents(pendingAmount)} /></strong>. Revise los cobros antes de cerrar.
              </ClosingBlocker>
            ) : null}
            {missingInstitutionalReceiptCount > 0 ? (
              <ClosingBlocker
                canViewInvoices={canViewInvoices}
                resolutionHref={`/recibos?receipt_state=missing&reconciliation_cash_session_id=${cashSessionId}`}
              >
                <strong>{missingInstitutionalReceiptCount}</strong>{' '}
                {missingInstitutionalReceiptCount === 1 ? 'recibo institucional pendiente' : 'recibos institucionales pendientes'}.
              </ClosingBlocker>
            ) : null}
          </ul>
        ) : null}

        <AdminField
          htmlFor="closing_notes"
          label="Nota de cierre"
          required={hasCashDifference}
          hint={hasCashDifference ? 'Nota obligatoria: explique el faltante o sobrante antes de confirmar.' : 'Opcional cuando el conteo coincide.'}
        >
          <textarea
            id="closing_notes"
            name="closing_notes"
            value={closingNotes}
            onChange={(event) => onClosingNotesChange(event.target.value)}
            placeholder={hasCashDifference ? 'Obligatoria si hay diferencia (sobrante/faltante).' : 'Nota opcional...'}
            rows={2}
            disabled={isSubmitting}
            className={TEXTAREA_CLASS}
          />
        </AdminField>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            data-ui-press
            className={`${PRIMARY_BUTTON} min-h-11`}
            disabled={isSubmitting || !canCloseCash || hasPendingBalance || missingInstitutionalReceiptCount > 0}
          >
            {isSubmitting ? 'Cerrando...' : 'Cerrar caja'}
          </button>
          {!canCloseCash ? (
            <p className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
              Solo usuarios con permiso de cierre pueden cerrar caja.
            </p>
          ) : null}
        </div>
      </form>
    </AdminPanel>
  );
}

function ClosingBlocker({
  canViewInvoices,
  children,
  resolutionHref,
}: {
  canViewInvoices: boolean;
  children: ReactNode;
  resolutionHref: string;
}) {
  return (
    <li className="flex flex-col gap-2 px-3 py-3 text-[length:var(--ui-text-sm)] sm:flex-row sm:items-center sm:justify-between">
      <span className="flex min-w-0 items-start gap-2">
        <TriangleAlertIcon aria-hidden="true" data-icon className="mt-0.5 size-4 shrink-0 text-[color:var(--ui-warn)]" />
        <span>{children}</span>
      </span>
      {canViewInvoices ? (
        <Link className={`shrink-0 ${LINK_INLINE}`} to={resolutionHref}>
          Resolver en Recibos
        </Link>
      ) : (
        <span className="shrink-0 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Solicite acceso al Historial</span>
      )}
    </li>
  );
}
