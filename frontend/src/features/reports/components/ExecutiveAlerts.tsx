import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ExecutiveReport } from '@/lib/api';
import { formatLempirasUI } from '@/lib/moneyCents';

type Props = { report: ExecutiveReport };
const count = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
};

export function ExecutiveAlerts({ report }: Props) {
  const old = count(report.pending_aging['31_plus_days'].count);
  const cash = count(report.audit_summary.cash_differences);
  const critical = count(report.audit_summary.critical_events);
  const alerts = [
    { key: 'old', show: old > 0, title: 'Pendientes antiguos', detail: `${old} ${old === 1 ? 'factura tiene' : 'facturas tienen'} 31 o más días pendiente (${formatLempirasUI(report.pending_aging['31_plus_days'].amount)}).` },
    { key: 'cash', show: cash > 0, title: 'Caja requiere revisión', detail: `${cash} ${cash === 1 ? 'cierre' : 'cierres'} con diferencia de caja.` },
    { key: 'audit', show: critical > 0, title: 'Auditoría crítica', detail: `${critical} ${critical === 1 ? 'evento crítico' : 'eventos críticos'} de auditoría.` },
  ].filter((item) => item.show);
  if (!alerts.length) return null;

  return (
    <section aria-labelledby="executive-alerts-title">
      <Card>
        <CardHeader>
          <CardTitle><h3 id="executive-alerts-title">Alertas operativas</h3></CardTitle>
          <CardDescription>Revise primero estos puntos antes de interpretar el detalle del período.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {alerts.map((item) => <Alert key={item.key} variant={item.key === 'audit' ? 'destructive' : 'default'}><AlertTitle>{item.title}</AlertTitle><AlertDescription>{item.detail}</AlertDescription></Alert>)}
        </CardContent>
      </Card>
    </section>
  );
}
