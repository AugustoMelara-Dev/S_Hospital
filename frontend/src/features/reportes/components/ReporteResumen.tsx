import { useMemo, type ReactNode } from 'react';
import {
  AdminChip,
  AdminPanel,
  AdminPanelHeader,
  AdminStat,
  AdminStatBand,
  MoneyText,
} from '@/design-system/admin/components';
import type { ReporteEjecutivo } from '../types';
import { formatDias, reporteCents, summarizeCollectionMethods } from '../formato';

type Props = {
  report: ReporteEjecutivo;
  updatedAt: number;
};

function formatUpdatedAt(updatedAt: number): string | null {
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) return null;
  return new Date(updatedAt).toLocaleString('es-HN', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Resumen del período como **banda de cohortes**: una sola superficie con las
 * cuatro métricas que el operador necesita separadas (emisión, cobro, saldo al
 * corte y sin cobro) y la base de cada una en su `hint`. Las cifras de apoyo
 * viven en una franja secundaria, no en ocho tarjetas iguales.
 */
export function ReporteResumen({ report, updatedAt }: Props) {
  const { summary } = report;
  const avgCents = reporteCents(summary.average_ticket);
  const updated = formatUpdatedAt(updatedAt);
  const methods = useMemo(() => summarizeCollectionMethods(report.collections), [report.collections]);

  return (
    <AdminPanel as="section" aria-labelledby="reporte-resumen-title">
      <AdminPanelHeader
        headingLevel={2}
        id="reporte-resumen-title"
        title="Resumen del período"
        description={`Del ${report.period.from} al ${report.period.to} · ${formatDias(report.period.days)}`}
        actions={updated ? <AdminChip>{`Actualizado ${updated}`}</AdminChip> : null}
      />

      <div className="flex flex-col gap-4 px-4 py-3.5">
        <AdminStatBand columns={4} role="group" aria-label="Indicadores del período">
          <div data-reporte-metric="billed">
            <AdminStat
              label="Facturado"
              value={<MoneyText cents={reporteCents(summary.billed_total)} emphasis="strong" />}
              hint="Emitidas no anuladas · emisión del período"
            />
          </div>
          <div data-reporte-metric="collected">
            <AdminStat
              label="Cobrado"
              value={<MoneyText cents={reporteCents(summary.collected_total)} emphasis="strong" />}
              hint="Cobros registrados, sin pagos revertidos · fecha de cobro"
            />
          </div>
          <div data-reporte-metric="pending">
            <AdminStat
              label="Saldo al corte"
              value={<MoneyText cents={reporteCents(summary.pending_total)} emphasis="strong" />}
              hint="Abierto de emitidas y parciales a la fecha de corte"
            />
          </div>
          <div data-reporte-metric="without-charge">
            <AdminStat
              label="Sin cobro"
              value={<span className="tabular-nums">{summary.without_charge_count}</span>}
              hint="Emitidas sin cobro por regla o precio cero"
            />
          </div>
        </AdminStatBand>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[var(--ui-line)] pt-3.5 sm:grid-cols-3 xl:grid-cols-6">
          <SupportStat label="Facturas" value={<span className="tabular-nums">{summary.invoice_count}</span>} />
          <SupportStat label="Pagos contabilizados" value={<span className="tabular-nums">{summary.receipt_count}</span>} />
          <SupportStat
            label="Pagadas / parciales"
            value={<span className="tabular-nums">{summary.paid_count} / {summary.partial_count}</span>}
          />
          <SupportStat label="Ticket promedio" value={<MoneyText cents={avgCents} />} />
          <SupportStat label="Anulado" value={<MoneyText cents={reporteCents(summary.voided_total)} />} />
          <SupportStat label="Reversado" value={<MoneyText cents={reporteCents(summary.reversed_total)} />} />
        </dl>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--ui-line)] pt-3">
          <span className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
            Líneas gratuitas
          </span>
          <span
            data-testid="reporte-gratuidad-count"
            className="font-semibold tabular-nums text-[color:var(--ui-ink)]"
          >
            {summary.gratuity_item_count}
          </span>
          {summary.gratuity_adjustment_persisted ? (
            <AdminChip tone="accent">
              Ajuste <MoneyText cents={reporteCents(summary.gratuity_adjustment_total)} fallback="—" />
            </AdminChip>
          ) : null}
        </div>

        {methods.length > 1 ? <MethodsDistribution methods={methods} /> : null}
      </div>
    </AdminPanel>
  );
}

function SupportStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-faint)]">{label}</dt>
      <dd className="mt-0.5 text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">
        {value}
      </dd>
    </div>
  );
}

/**
 * Distribución de cobros por método: desglose compacto con importe y
 * porcentaje. Sin barra dibujada: el porcentaje ya da la lectura y evita
 * duplicar la tabla de Cobros con una visualización decorativa.
 */
function MethodsDistribution({ methods }: { methods: { label: string; cents: number }[] }) {
  const total = methods.reduce((sum, method) => sum + method.cents, 0);
  if (total <= 0) return null;

  return (
    <div className="flex flex-col gap-2 border-t border-[var(--ui-line)] pt-3" data-reporte-methods>
      <p className="text-[length:var(--ui-text-xs)] font-medium uppercase tracking-[0.06em] text-[color:var(--ui-ink-faint)]">
        Cobros por método
      </p>
      <ul className="flex flex-col divide-y divide-[var(--ui-line)]">
        {methods.map((method) => {
          const percentage = Math.round((method.cents / total) * 100);
          return (
            <li key={method.label} className="flex items-center justify-between gap-3 py-1.5">
              <span className="truncate text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink)]">
                {method.label}
              </span>
              <span className="flex items-baseline gap-3">
                <MoneyText cents={method.cents} />
                <span className="w-9 text-right text-[length:var(--ui-text-xs)] tabular-nums text-[color:var(--ui-ink-soft)]">
                  {percentage}%
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
