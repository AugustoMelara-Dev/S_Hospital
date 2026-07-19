import { ArchiveRestoreIcon, HistoryIcon, SettingsIcon, TriangleAlertIcon, WalletCardsIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ExecutiveReport } from '@/lib/api';

type Props = { report: ExecutiveReport };

export function AuditSummaryPanel({ report }: Props) {
  const audit = report.audit_summary;
  const items = [
    { key: 'critical', label: 'Eventos críticos', helper: 'Anulaciones, reversas y pagos anulados.', icon: TriangleAlertIcon, value: audit.critical_events },
    { key: 'reprints', label: 'Reimpresiones', helper: 'Reemisiones de comprobantes en el período.', icon: HistoryIcon, value: audit.reprints },
    { key: 'fiscal', label: 'Cambios fiscales', helper: 'Ajustes a CAI, correlativo, rango o numeración.', icon: SettingsIcon, value: audit.fiscal_changes },
    { key: 'cash', label: 'Diferencias de caja', helper: 'Cierres con monto contado distinto del esperado.', icon: WalletCardsIcon, value: audit.cash_differences },
    { key: 'backup', label: 'Eventos de respaldo', helper: 'Respaldo creado o fallido.', icon: ArchiveRestoreIcon, value: audit.backup_events },
  ];
  return (
    <section aria-labelledby="audit-summary-title">
      <Card>
        <CardHeader><CardTitle><h3 id="audit-summary-title">Auditoría institucional</h3></CardTitle><CardDescription>Conteos clave del período. Audite primero lo que requiera atención.</CardDescription></CardHeader>
        <CardContent><dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{items.map((item) => { const Icon = item.icon; return <div className="rounded-lg border border-border p-3" key={item.key}><dt className="flex items-center gap-2 text-sm font-medium"><Icon aria-hidden="true" className="size-4 text-muted-foreground" />{item.label}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{item.value}</dd><p className="mt-1 text-xs text-muted-foreground">{item.helper}</p></div>; })}</dl></CardContent>
      </Card>
    </section>
  );
}
