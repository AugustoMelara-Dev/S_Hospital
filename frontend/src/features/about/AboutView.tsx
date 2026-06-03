import { useEffect, useState } from 'react';
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
