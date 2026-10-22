import { DownloadIcon, PrinterIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { AdminCallout, AdminDialog, AdminField, AdminPanel, MoneyText } from '@/design-system/admin/components';
import { parseCents } from '@/lib/moneyCents';
import { cn } from '@/lib/utils';
import { formatDateTimeEs } from '@/lib/format/formatDate';
import { formatSignedCashCents } from '../cashMoney';
import { downloadCloseSummaryCsv } from '../cashCloseSummary';
import type { CashClosingBreakdown } from '@/lib/api/types';
import { PRIMARY_BUTTON, SECONDARY_BUTTON, TEXTAREA_CLASS } from '../cashUi';

interface CloseSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: {
    id?: number;
    opening_amount: string | null;
    expected_cash_amount?: string | null;
    expected_amount?: string | null;
    payments_by_method?: { cash: string; transfer: string; card: string; other: string };
    pending_invoice_count?: number;
    pending_amount?: string | null;
    missing_institutional_receipt_count?: number;
    closed_at?: string | null;
    closing_breakdown?: CashClosingBreakdown | null;
  };
  closingAmount: string;
  closingNotes: string;
  differenceCents: number | null;
  isSubmitting: boolean;
  onClosingNotesChange: (value: string) => void;
  onConfirm: () => void;
}

const MIN_DIFFERENCE_NOTE_LENGTH = 5;

type CashCloseSummarySession = CloseSessionDialogProps['session'];

interface CashCloseSummaryPanelProps {
  session: CashCloseSummarySession;
  closingAmount: string | null;
  closingNotes: string;
  differenceCents: number | null;
}

const METHOD_LABELS = [
  { key: 'cash', label: 'Efectivo' },
  { key: 'transfer', label: 'Transferencia' },
  { key: 'card', label: 'Tarjeta' },
  { key: 'other', label: 'Otros' },
] as const;

function sessionCents(session: CashCloseSummarySession) {
  const methods = session.payments_by_method;

  return {
    opening: parseCents(session.opening_amount),
    expected: parseCents(session.expected_cash_amount ?? session.expected_amount ?? session.opening_amount),
    pending: parseCents(session.pending_amount),
    methods: {
      cash: methods ? parseCents(methods.cash) : null,
      transfer: methods ? parseCents(methods.transfer) : null,
      card: methods ? parseCents(methods.card) : null,
      other: methods ? parseCents(methods.other) : null,
    },
  };
}

