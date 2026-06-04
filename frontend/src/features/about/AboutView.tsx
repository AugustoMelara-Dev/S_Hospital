import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Building2, Clock3, HardDrive, HeartHandshake, MonitorCheck, Network, ShieldCheck } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { useFiscalSettings } from '../../hooks/useFiscalSettings';
import { useServerStatus } from '../../hooks/useServerStatus';
import { type AuthUser, type SystemStatus, apiClient, userSafeErrorMessage } from '../../lib/api';
import { displayHospitalName } from '../../lib/hospital-name';

type AboutViewProps = {
  user: AuthUser;
  onStatus: (message: string) => void;
};

type AdminDiagnosticItem = {
  label: string;
  value: string;
  level: 'ok' | 'review' | 'error';
};

type AdminHealthMetric = {
  label: string;
  value: string;
  level: 'ok' | 'review' | 'error';
  chartValue: number;
  detail: string;
};

export function AboutView({ user, onStatus }: AboutViewProps) {
  const { data: fiscal } = useFiscalSettings();
  const { checking, isOnline, lastCheck, summary } = useServerStatus();
  const [backupCount, setBackupCount] = useState<number | string>('...');
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [systemStatusError, setSystemStatusError] = useState('');
  const hospitalName = displayHospitalName(fiscal?.hospital_name);
  const canViewAdminDiagnostics = user.permissions.includes('system.status.view');

  useEffect(() => {
    async function fetchBackupCount() {
      try {
        const backupsData = await apiClient.getBackups();
        setBackupCount(Array.isArray(backupsData.data) ? backupsData.data.length : 0);
      } catch {
        setBackupCount('Sin dato');
      }
    }

    void fetchBackupCount();
  }, []);

  useEffect(() => {
    if (!canViewAdminDiagnostics) {
      setSystemStatus(null);
      setSystemStatusError('');
      return;
    }

    async function fetchSystemStatus() {
      setSystemStatusError('');

      try {
        setSystemStatus(await apiClient.getSystemStatus());
      } catch (error) {
        setSystemStatus(null);
        setSystemStatusError(userSafeErrorMessage(error, 'No se pudo cargar el diagnostico administrativo.'));
      }
    }

    void fetchSystemStatus();
  }, [canViewAdminDiagnostics]);

  const triggerDiagnosticTest = () => {
    onStatus('Revisando conexion local...');
    window.setTimeout(() => {
      onStatus(checking ? 'Revision local en curso.' : `${summary.label}: ${summary.description}`);
    }, 1000);
  };

  return (
    <section id="about" className="flex flex-col gap-6" aria-labelledby="about-title">
      <PageHeader
        title="Informacion del sistema"
        description="Estado general de operacion local, respaldos y soporte."
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-start gap-4 pb-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-xl font-bold">{hospitalName}</CardTitle>
                <Badge variant="success">Activo</Badge>
              </div>
              <CardDescription>Sistema de caja y facturacion hospitalaria local.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Disenado para operar dentro del hospital con facturacion, caja, reportes,
              recibos institucionales y respaldos locales.
            </p>

            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <h3 className="mb-2 text-sm font-semibold text-foreground">Operacion local</h3>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">Sistema disponible en la red del hospital</p>
                  <p className="text-xs text-muted-foreground">Uso local para caja, facturacion, reportes y respaldos.</p>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-success/20 bg-success/10 px-2.5 py-1 text-xs font-bold text-success">
                  <ShieldCheck className="h-4 w-4" />
                  Activa
                </div>
              </div>

              <div className="mt-4 border-t border-border pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Resumen operativo</p>
                  <Badge variant={summaryBadgeVariant(summary.level)}>{summary.label}</Badge>
                </div>
                <p className="mt-2 text-sm text-foreground">{summary.description}</p>
              </div>
            </div>

            <Button type="button" onClick={triggerDiagnosticTest} variant="secondary" size="sm">
              Revisar conexion local
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold">Estado local</CardTitle>
            <CardDescription>Senales utiles para soporte del hospital.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border-b border-border py-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Servidor local</span>
              <Badge variant={isOnline ? 'success' : 'destructive'}>
                {isOnline ? 'Conectado' : 'Desconectado'}
              </Badge>
            </div>

            <div className="flex items-center justify-between border-b border-border py-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Diagnostico</span>
              <Badge variant={summaryBadgeVariant(summary.level)}>{summary.label}</Badge>
            </div>

            <div className="flex items-center justify-between border-b border-border py-1.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <HardDrive className="h-3.5 w-3.5" /> Respaldos
              </span>
              <span className="text-xs font-bold text-foreground">{backupCount}</span>
            </div>

            <div className="pt-2 text-center text-[11px] text-muted-foreground">
              Ultima revision: {lastCheck ? lastCheck.toLocaleTimeString() : 'pendiente'}
            </div>
          </CardContent>
        </Card>
      </div>

      {canViewAdminDiagnostics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <MonitorCheck className="h-5 w-5 text-secondary" /> Diagnostico administrativo
            </CardTitle>
            <CardDescription>Lectura resumida para soporte local, sin claves ni rutas internas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {systemStatusError ? (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                {systemStatusError}
              </div>
            ) : systemStatus ? (
              <>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {adminDiagnosticItems(systemStatus).map((item) => (
                    <div key={item.label} className="rounded-md border border-border bg-muted/30 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{item.label}</p>
                        <Badge variant={summaryBadgeVariant(item.level)}>{diagnosticLevelLabel(item.level)}</Badge>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-foreground">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                  <div className="flex items-start gap-2 rounded-md border border-border bg-card p-3">
                    <Clock3 className="mt-0.5 h-4 w-4 text-secondary" />
                    <span>Hora del servidor: {formatServerTime(systemStatus.environment.server_time, systemStatus.environment.timezone)}</span>
                  </div>
                  <div className="flex items-start gap-2 rounded-md border border-border bg-card p-3">
                    <HardDrive className="mt-0.5 h-4 w-4 text-secondary" />
                    <span>Espacio libre para respaldos: {formatBytes(systemStatus.backups.storage.free_bytes)}</span>
                  </div>
                  <div className="flex items-start gap-2 rounded-md border border-border bg-card p-3">
                    <Network className="mt-0.5 h-4 w-4 text-secondary" />
                    <span>Acceso LAN: {systemStatus.network.client_url ?? 'pendiente de configurar'}</span>
                  </div>
                </div>

                <AdminHealthDashboard status={systemStatus} />
              </>
            ) : (
              <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                Cargando diagnostico administrativo...
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <HeartHandshake className="h-5 w-5 text-secondary" /> Soporte
          </CardTitle>
          <CardDescription>Informacion para continuidad operativa.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 text-sm text-muted-foreground sm:grid-cols-2">
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Continuidad de caja</p>
            <p>Ante una incidencia, contacte al responsable del sistema antes de seguir facturando.</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Respaldos</p>
            <p>Confirme respaldos completados y conserve una copia externa cuando corresponda.</p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function AdminHealthDashboard({ status }: { status: SystemStatus }) {
  const metrics = adminHealthMetrics(status);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
      <Card className="border-border bg-card shadow-none">
        <CardHeader>
          <CardTitle className="text-base font-bold">Pulso operativo administrativo</CardTitle>
          <CardDescription>Lectura visual de respaldos, cola, disco y tareas locales.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] min-w-px">
            <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={220}>
              <BarChart data={metrics} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.6} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval={0} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} width={36} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-card)',
                    borderColor: 'var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-foreground)',
                    fontSize: '12px',
                  }}
                  formatter={(value) => [value, 'Indicador']}
                  labelFormatter={(label) => String(label)}
                />
                <Bar dataKey="chartValue" fill="var(--color-secondary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-muted/30 shadow-none">
        <CardHeader>
          <CardTitle className="text-base font-bold">Lectura para soporte</CardTitle>
          <CardDescription>Revise estos puntos antes de cerrar una incidencia.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-md border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{metric.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
                </div>
                <Badge variant={summaryBadgeVariant(metric.level)}>{diagnosticLevelLabel(metric.level)}</Badge>
              </div>
              <p className="mt-2 text-sm font-bold text-foreground">{metric.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function summaryBadgeVariant(level: 'ok' | 'review' | 'error'): 'success' | 'warning' | 'destructive' {
  if (level === 'ok') {
    return 'success';
  }

  if (level === 'review') {
    return 'warning';
  }

  return 'destructive';
}

function diagnosticLevelLabel(level: 'ok' | 'review' | 'error'): string {
  if (level === 'ok') return 'Todo bien';
  if (level === 'review') return 'Revisar';
  return 'Error';
}

function adminDiagnosticItems(status: SystemStatus): AdminDiagnosticItem[] {
  return [
    {
      label: 'Backend',
      value: 'Servidor activo',
      level: 'ok',
    },
    {
      label: 'Base de datos',
      value: status.database.connected ? 'Conectada' : 'No responde',
      level: status.database.connected ? 'ok' : 'error',
    },
    {
      label: 'Interfaz web',
      value: status.frontend.dist_index_exists && status.frontend.assets_present ? 'Compilada y disponible' : 'Falta build de frontend',
      level: status.frontend.dist_index_exists && status.frontend.assets_present ? 'ok' : 'review',
    },
    {
      label: 'Ultimo respaldo',
      value: status.backups.last_success_at ? formatServerTime(status.backups.last_success_at) : 'Sin respaldo protegido reciente',
      level: status.backups.last_success_at ? 'ok' : 'review',
    },
    {
      label: 'Cola de trabajos',
      value: queueLabel(status),
      level: queueLevel(status),
    },
    {
      label: 'Version instalada',
      value: status.environment.app_version || 'local',
      level: 'ok',
    },
    {
      label: 'Red local',
      value: status.network.lan_ready ? 'Direccion LAN configurada' : 'Falta direccion LAN',
      level: status.network.lan_ready ? 'ok' : 'review',
    },
    {
      label: 'Migraciones',
      value: (status.runtime.pending_migration_count ?? 0) === 0 ? 'Base actualizada' : 'Requiere actualizacion segura',
      level: (status.runtime.pending_migration_count ?? 0) === 0 ? 'ok' : 'review',
    },
  ];
}

function adminHealthMetrics(status: SystemStatus): AdminHealthMetric[] {
  const failedJobs = status.backups.queue.failed_jobs_count ?? 0;
  const pendingBackupJobs = status.backups.queue.pending_backup_jobs ?? 0;
  const pendingBackups = status.backups.pending_count + pendingBackupJobs;
  const pendingMigrations = status.runtime.pending_migration_count ?? 0;
  const freeBytes = status.backups.storage.free_bytes;
  const freeGb = freeBytes === null ? null : freeBytes / (1024 * 1024 * 1024);
  const heartbeat = status.backups.queue.scheduler_heartbeat;
  const heartbeatAgeMinutes = heartbeat.age_seconds === null ? null : Math.round(heartbeat.age_seconds / 60);

  return [
    {
      label: 'Respaldos',
      value: pendingBackups === 0 ? 'Sin respaldos pendientes' : `${pendingBackups} pendiente(s)`,
      level: pendingBackups === 0 ? 'ok' : 'review',
      chartValue: pendingBackups,
      detail: 'Cuenta respaldos en espera o en proceso antes de cerrar caja.',
    },
    {
      label: 'Fallas',
      value: failedJobs === 0 ? 'Sin trabajos fallidos' : `${failedJobs} trabajo(s) fallidos`,
      level: failedJobs === 0 ? 'ok' : 'error',
      chartValue: failedJobs,
      detail: 'Si sube de cero, genere paquete de soporte antes de reintentar.',
    },
    {
      label: 'Scheduler',
      value: schedulerHeartbeatLabel(heartbeat.status, heartbeatAgeMinutes),
      level: schedulerHeartbeatLevel(heartbeat.status),
      chartValue: heartbeat.age_seconds === null ? 0 : Math.min(heartbeat.age_seconds, 3600),
      detail: 'Indica si la tarea local que dispara respaldos sigue reportando actividad.',
    },
    {
      label: 'Disco',
      value: freeGb === null ? 'Sin dato de espacio' : `${freeGb.toFixed(1)} GB libres`,
      level: diskLevel(freeGb),
      chartValue: freeGb === null ? 0 : Math.round(freeGb),
      detail: 'Espacio disponible donde se guardan respaldos locales.',
    },
    {
      label: 'Base',
      value: pendingMigrations === 0 ? 'Base actualizada' : `${pendingMigrations} migracion(es) pendiente(s)`,
      level: pendingMigrations === 0 ? 'ok' : 'review',
      chartValue: pendingMigrations,
      detail: 'Si hay pendientes, haga respaldo y actualizacion segura antes de operar.',
    },
  ];
}

function schedulerHeartbeatLevel(status: SystemStatus['backups']['queue']['scheduler_heartbeat']['status']): 'ok' | 'review' | 'error' {
  if (status === 'ok') return 'ok';
  if (status === 'stuck' || status === 'invalid') return 'error';
  return 'review';
}

function schedulerHeartbeatLabel(
  status: SystemStatus['backups']['queue']['scheduler_heartbeat']['status'],
  ageMinutes: number | null,
): string {
  if (status === 'ok') return ageMinutes === null ? 'Actividad reciente' : `Activo hace ${ageMinutes} min`;
  if (status === 'stale') return ageMinutes === null ? 'Requiere revision' : `Sin pulso reciente: ${ageMinutes} min`;
  if (status === 'stuck') return ageMinutes === null ? 'Detenido' : `Posible detencion: ${ageMinutes} min`;
  if (status === 'invalid') return 'Pulso invalido';
  return 'Sin pulso registrado';
}

function diskLevel(freeGb: number | null): 'ok' | 'review' | 'error' {
  if (freeGb === null) return 'review';
  if (freeGb < 1) return 'error';
  if (freeGb < 5) return 'review';
  return 'ok';
}

function queueLabel(status: SystemStatus): string {
  const failed = status.backups.queue.failed_jobs_count ?? 0;
  const pending = status.backups.queue.pending_backup_jobs ?? 0;

  if (failed > 0) return `${failed} trabajo(s) fallidos`;
  if (pending > 0) return `${pending} respaldo(s) en espera`;
  return 'Sin fallas registradas';
}

function queueLevel(status: SystemStatus): 'ok' | 'review' | 'error' {
  if ((status.backups.queue.failed_jobs_count ?? 0) > 0) return 'error';
  if ((status.backups.queue.pending_backup_jobs ?? 0) > 0) return 'review';
  return 'ok';
}

function formatServerTime(value: string | null, timezone?: string): string {
  if (!value) return 'Sin dato';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Sin dato';
  }

  const formatted = new Intl.DateTimeFormat('es-HN', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  return timezone ? `${formatted} (${timezone})` : formatted;
}

function formatBytes(size: number | null): string {
  if (size === null) return 'Sin dato';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
