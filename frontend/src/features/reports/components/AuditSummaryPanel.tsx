import { Activity, AlertOctagon, FileClock, History, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ExecutiveReport } from '@/lib/api';

type AuditSummaryPanelProps = {
  report: ExecutiveReport;
};

type Indicator = {
  key: string;
  label: string;
  helper: string;
  icon: typeof Activity;
  count: number;
  tone: 'neutral' | 'warning' | 'danger';
};

export function AuditSummaryPanel({ report }: AuditSummaryPanelProps) {
  const audit = report.audit_summary;
  const indicators: Indicator[] = [
    {
      key: 'critical',
      label: 'Eventos criticos',
      helper: 'Anulaciones, reversas y pagos anulados.',
      icon: AlertOctagon,
      count: audit.critical_events,
      tone: 'warning',
    },
    {
      key: 'reprints',
      label: 'Reimpresiones',
      helper: 'Reemisiones de comprobantes en el periodo.',
      icon: History,
      count: audit.reprints,
      tone: 'neutral',
    },
    {
      key: 'fiscal',
      label: 'Cambios fiscales',
      helper: 'Ajustes a CAI, correlativo, rango o numeracion.',
      icon: Settings,
      count: audit.fiscal_changes,
      tone: 'warning',
    },
    {
      key: 'cash',
      label: 'Diferencias de caja',
      helper: 'Cierres con monto contado distinto del esperado.',
      icon: FileClock,
      count: audit.cash_differences,
      tone: 'warning',
    },
    {
      key: 'backup',
      label: 'Eventos de respaldo',
      helper: 'Respaldo creado o fallido.',
      icon: Activity,
      count: audit.backup_events,
      tone: 'neutral',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Auditoria institucional</CardTitle>
        <p className="text-xs text-muted-foreground">
          Conteos clave del periodo. Audite primero lo que requiera atencion.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {indicators.map((indicator) => {
            const Icon = indicator.icon;
            const isAlert = indicator.count > 0;
            return (
              <div
                key={indicator.key}
                className={
                  'rounded border p-3 ' +
                  (isAlert
                    ? indicator.tone === 'danger'
                      ? 'border-destructive/40 bg-destructive/5'
                      : 'border-warning/40 bg-warning/5'
                    : 'border-border bg-muted/40')
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {indicator.label}
                  </p>
                  <Icon
                    className={
                      'size-4 shrink-0 ' +
                      (isAlert
                        ? indicator.tone === 'danger'
                          ? 'text-destructive'
                          : 'text-warning'
                        : 'text-muted-foreground')
                    }
                    aria-hidden="true"
                  />
                </div>
                <p
                  className={
                    'mt-1 text-2xl font-bold tabular-nums ' +
                    (isAlert
                      ? indicator.tone === 'danger'
                        ? 'text-destructive'
                        : 'text-warning'
                      : 'text-foreground')
                  }
                >
                  {indicator.count}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">{indicator.helper}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
