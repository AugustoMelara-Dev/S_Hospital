import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatLempirasUI } from '@/lib/moneyCents';
import { cn } from '@/lib/utils';
import type { ExecutiveReport } from '@/lib/api';

type ExecutiveSummaryProps = {
  report: ExecutiveReport;
};

type KpiTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

type KpiSpec = {
  key: keyof ExecutiveReport['summary'] | 'cash_collected' | 'cash_sessions_with_difference';
  label: string;
  helper: string;
  tone: KpiTone;
  value: (report: ExecutiveReport) => string;
  context: (report: ExecutiveReport) => string;
  delta?: (report: ExecutiveReport) => { value: number | null; label: string };
};

const KPI_SPECS: KpiSpec[] = [
  {
    key: 'billed_total',
    label: 'Total facturado',
    helper: 'Facturas emitidas, excluyendo anuladas.',
    tone: 'info',
    value: (r) => r.summary.billed_total,
    context: (r) => `${r.summary.invoice_count} facturas emitidas`,
    delta: (r) => ({
      value: r.comparison.billed.delta_percentage,
      label: 'vs periodo anterior',
    }),
  },
  {
    key: 'collected_total',
    label: 'Total cobrado',
    helper: 'Pagos registrados y no anulados.',
    tone: 'success',
    value: (r) => r.summary.collected_total,
    context: (r) => `${r.summary.receipt_count} pagos contabilizados`,
    delta: (r) => ({
      value: r.comparison.collected.delta_percentage,
      label: 'vs periodo anterior',
    }),
  },
  {
    key: 'pending_total',
    label: 'Saldo pendiente',
    helper: 'Facturas emitidas o parciales con saldo abierto.',
    tone: 'warning',
    value: (r) => r.summary.pending_total,
    context: (r) => `${r.summary.pending_count} facturas pendientes`,
  },
  {
    key: 'voided_total',
    label: 'Anulado',
    helper: 'Facturas anuladas. Fuera del ingreso neto.',
    tone: 'danger',
    value: (r) => r.summary.voided_total,
    context: (r) => `${r.summary.voided_count} facturas anuladas`,
  },
  {
    key: 'cash_collected',
    label: 'Efectivo recaudado',
    helper: 'Solo pagos en efectivo. Afecta el efectivo esperado de caja.',
    tone: 'neutral',
    value: (r: ExecutiveReport) => {
      const cash = r.payment_methods.find((m) => m.method === 'cash');
      return cash?.amount ?? '0.00';
    },
    context: (r: ExecutiveReport) => {
      const cash = r.payment_methods.find((m: ExecutiveReport['payment_methods'][number]) => m.method === 'cash');
      return `${cash?.count ?? 0} pagos en efectivo`;
    },
  },
  {
    key: 'invoice_count',
    label: 'Facturas',
    helper: 'Documentos emitidos en el periodo.',
    tone: 'neutral',
    value: (r: ExecutiveReport) => String(r.summary.invoice_count),
    context: (r: ExecutiveReport) => `${r.summary.paid_count} pagadas, ${r.summary.partial_count} parciales`,
  },
  {
    key: 'paid_count',
    label: 'Facturas pagadas',
    helper: 'Facturas liquidadas en el periodo.',
    tone: 'success',
    value: (r) => String(r.summary.paid_count),
    context: (r) => `${r.summary.partial_count} con saldo parcial`,
  },
  {
    key: 'partial_count',
    label: 'Facturas parciales',
    helper: 'Con pagos parciales, mantienen saldo pendiente.',
    tone: 'warning',
    value: (r) => String(r.summary.partial_count),
    context: (r) => `Saldo pendiente: ${formatLempirasUI(r.summary.pending_total)}`,
  },
  {
    key: 'voided_count',
    label: 'Anulaciones',
    helper: 'Cantidad de facturas anuladas. Fuera del ingreso neto.',
    tone: 'danger',
    value: (r) => String(r.summary.voided_count),
    context: (r) => `Monto anulado: ${formatLempirasUI(r.summary.voided_total)}`,
  },
  {
    key: 'reversed_total',
    label: 'Reversado',
    helper: 'Operaciones revertidas. Fuera del ingreso neto.',
    tone: 'danger',
    value: (r) => r.summary.reversed_total,
    context: () => 'Pagos reversados con auditoria',
  },
  {
    key: 'average_ticket',
    label: 'Ticket promedio',
    helper: 'Facturado total / numero de facturas.',
    tone: 'info',
    value: (r) => r.summary.average_ticket,
    context: (r) => `${r.summary.invoice_count} facturas`,
  },
  {
    key: 'cash_sessions_with_difference',
    label: 'Diferencias de caja',
    helper: 'Cierres con monto contado distinto del esperado.',
    tone: 'warning',
    value: (r) => {
      const withDiff = r.cash_sessions.filter((s) => s.difference && s.difference !== '0.00' && s.difference !== '0').length;
      return String(withDiff);
    },
    context: (r) => `${r.cash_sessions.length} sesiones cerradas`,
  },
];

