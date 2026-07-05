import type { ExecutiveReport } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { formatLempirasUI } from '@/lib/moneyCents';

type ExecutiveAlertsProps = {
  report: ExecutiveReport;
};

type ExecutiveAlert = {
  key: string;
  title: string;
  detail: string;
  variant: 'warning' | 'destructive';
};

export function ExecutiveAlerts({ report }: ExecutiveAlertsProps) {
  const alerts = buildExecutiveAlerts(report);

  if (alerts.length === 0) return null;

  return (
    <section className="rounded-md border border-operational-border bg-operational-surface p-4" aria-labelledby="executive-alerts-title">
      <div className="mb-3">
        <h3 id="executive-alerts-title" className="text-sm font-semibold text-foreground">
          Alertas operativas
        </h3>
        <p className="text-xs text-muted-foreground">
          Revise primero estos puntos antes de interpretar el detalle del periodo.
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {alerts.map((alert) => (
          <Alert key={alert.key} variant={alert.variant} title={alert.title} className="p-3">
            {alert.detail}
          </Alert>
        ))}
      </div>
    </section>
  );
}

function buildExecutiveAlerts(report: ExecutiveReport): ExecutiveAlert[] {
  const alerts: ExecutiveAlert[] = [];
  const oldPending = report.pending_aging['31_plus_days'];
  const oldPendingCount = safeAlertCount(oldPending.count);
  const cashDifferences = safeAlertCount(report.audit_summary.cash_differences);
  const criticalEvents = safeAlertCount(report.audit_summary.critical_events);

  if (oldPendingCount > 0) {
    alerts.push({
      key: 'old-pending',
      title: 'Pendientes antiguos',
      detail: `${oldPendingCount} ${oldPendingCount === 1 ? 'factura tiene' : 'facturas tienen'} 31 o mas dias pendiente (${formatLempirasUI(oldPending.amount)}).`,
      variant: 'warning',
    });
  }

  if (cashDifferences > 0) {
    alerts.push({
      key: 'cash-differences',
      title: 'Caja requiere revision',
      detail: `${cashDifferences} ${cashDifferences === 1 ? 'cierre' : 'cierres'} con diferencia de caja.`,
      variant: 'warning',
    });
  }

  if (criticalEvents > 0) {
    alerts.push({
      key: 'critical-events',
      title: 'Auditoria critica',
      detail: `${criticalEvents} ${criticalEvents === 1 ? 'evento critico' : 'eventos criticos'} de auditoria.`,
      variant: 'destructive',
    });
  }

  return alerts;
}

function safeAlertCount(value: number | string | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.trunc(parsed);
}
