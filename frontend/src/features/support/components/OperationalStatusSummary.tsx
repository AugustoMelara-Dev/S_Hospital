import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import type { SystemStatus, SystemStatusCheck, SystemStatusSummary as PublicSystemStatusSummary } from '../../../lib/api';

type Props = {
  loading: boolean;
  summary: PublicSystemStatusSummary | null;
  status: SystemStatus | null;
  canViewAdvanced: boolean;
  onRefresh: () => void;
};

const statusLabels: Record<SystemStatusCheck['status'], string> = {
  validated: 'Validado',
  warning: 'Requiere revision',
  error: 'Error',
  manual_required: 'Prueba manual',
};

function iconForSeverity(severity: PublicSystemStatusSummary['summary']['severity'] | 'loading') {
  if (severity === 'ok') {
    return CheckCircle2;
  }

  if (severity === 'error') {
    return XCircle;
  }

  return AlertTriangle;
}

function iconClass(severity: PublicSystemStatusSummary['summary']['severity'] | 'loading') {
  if (severity === 'ok') {
    return 'size-5 text-emerald-600';
  }

  if (severity === 'error') {
    return 'size-5 text-red-600';
  }

  return 'size-5 text-amber-600';
}

export function OperationalStatusSummary({ loading, summary, status, canViewAdvanced, onRefresh }: Props) {
  const severity = summary?.summary.severity ?? 'loading';
  const Icon = iconForSeverity(severity);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Estado operativo</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary?.summary.action ?? 'Cargando verificacion comprensible para el personal de turno.'}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className="mr-2 size-4" />
          Actualizar
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-4">
          <Icon className={iconClass(severity)} aria-hidden="true" />
          <div className="space-y-2">
            <p className="text-sm font-semibold">
              {summary?.summary.label ?? 'Diagnostico cargando'}
            </p>
            {summary ? (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {summary.checks.map((check) => (
                  <li key={check.code}>
                    <span className="font-medium text-foreground">{check.label}:</span> {statusLabels[check.status]}. {check.detail}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">La guia diaria sigue disponible mientras se carga el diagnostico.</p>
            )}
          </div>
        </div>
        {canViewAdvanced && status ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Ultimo respaldo</p>
              <p className="text-sm font-semibold">{status.backups.last_success_filename ?? 'Pendiente'}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Base de datos</p>
              <p className="text-sm font-semibold">{status.database.is_mysql_family ? 'MySQL/MariaDB' : 'Revisar'}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Hora servidor</p>
              <p className="text-sm font-semibold">{new Date(status.environment.server_time).toLocaleString('es-HN')}</p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