export function CashCloseSummaryPanel({
  session,
  closingAmount,
  closingNotes,
  differenceCents,
}: CashCloseSummaryPanelProps) {
  const cents = sessionCents(session);
  const pendingInvoiceCount = session.pending_invoice_count ?? 0;
  const closedAtLabel = session.closed_at ? formatDateTimeEs(session.closed_at) : null;
  const closingAmountCents = parseCents(closingAmount);

  function exportCloseSummary() {
    downloadCloseSummaryCsv({
      cashSessionId: session.id,
      closedAt: session.closed_at,
      openingAmountCents: cents.opening,
      expectedAmountCents: cents.expected,
      methodsCents: cents.methods,
      pendingAmountCents: cents.pending,
      pendingInvoiceCount,
      closingAmountCents,
      differenceCents,
      closingNotes,
      closingBreakdown: session.closing_breakdown,
    });
  }

  function printCloseSummary() {
    const previousPrinting = document.body.dataset.printingCashClose;
    document.body.dataset.printingCashClose = 'true';

    try {
      window.print();
    } finally {
      if (previousPrinting) {
        document.body.dataset.printingCashClose = previousPrinting;
      } else {
        delete document.body.dataset.printingCashClose;
      }
    }
  }

  return (
    <div data-cash-close-print-root>
    <AdminPanel
      as="section"
      aria-labelledby="cash-close-confirmed-summary-title"
      className="border-l-4 border-l-[var(--ui-success)] p-5 text-[length:var(--ui-text-sm)]"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="cash-close-confirmed-summary-title" className="text-[length:var(--ui-text-md)] font-semibold text-[color:var(--ui-ink)]">
            Resumen de cierre confirmado
          </h2>
          <p className="mt-1 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
            Conserve este resumen para impresión o archivo del turno cerrado.
          </p>
        </div>
        <div className="print-hidden flex flex-wrap gap-2">
          <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={printCloseSummary}>
            <PrinterIcon aria-hidden="true" data-icon className="size-4" />
            Imprimir resumen
          </button>
          <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={exportCloseSummary}>
            <DownloadIcon aria-hidden="true" data-icon className="size-4" />
            Exportar resumen
          </button>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 border-y border-[var(--ui-line)] sm:grid-cols-2 sm:divide-x sm:divide-[var(--ui-line)]">
        {session.id ? (
          <div className="flex justify-between gap-3 px-3 py-2.5">
            <dt>Sesión de caja</dt>
            <dd className="font-semibold tabular-nums">#{session.id}</dd>
          </div>
        ) : null}
        {closedAtLabel ? (
          <div className="flex justify-between gap-3 px-3 py-2.5">
            <dt>Cerrada</dt>
            <dd className="font-semibold">{closedAtLabel}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3 border-t border-[var(--ui-line)] px-3 py-2.5">
          <dt>Monto apertura</dt>
          <dd className="font-semibold"><MoneyText cents={cents.opening} /></dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-[var(--ui-line)] px-3 py-2.5">
          <dt>Efectivo esperado</dt>
          <dd className="font-semibold"><MoneyText cents={cents.expected} /></dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-[var(--ui-line)] px-3 py-2.5">
          <dt>Monto contado</dt>
          <dd className="font-semibold"><MoneyText cents={closingAmountCents} /></dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-[var(--ui-line)] px-3 py-2.5">
          <dt>Diferencia</dt>
          {/* Diferencia de caja = warn (identidad §2); diferencia cero es
              conciliación neutra, nunca celebrada en verde. El valor lleva
              signo explícito (no solo color). */}
          <dd
            className={cn(
              'font-semibold tabular-nums',
              differenceCents !== null && differenceCents !== 0
                ? 'text-[color:var(--ui-warn)]'
                : 'text-[color:var(--ui-ink)]',
            )}
          >
            {formatSignedCashCents(differenceCents)}
          </dd>
        </div>
      </dl>

      <DenominationBreakdown breakdown={session.closing_breakdown} />

      <dl className="mt-3 grid grid-cols-1 divide-y divide-[var(--ui-line)] border-y border-[var(--ui-line)] text-[length:var(--ui-text-xs)] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        {METHOD_LABELS.map(({ key, label }) => (
          <div key={key} className="flex justify-between gap-2 px-3 py-2">
            <dt>{label}</dt>
            <dd className="font-semibold"><MoneyText cents={cents.methods[key]} /></dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
        Nota: <span className="text-[color:var(--ui-ink)]">{closingNotes.trim() || 'Sin nota'}</span>
      </div>
    </AdminPanel>
    </div>
  );
}

export function CloseSessionDialog({
  open,
  onOpenChange,
  session,
  closingAmount,
  closingNotes,
  differenceCents,
  isSubmitting,
  onClosingNotesChange,
  onConfirm,
}: CloseSessionDialogProps) {
  const closingNotesRef = useRef<HTMLTextAreaElement | null>(null);
  const cents = sessionCents(session);
  const closingAmountCents = parseCents(closingAmount);
  const pendingInvoiceCount = session.pending_invoice_count ?? 0;
  const missingInstitutionalReceiptCount = session.missing_institutional_receipt_count ?? 0;
  const hasPendingBalance = pendingInvoiceCount > 0 || (cents.pending !== null && cents.pending > 0);
  const isDifference = differenceCents !== null && differenceCents !== 0;
  const trimmedClosingNotes = closingNotes.trim();
  const hasValidDifferenceNote = !isDifference || trimmedClosingNotes.length >= MIN_DIFFERENCE_NOTE_LENGTH;

  useEffect(() => {
    if (open && isDifference) {
      window.setTimeout(() => closingNotesRef.current?.focus(), 0);
    }
  }, [isDifference, open]);

  function exportCloseSummary() {
    downloadCloseSummaryCsv({
      cashSessionId: session.id,
      closedAt: session.closed_at,
      openingAmountCents: cents.opening,
      expectedAmountCents: cents.expected,
      methodsCents: cents.methods,
      pendingAmountCents: cents.pending,
      pendingInvoiceCount,
      closingAmountCents,
      differenceCents,
      closingNotes,
      closingBreakdown: session.closing_breakdown,
    });
  }

  function printCloseSummary() {
    const previousPrinting = document.body.dataset.printingCashClose;
    document.body.dataset.printingCashClose = 'true';

    try {
      window.print();
    } finally {
      if (previousPrinting) {
        document.body.dataset.printingCashClose = previousPrinting;
      } else {
        delete document.body.dataset.printingCashClose;
      }
    }
  }

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Cierre de caja"
      description="Revise el resumen, el conteo físico y la diferencia antes de confirmar."
      className="sm:max-w-3xl"
      closeDisabled={isSubmitting}
      footer={(
        <>
          <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={printCloseSummary} disabled={isSubmitting}>
            <PrinterIcon aria-hidden="true" data-icon className="size-4" />
            Imprimir resumen
          </button>
          <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={exportCloseSummary} disabled={isSubmitting}>
            <DownloadIcon aria-hidden="true" data-icon className="size-4" />
            Exportar resumen
          </button>
          <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={() => onOpenChange(false)}>Cancelar</button>
          <button
            type="button"
            data-ui-press
            className={PRIMARY_BUTTON}
            onClick={onConfirm}
            disabled={isSubmitting || hasPendingBalance || missingInstitutionalReceiptCount > 0 || !hasValidDifferenceNote}
          >
            {isSubmitting ? 'Cerrando...' : 'Cerrar caja'}
          </button>
        </>
      )}
    >
      <div data-cash-close-print-root="">
        <div className="flex flex-col gap-1">
          {/* Un solo título por diálogo: `AdminDialog` ya anuncia «Cierre de
              caja» como título accesible; el segundo título encadenaba una
              jerarquía equivalente (C4-VISUAL MEDIUM). */}
          <div className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
            <div className="mt-3 grid gap-3">
              <h3 className="text-[length:var(--ui-text-xs)] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-ink)]">
                1. Resumen del turno
              </h3>
              <dl className="divide-y divide-[var(--ui-line)] border-y border-[var(--ui-line)] text-[length:var(--ui-text-sm)]">
                <div className="flex justify-between gap-4 py-2.5">
                  <dt>Monto apertura</dt>
                  <dd className="font-semibold"><MoneyText cents={cents.opening} /></dd>
                </div>
                <div className="flex justify-between gap-4 py-2.5">
                  <dt>Efectivo esperado</dt>
                  <dd className="font-semibold"><MoneyText cents={cents.expected} /></dd>
                </div>
                {/* Saldo pendiente es cifra del turno (lo que aún se debe
                    cobrar), no un método de cobro: vive en la misma tarjeta
                    que apertura y esperado, con el mismo molde de fila que
                    Resumen agrupa en su lista del turno. */}
                <div className="flex justify-between gap-4 py-2.5">
                  <dt>Saldo pendiente</dt>
                  <dd className="font-semibold"><MoneyText cents={cents.pending} /></dd>
                </div>
              </dl>
              <dl className="grid grid-cols-1 divide-y divide-[var(--ui-line)] border-b border-[var(--ui-line)] text-[length:var(--ui-text-xs)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                {METHOD_LABELS.map(({ key, label }) => (
                  <div key={key} className="flex justify-between gap-2 px-3 py-2">
                    <dt>{label}</dt>
                    <dd className="font-semibold"><MoneyText cents={cents.methods[key]} /></dd>
                  </div>
                ))}
              </dl>
              {pendingInvoiceCount > 0 ? (
                <AdminCallout tone="warn"><span className="text-[length:var(--ui-text-xs)] font-medium">Hay {pendingInvoiceCount} factura(s) pendientes o parciales. No se puede cerrar hasta revisarlas.</span></AdminCallout>
              ) : cents.pending !== null && cents.pending > 0 ? (
                <AdminCallout tone="warn"><span className="text-[length:var(--ui-text-xs)] font-medium">Hay saldo pendiente en esta caja. Revise Historial antes de cerrar.</span></AdminCallout>
              ) : null}
              {missingInstitutionalReceiptCount > 0 ? (
                <AdminCallout tone="warn"><span className="text-[length:var(--ui-text-xs)] font-medium">Hay {missingInstitutionalReceiptCount} recibo(s) institucional(es) pendiente(s). No se puede cerrar hasta emitirlos.</span></AdminCallout>
              ) : null}
              <h3 className="text-[length:var(--ui-text-xs)] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-ink)]">
                2. Conteo de efectivo
              </h3>
              <dl className="grid grid-cols-1 divide-y divide-[var(--ui-line)] border-y border-[var(--ui-line)] text-[length:var(--ui-text-sm)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <div className="flex justify-between gap-4 px-3 py-2.5">
                  <dt>Contado</dt>
                  <dd className="font-semibold"><MoneyText cents={closingAmountCents} /></dd>
                </div>
                <div className="flex justify-between gap-4 px-3 py-2.5">
                  <dt>Diferencia</dt>
                  {/* Diferencia de caja = warn; cero = neutro. El valor lleva
                      signo explícito: el color nunca es el único canal. */}
                  <dd
                    className={cn(
                      'font-semibold tabular-nums',
                      isDifference ? 'text-[color:var(--ui-warn)]' : 'text-[color:var(--ui-ink)]',
                    )}
                  >
                    {formatSignedCashCents(differenceCents)}
                  </dd>
                </div>
              </dl>
              <DenominationBreakdown breakdown={session.closing_breakdown} />
            </div>
          </div>
        </div>

        {isDifference ? (
          <div className="mt-4">
            <AdminField
              htmlFor="closing_difference_notes"
              label="Nota sobre la diferencia"
              required
              error={!hasValidDifferenceNote ? 'La nota es obligatoria y debe tener al menos 5 caracteres cuando hay diferencia.' : undefined}
            >
              <textarea
                ref={(control) => { closingNotesRef.current = control; }}
                id="closing_difference_notes"
                value={closingNotes}
                onChange={(e) => onClosingNotesChange(e.target.value)}
                placeholder="Explique la diferencia..."
                rows={2}
                aria-invalid={isDifference && !hasValidDifferenceNote}
                aria-describedby={isDifference && !hasValidDifferenceNote ? 'closing_difference_notes-error' : undefined}
                className={TEXTAREA_CLASS}
              />
            </AdminField>
          </div>
        ) : null}

        <section className="mt-5 grid gap-2" aria-labelledby="close-session-confirm-step">
          <h3 id="close-session-confirm-step" className="text-[length:var(--ui-text-xs)] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-ink)]">
            3. Confirmar cierre
          </h3>
          <p className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
            Confirme después de revisar el resumen, el conteo físico y la diferencia calculada.
          </p>
        </section>
      </div>
    </AdminDialog>
  );
}

function DenominationBreakdown({ breakdown }: { breakdown?: CashClosingBreakdown | null }) {
  if (!breakdown) return null;

  const billEntries = Object.entries(breakdown.bills).filter(([, count]) => count > 0);

  return (
    <section aria-label="Desglose del conteo físico" className="mt-3 border-y border-[var(--ui-line)] py-3 text-[length:var(--ui-text-xs)]">
      <h3 className="font-semibold text-[color:var(--ui-ink)]">Desglose del conteo físico</h3>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        {billEntries.map(([denomination, count]) => (
          <div key={denomination} className="flex justify-between gap-2">
            <dt>Billetes L {denomination}</dt>
            <dd className="font-semibold tabular-nums">{count}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-2">
          <dt>Monedas y otros</dt>
          <dd className="font-semibold tabular-nums"><MoneyText cents={parseCents(breakdown.other_amount)} /></dd>
        </div>
      </dl>
    </section>
  );
}
