import { CheckCircle2Icon, CircleSlashIcon, DownloadIcon, PlusIcon, PrinterIcon } from 'lucide-react';
import {
  AdminCallout,
  AdminPanel,
  AdminPanelHeader,
  MoneyText,
  StatusStamp,
} from '@/design-system/admin/components';
import { cn } from '@/lib/utils';
import { parseCents } from '@/lib/moneyCents';
import type { Payment } from '@/lib/api';
import type { CobrarResult } from '../state/types';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from './cobrarUi';

type ResultZoneProps = {
  result: CobrarResult;
  onNewOperation: () => void;
  onPrint: () => void;
  onSavePdf: () => void;
  printing: boolean;
  saving: boolean;
};

const METHOD_LABEL: Record<Payment['method'], string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  other: 'Otro',
};

function formatPaidAt(value: string | null): string | null {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('es-HN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

/**
 * Resultado: la estación se sustituye por el comprobante de lo ocurrido.
 *
 * El documento y el total son el foco; paciente, método y fecha acompañan como
 * datos de la operación. El siguiente paciente no hereda nombre, condición ni
 * datos: `Nueva operación` reinicia el recorrido.
 */
export function ResultZone({ result, onNewOperation, onPrint, onSavePdf, printing, saving }: ResultZoneProps) {
  const isZero = result.outcome === 'sin_cobro';
  const paidAt = formatPaidAt(result.paidAt);
  const hasReceipt = result.receipt !== null;

  return (
    <AdminPanel as="section" aria-labelledby="cobrar-result-title">
      <AdminPanelHeader
        headingLevel={2}
        id="cobrar-result-title"
        title={isZero ? 'Operación emitida sin cobro' : 'Operación cobrada'}
        actions={<StatusStamp status={isZero ? 'gratuito' : 'cobrado'} />}
      />

      <div className="flex flex-col gap-5 p-5">
        <div className="grid gap-4 border-b border-[var(--ui-line)] pb-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden="true"
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-[var(--ui-radius-control)]',
                isZero
                  ? 'bg-[var(--ui-surface-alt)] text-[color:var(--ui-ink-soft)]'
                  : 'bg-[var(--ui-success-subtle)] text-[color:var(--ui-success)]',
              )}
            >
              {isZero ? (
                <CircleSlashIcon className="size-4" strokeWidth={2} />
              ) : (
                <CheckCircle2Icon className="size-4" strokeWidth={2} />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-[length:var(--ui-text-xs)] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-ink-faint)]">
                Documento
              </p>
              <p className="mt-0.5 text-[length:var(--ui-text-xl)] font-semibold tabular-nums text-[color:var(--ui-ink)]">
                {result.invoice.invoice_number}
              </p>
              <p className="mt-1 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)] [overflow-wrap:anywhere]">
                {result.invoice.patient_name}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[length:var(--ui-text-xs)] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-ink-faint)]">
              {isZero ? 'Total sin cobro' : 'Total cobrado'}
            </p>
            <MoneyText cents={parseCents(result.invoice.total)} emphasis="total" className="mt-0.5" />
          </div>
        </div>

        {result.method || paidAt ? (
          <dl className="flex flex-wrap items-start gap-x-6 gap-y-2 border-t border-[var(--ui-line)] pt-3 text-[length:var(--ui-text-sm)]">
            {result.method ? (
              <div className="flex min-w-0 flex-col">
                <dt className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Método</dt>
                <dd className="font-medium text-[color:var(--ui-ink)]">{METHOD_LABEL[result.method]}</dd>
              </div>
            ) : null}
            {paidAt ? (
              <div className="flex min-w-0 flex-col">
                <dt className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Fecha</dt>
                <dd className="font-medium text-[color:var(--ui-ink)]">{paidAt}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {result.receiptRecovery ? (
          <AdminCallout tone="warn" title="Comprobante pendiente">
            <p>{result.receiptRecovery}</p>
          </AdminCallout>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t border-[var(--ui-line)] pt-4 sm:flex-row sm:justify-end">
          <button type="button" className={SECONDARY_BUTTON} onClick={onPrint} disabled={!hasReceipt || printing}>
            <PrinterIcon aria-hidden="true" className="size-4" strokeWidth={2} />
            {printing ? 'Abriendo…' : 'Imprimir'}
          </button>
          <button type="button" className={SECONDARY_BUTTON} onClick={onSavePdf} disabled={!hasReceipt || saving}>
            <DownloadIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />
            {saving ? 'Guardando…' : 'Guardar PDF'}
          </button>
          <button type="button" className={PRIMARY_BUTTON} onClick={onNewOperation}>
            <PlusIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />
            Nueva operación
          </button>
        </div>
      </div>
    </AdminPanel>
  );
}