const TONE_BORDER: Record<KpiTone, string> = {
  success: 'border-l-4 border-l-secondary/60',
  warning: 'border-l-4 border-l-warning',
  danger: 'border-l-4 border-l-destructive',
  info: 'border-l-4 border-l-info',
  neutral: 'border-l-4 border-l-border',
};

function formatDelta(percentage: number | null): { label: string; icon: typeof ArrowUpRight; tone: string } | null {
  if (percentage === null || Number.isNaN(percentage)) return null;
  if (Math.abs(percentage) < 0.05) {
    return { label: 'sin cambio', icon: Minus, tone: 'text-muted-foreground' };
  }
  const positive = percentage > 0;
  return {
    label: `${positive ? '+' : ''}${percentage.toFixed(2)}%`,
    icon: positive ? ArrowUpRight : ArrowDownRight,
    tone: positive ? 'text-secondary' : 'text-destructive',
  };
}

export function ExecutiveSummary({ report }: ExecutiveSummaryProps) {
  return (
    <section
      aria-labelledby="executive-summary-title"
      className="flex flex-col gap-4 rounded-panel border border-operational-border bg-operational-surface p-panel shadow-operational"
    >
      <header className="flex flex-col gap-3 border-b border-operational-border pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
        <p id="executive-summary-title" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Resumen ejecutivo
        </p>
        <h2 className="text-base font-semibold text-foreground">
          Lectura de facturacion, cobros y caja
        </h2>
        <p className="text-xs text-muted-foreground">
          Periodo del {report.period.from} al {report.period.to} ({report.period.days} {report.period.days === 1 ? 'dia' : 'dias'}) · {report.period.timezone}
        </p>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-right text-xs sm:min-w-80">
          <div className="rounded-md border border-operational-border bg-operational-panel px-3 py-2">
            <dt className="text-muted-foreground">Pagadas</dt>
            <dd className="mt-1 font-semibold tabular-nums text-foreground">{report.summary.paid_count}</dd>
          </div>
          <div className="rounded-md border border-operational-border bg-operational-panel px-3 py-2">
            <dt className="text-muted-foreground">Parciales</dt>
            <dd className="mt-1 font-semibold tabular-nums text-foreground">{report.summary.partial_count}</dd>
          </div>
          <div className="rounded-md border border-operational-border bg-operational-panel px-3 py-2">
            <dt className="text-muted-foreground">Anuladas</dt>
            <dd className="mt-1 font-semibold tabular-nums text-foreground">{report.summary.voided_count}</dd>
          </div>
        </dl>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {KPI_SPECS.map((spec) => {
          const value = spec.value(report);
          const context = spec.context(report);
          const delta = spec.delta?.(report) ?? null;
          const deltaView = delta ? formatDelta(delta.value) : null;
          const DeltaIcon = deltaView?.icon ?? null;

          return (
            <article
              key={spec.key}
              className={cn(
                'flex min-h-36 flex-col gap-1.5 rounded-md border border-operational-border bg-operational-panel p-4 shadow-sm transition-colors hover:border-hospital-primary/35',
                spec.key === 'billed_total' || spec.key === 'collected_total' ? 'lg:col-span-3' : 'lg:col-span-2',
                TONE_BORDER[spec.tone],
              )}
            >
              <header className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {spec.label}
                </p>
                {deltaView && DeltaIcon ? (
                  <Badge variant={spec.tone === 'danger' ? 'destructive' : spec.tone === 'warning' ? 'warning' : spec.tone === 'success' ? 'success' : 'secondary'}>
                    <DeltaIcon className="size-3" aria-hidden="true" />
                    {deltaView.label}
                  </Badge>
                ) : null}
              </header>
              <p className="text-xl font-bold tabular-nums text-foreground" translate="no">
                {spec.tone === 'neutral' && Number.isFinite(Number(value)) && /^\d+$/.test(value)
                  ? value
                  : formatLempirasUI(value)}
              </p>
              <p className="text-xs text-muted-foreground">{context}</p>
              <p className="text-[11px] text-muted-foreground/80">{spec.helper}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
