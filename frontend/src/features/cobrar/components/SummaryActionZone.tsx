import { BadgeCheckIcon, CheckCircle2Icon, CircleAlertIcon, EyeIcon, InfoIcon, RefreshCwIcon, TriangleAlertIcon } from 'lucide-react';
import { MoneyText } from '@/design-system/admin/components';
import { asCents, formatLempirasUIFromCents } from '@/lib/moneyCents';
import type { InvoicePreview } from '@/lib/api';
import type { CobrarStatus } from '../state/status';
import { LINK_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON, cobrarStateTone, STATE_TEXT, type CobrarStateTone } from './cobrarUi';

type SummaryActionZoneProps = {
  status: CobrarStatus;
  preview: InvoicePreview | null;
  previewMatchesRevision: boolean;
  submitting: boolean;
  onConfirm: () => void;
  onRetryPreview: () => void;
  canPreviewDocument: boolean;
  previewingDocument: boolean;
  onPreviewDocument: () => void;
  actionError?: string | null;
};

/**
 * Barra de total y acción, integrada al pie de la estación.
 *
 * Una sola franja: el total valorado por el servidor, el desglose como dato
 * secundario, el motivo textual cuando algo bloquea y la acción deliberada. El
 * borde superior toma el color del estado, de modo que borrador, valorada,
 * listo, sin cobro y error de valoración se distinguen sin depender del color
 * del botón. Si el servidor no confirma el total se escribe "No disponible",
 * nunca `L 0.00`.
 */
export function SummaryActionZone({
  status,
  preview,
  previewMatchesRevision,
  submitting,
  onConfirm,
  onRetryPreview,
  canPreviewDocument,
  previewingDocument,
  onPreviewDocument,
  actionError = null,
}: SummaryActionZoneProps) {
  const showPreview = previewMatchesRevision && preview !== null;
  const tone = cobrarStateTone(status.code);
  const totalLabel = status.totalCents !== null ? formatLempirasUIFromCents(status.totalCents) : null;
  const baseLabel =
    status.confirmKind === 'zero'
      ? 'Emitir sin cobro'
      : status.confirmKind === 'retry'
        ? 'Cobrar pendiente'
        : 'Cobrar';
  const actionLabel =
    status.confirmKind === 'zero' || totalLabel === null ? baseLabel : `${baseLabel} · ${totalLabel}`;
  const showRetry = status.code === 'servidor_no_disponible';
  // El borrador sin líneas ya lo explica el estado vacío de la cuenta.
  const detail = status.code === 'borrador' ? null : status.detail;
  const totalFallback =
    status.code === 'calculando' || status.code === 'emitiendo'
      ? 'Calculando…'
      : status.code === 'borrador'
        ? 'Sin líneas'
        : 'No disponible';

  return (
    <aside
      aria-label="Total y acción"
      data-cobrar-state={status.code}
      className="flex flex-col border-t border-[var(--ui-line-strong)] bg-[var(--ui-surface)]"
    >
      <div className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <span className="flex flex-col gap-1">
              <span className="text-[length:var(--ui-text-xs)] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-ink-soft)]">
                Total confirmado
              </span>
            {status.totalCents !== null ? (
              <MoneyText cents={status.totalCents} emphasis="total" />
            ) : (
              <span className="text-[length:var(--ui-text-md)] font-semibold text-[color:var(--ui-ink-soft)]">
                {totalFallback}
              </span>
            )}
            </span>

          {showPreview ? (
            /* Los importes se leen tal cual de la valoración del servidor. Nunca
               se deriva "Exento" sumando el precio registrado de la línea
               gratuita: la línea sin cobro aporta 0 a la base exenta. */
            <dl className="flex flex-wrap items-baseline gap-x-4 gap-y-1 pb-0.5 text-[length:var(--ui-text-xs)]">
              <div className="flex items-baseline gap-1.5">
                <dt className="text-[color:var(--ui-ink-soft)]">Subtotal</dt>
                <dd>
                  <MoneyText cents={asCents(preview.totals.subtotal_cents)} />
                </dd>
              </div>
              <div className="flex items-baseline gap-1.5">
                <dt className="text-[color:var(--ui-ink-soft)]">Exento</dt>
                <dd>
                  <MoneyText cents={asCents(preview.totals.exempt_cents)} />
                </dd>
              </div>
              <div className="flex items-baseline gap-1.5">
                <dt className="text-[color:var(--ui-ink-soft)]">
                  ISV{preview.tax.rate ? ` (${preview.tax.rate}%)` : ''}
                </dt>
                <dd>
                  <MoneyText cents={asCents(preview.totals.tax_cents)} />
                </dd>
              </div>
            </dl>
          ) : null}
          </div>

          {actionError ? (
          <p
            role="alert"
            className="flex items-start gap-1.5 text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-danger)]"
          >
            <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
            {actionError}
          </p>
          ) : null}

          {detail ? (
          <div
            className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[length:var(--ui-text-xs)] ${STATE_TEXT[tone]}`}
          >
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <StateGlyph tone={tone} />
              {status.label}
            </span>
            <span className="text-[color:var(--ui-ink-soft)]">{detail}</span>
            {showRetry ? (
              <button type="button" onClick={onRetryPreview} className={LINK_BUTTON}>
                <RefreshCwIcon aria-hidden="true" className="size-3.5" strokeWidth={2} />
                Reintentar valoración
              </button>
            ) : null}
          </div>
          ) : null}
        </div>

        {/* Esta acción acompaña al resumen. En móvil, la barra inferior solo la
            reemplaza cuando todo este bloque sale del área visible. */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row lg:min-w-[22rem] lg:justify-end">
          <button
            type="button"
            onClick={onPreviewDocument}
            disabled={!canPreviewDocument || previewingDocument}
            className={`${SECONDARY_BUTTON} min-h-11 shrink-0 flex-none`}
          >
            <EyeIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />
            {previewingDocument ? 'Preparando…' : 'Vista previa'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!status.canConfirm || submitting}
            className={`${PRIMARY_BUTTON} min-h-11 shrink-0 flex-none sm:flex-1`}
            data-testid="cobrar-primary-action"
          >
            {submitting ? 'Emitiendo…' : actionLabel}
          </button>
        </div>
      </div>
    </aside>
  );
}

function StateGlyph({ tone }: { tone: CobrarStateTone }) {
  const glyph = { 'aria-hidden': true as const, className: 'size-3.5 shrink-0', strokeWidth: 2 as const };

  switch (tone) {
    case 'danger':
      return <CircleAlertIcon {...glyph} />;
    case 'warn':
      return <TriangleAlertIcon {...glyph} />;
    case 'success':
      return <CheckCircle2Icon {...glyph} />;
    case 'free':
      return <BadgeCheckIcon {...glyph} />;
    default:
      return <InfoIcon {...glyph} />;
  }
}
