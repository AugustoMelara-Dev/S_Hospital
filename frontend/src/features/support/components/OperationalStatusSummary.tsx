import { CircleAlertIcon as AlertTriangle, CircleCheckIcon as CheckCircle2, Clock3Icon as Clock3, CircleXIcon as XCircle, ServerIcon as Server, DatabaseIcon as Database, HardDriveIcon as HardDrive, RefreshCwIcon as RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import type { ReactNode } from 'react';
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
    return 'size-5 text-success-foreground';
  }

  if (severity === 'error') {
    return 'size-5 text-destructive';
  }

  return 'size-5 text-warning-foreground';
}

function statusForSeverity(severity: PublicSystemStatusSummary['summary']['severity'] | 'loading') {
  if (severity === 'ok') return 'success';
  if (severity === 'error') return 'error';
  return 'warning';
}

function statusLabelForSeverity(severity: PublicSystemStatusSummary['summary']['severity'] | 'loading') {
  if (severity === 'ok') return 'Correcto';
  if (severity === 'error') return 'Error';
  if (severity === 'warning') return 'Atencion';
  return 'Cargando';
}

export function OperationalStatusSummary({ loading, summary, status, canViewAdvanced, onRefresh }: Props) {
  const severity = summary?.summary.severity ?? 'loading';
  const Icon = iconForSeverity(severity);
  const latestBackupConfirmed = status?.backups.last_success_at
    ? status.backups.last_success_file_exists !== false
      && status.backups.last_success_checksum_matches !== false
    : false;
  const lastBackupValue = status?.backups.last_success_at && latestBackupConfirmed
    ? new Date(status.backups.last_success_at).toLocaleString('es-HN')
    : 'Pendiente';
  const lastBackupHelper = latestBackupConfirmed
    ? 'Fecha protegida mas reciente'
    : 'Cree un respaldo nuevo';

  if (loading && !summary) {
    return <div role="status" aria-label="Cargando diagnóstico operativo..." className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Cargando diagnóstico operativo...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="min-w-0">
          <CardTitle><h2>Estado operativo</h2></CardTitle>
          <CardDescription>
            {summary?.summary.action ?? 'Cargando verificacion comprensible para el personal de turno.'}
          </CardDescription>
        </div>
          <Button type="button" size="sm" variant="outline" onClick={onRefresh} disabled={loading} aria-label="Actualizar diagnostico operativo">
            <RefreshCw data-icon="inline-start" />
            Actualizar
          </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="border border-border p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <Icon className={iconClass(severity)} aria-hidden="true" />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm font-semibold text-foreground">
                  {summary?.summary.label ?? 'Diagnostico cargando'}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {summary ? `${summary.summary.problem_count} alerta(s) operativa(s) detectada(s).` : 'La guia diaria sigue disponible mientras se carga el diagnostico.'}
                </p>
              </div>
            </div>
            <Badge variant={severity === 'error' ? 'destructive' : 'secondary'} data-tone={statusForSeverity(severity)}>{statusLabelForSeverity(severity)}</Badge>
          </div>

          {summary ? (
            <ul className="mt-4 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
              {summary.checks.map((check) => (
                <li key={check.code} className="border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="font-medium text-foreground">{check.label}</span>
                    <Badge variant={check.status === 'error' ? 'destructive' : 'secondary'}>
                      {statusLabels[check.status]}
                    </Badge>
                  </div>
                  <p className="mt-2 break-words leading-6">{check.detail}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {canViewAdvanced && status ? (
          <div className="grid gap-3 md:grid-cols-3">
            <OperationalMetric
              icon={<HardDrive />}
              label="Ultimo respaldo"
              value={lastBackupValue}
              helper={lastBackupHelper}
              variant={latestBackupConfirmed ? 'success' : 'warning'}
            />
            <OperationalMetric
              icon={<Database />}
              label="Base de datos"
              value={status.database.is_mysql_family ? 'MySQL/MariaDB' : 'Revisar'}
              helper="Motor reportado por el servidor local"
              variant={status.database.is_mysql_family ? 'success' : 'warning'}
            />
            <OperationalMetric
              icon={<Clock3 />}
              label="Hora servidor"
              value={new Date(status.environment.server_time).toLocaleString('es-HN')}
              helper="Referencia para soporte y auditoria"
              variant="info"
            />
          </div>
        ) : null}

        {!canViewAdvanced ? (
          <div className="flex items-start gap-2 border border-border bg-card p-4 text-sm text-muted-foreground">
            <Server aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-secondary" />
            <p>El diagnostico tecnico detallado se mantiene reservado para usuarios autorizados.</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function OperationalMetric({ helper, icon, label, value, variant }: { helper: ReactNode; icon: ReactNode; label: string; value: ReactNode; variant?: string }) {
  return (
    <div className="border border-border bg-surface p-4" data-tone={variant}>
      <div aria-hidden="true" className="mb-2 text-secondary">{icon}</div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}
