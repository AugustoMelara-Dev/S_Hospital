import { AlertTriangle, CheckCircle2, Clock3, Database, HardDrive, RefreshCw, Server, XCircle } from 'lucide-react';
import { ActionBar } from '../../../components/ui/action-bar';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { MetricCard } from '../../../components/ui/metric-card';
import { StatusBadge } from '../../../components/ui/status-badge';
import { LoadingState } from '../../../components/ui/states';
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
  if (severity === 'error') return 'failed';
  return 'pending';
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

  if (loading && !summary) {
    return <LoadingState label="Cargando diagnostico operativo..." />;
  }

  return (
    <Card>
      <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <CardTitle>Estado operativo</CardTitle>
          <CardDescription>
            {summary?.summary.action ?? 'Cargando verificacion comprensible para el personal de turno.'}
          </CardDescription>
        </div>
        <ActionBar className="shrink-0" fullWidthOnMobile>
          <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={loading} aria-label="Actualizar diagnostico operativo">
            <RefreshCw aria-hidden="true" className="size-4" />
            Actualizar
          </Button>
        </ActionBar>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-border bg-muted/30 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <Icon className={iconClass(severity)} aria-hidden="true" />
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {summary?.summary.label ?? 'Diagnostico cargando'}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {summary ? `${summary.summary.problem_count} alerta(s) operativa(s) detectada(s).` : 'La guia diaria sigue disponible mientras se carga el diagnostico.'}
                </p>
              </div>
            </div>
            <StatusBadge status={statusForSeverity(severity)}>{statusLabelForSeverity(severity)}</StatusBadge>
          </div>

          {summary ? (
            <ul className="mt-4 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
              {summary.checks.map((check) => (
                <li key={check.code} className="rounded-md border border-border bg-card p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="font-medium text-foreground">{check.label}</span>
                    <StatusBadge status={check.status === 'validated' ? 'success' : check.status === 'error' ? 'failed' : 'pending'}>
                      {statusLabels[check.status]}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 break-words leading-6">{check.detail}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {canViewAdvanced && status ? (
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard
              icon={<HardDrive />}
              label="Ultimo respaldo"
              value={status.backups.last_success_filename ?? 'Pendiente'}
              helper="Archivo protegido mas reciente"
              variant={status.backups.last_success_filename ? 'success' : 'warning'}
            />
            <MetricCard
              icon={<Database />}
              label="Base de datos"
              value={status.database.is_mysql_family ? 'MySQL/MariaDB' : 'Revisar'}
              helper="Motor reportado por el servidor local"
              variant={status.database.is_mysql_family ? 'success' : 'warning'}
            />
            <MetricCard
              icon={<Clock3 />}
              label="Hora servidor"
              value={new Date(status.environment.server_time).toLocaleString('es-HN')}
              helper="Referencia para soporte y auditoria"
              variant="info"
            />
          </div>
        ) : null}

        {!canViewAdvanced ? (
          <div className="flex items-start gap-2 rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
            <Server aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-secondary" />
            <p>El diagnostico tecnico detallado se mantiene reservado para usuarios autorizados.</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
