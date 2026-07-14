import { BuildOutlined as MonitorCheck, ClockCircleOutlined as Clock3, HddOutlined as HardDrive, HeartOutlined as HeartHandshake, HomeOutlined as Building2, SafetyCertificateOutlined as ShieldCheck, WifiOutlined as Network } from '@ant-design/icons';
import { Button, Card, Flex, Tag, Typography } from 'antd';
import { useBackups } from '../../hooks/useBackups';
import { usePublicBranding } from '../../hooks/useFiscalSettings';
import { useServerStatus, useSystemStatusSnapshot } from '../../hooks/useServerStatus';
import { type AuthUser, type SystemStatus, userSafeErrorMessage } from '../../lib/api';
import { displayHospitalName } from '../../lib/hospital-name';
import { PageHeader } from '@/design-system/components/PageHeader';

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
  const { data: fiscal } = usePublicBranding();
  const { checking, isOnline, lastCheck, summary } = useServerStatus();
  const hospitalName = displayHospitalName(fiscal?.hospital_name);
  const canViewAdminDiagnostics = user.roles.includes('admin');
  const canViewBackups = user.permissions.includes('backups.view');
  const backupsQuery = useBackups({ page: 1, perPage: 1, enabled: canViewBackups });
  const systemStatusQuery = useSystemStatusSnapshot(canViewAdminDiagnostics);
  const backupCount = !canViewBackups ? 'Sin permiso' : backupsQuery.isError ? 'Sin dato' : (backupsQuery.data?.meta.total ?? '...');
  const systemStatus = canViewAdminDiagnostics ? (systemStatusQuery.data ?? null) : null;
  const systemStatusError = systemStatusQuery.isError
    ? userSafeErrorMessage(systemStatusQuery.error, 'No se pudo cargar el diagnóstico administrativo.')
    : '';

  const triggerDiagnosticTest = () => {
    onStatus('Revisando conexion local...');
    window.setTimeout(() => {
      onStatus(checking ? 'Revision local en curso.' : `${summary.label}: ${summary.description}`);
    }, 1000);
  };

  return (
    <section id="about" className="flex flex-col gap-6" aria-label="Informacion del sistema">
      <PageHeader
        title="Informacion del sistema"
        description="Identidad del hospital, estado de la red local, continuidad operativa y diagnóstico autorizado."
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="overflow-hidden md:col-span-2">
          <div className="mb-4 flex flex-row items-start gap-4 pb-4">
            <div className="flex size-12 items-center justify-center bg-secondary/10 text-secondary">
              <Building2 aria-hidden="true" className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Typography.Title level={2} className="text-xl font-bold">{hospitalName}</Typography.Title>
                <Tag>Activo</Tag>
              </div>
              <Typography.Text type="secondary">Sistema de caja y facturacion hospitalaria local.</Typography.Text>
            </div>
          </div>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              Disenado para operar dentro del hospital con facturacion, caja, reportes,
              recibos institucionales y respaldos locales.
            </p>

            <div className="border border-border p-5">
              <h3 className="mb-2 text-sm font-semibold text-foreground">Operación local</h3>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">Sistema disponible en la red del hospital</p>
                  <p className="text-xs text-muted-foreground">Uso local para caja, facturacion, reportes y respaldos.</p>
                </div>
                <Tag icon={<ShieldCheck aria-hidden="true" />}>Activa</Tag>
              </div>

              <div className="mt-4 border-t border-border pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Resumen operativo</p>
                  <Tag>{summary.label}</Tag>
                </div>
                <p className="mt-2 text-sm text-foreground">{summary.description}</p>
              </div>
            </div>

            <Flex gap="small" wrap>
              <Button htmlType="button" onClick={triggerDiagnosticTest} size="small">
                Revisar conexion local
              </Button>
            </Flex>
          </div>
        </Card>

        <Card>
          <div className="mb-4">
            <Typography.Title level={2} className="text-base font-bold">Estado local</Typography.Title>
            <Typography.Text type="secondary">Senales utiles para soporte del hospital.</Typography.Text>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border py-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Servidor local</span>
              <Tag>
                {isOnline ? 'Conectado' : 'Desconectado'}
              </Tag>
            </div>

            <div className="flex items-center justify-between border-b border-border py-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Diagnostico</span>
              <Tag>{summary.label}</Tag>
            </div>

            <div className="flex items-center justify-between border-b border-border py-1.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <HardDrive aria-hidden="true" className="h-3.5 w-3.5" /> Respaldos
              </span>
              <span className="text-xs font-bold text-foreground">{backupCount}</span>
            </div>

            <div className="pt-2 text-center text-xs text-muted-foreground">
              Última revisión: {lastCheck ? lastCheck.toLocaleTimeString() : 'pendiente'}
            </div>
          </div>
        </Card>
      </div>

      {canViewAdminDiagnostics && (
        <Card>
          <div className="mb-4">
            <Typography.Title level={2} className="flex items-center gap-2 text-base font-bold">
              <MonitorCheck aria-hidden="true" className="h-5 w-5 text-secondary" /> Diagnostico administrativo
            </Typography.Title>
            <Typography.Text type="secondary">Lectura resumida para soporte local, sin claves ni rutas internas.</Typography.Text>
          </div>
          <div className="space-y-4">
            {systemStatusError ? (
              <div className="border p-4 text-sm text-destructive">
                {systemStatusError}
              </div>
            ) : systemStatus ? (
              <>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {adminDiagnosticItems(systemStatus).map((item) => (
                    <div key={item.label} className="border border-border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{item.label}</p>
                        <Tag>{diagnosticLevelLabel(item.level)}</Tag>
                      </div>
                      <p className="mt-2 break-words text-sm font-semibold text-foreground">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                  <div className="flex items-start gap-2 border border-border bg-card p-4">
                    <Clock3 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                    <span className="break-words">Hora del servidor: {formatServerTime(systemStatus.environment.server_time, systemStatus.environment.timezone)}</span>
                  </div>
                  <div className="flex items-start gap-2 border border-border bg-card p-4">
                    <HardDrive aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                    <span className="break-words">Espacio libre para respaldos: {formatBytes(systemStatus.backups.storage.free_bytes)}</span>
                  </div>
                  <div className="flex items-start gap-2 border border-border bg-card p-4">
                    <Network aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                    <span className="break-words">{networkAccessLabel(systemStatus)}: {networkAccessUrl(systemStatus)}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="border border-border p-4 text-sm text-muted-foreground">
                Cargando diagnóstico administrativo...
              </div>
            )}
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-4">
          <Typography.Title level={2} className="flex items-center gap-2 text-base font-bold">
            <HeartHandshake aria-hidden="true" className="h-5 w-5 text-secondary" /> Soporte
          </Typography.Title>
          <Typography.Text type="secondary">Informacion para continuidad operativa.</Typography.Text>
        </div>
        <div className="grid grid-cols-1 gap-4 text-sm text-muted-foreground sm:grid-cols-2">
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Continuidad de caja</p>
            <p>Ante una incidencia, contacte al responsable del sistema antes de seguir facturando.</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Respaldos</p>
            <p>Confirme respaldos completados y conserve una copia externa cuando corresponda.</p>
          </div>
        </div>
      </Card>
    </section>
  );
}

function diagnosticLevelLabel(level: 'ok' | 'review' | 'error'): string {
  if (level === 'ok') return 'Todo bien';
  if (level === 'review') return 'Revisar';
  return 'Error';
}

function adminDiagnosticItems(status: SystemStatus): AdminDiagnosticItem[] {
  const latestBackupConfirmed = status.backups.last_success_at
    ? status.backups.last_success_file_exists !== false
      && status.backups.last_success_checksum_matches !== false
    : false;
  const backupValue = !status.backups.last_success_at
    ? 'Sin respaldo protegido reciente'
    : latestBackupConfirmed
      ? formatServerTime(status.backups.last_success_at)
      : 'Respaldo no confirmado';

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
      value: backupValue,
      level: latestBackupConfirmed ? 'ok' : 'review',
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
      label: 'Modo de acceso',
      value: networkModeLabel(status),
      level: networkLevel(status),
    },
    {
      label: 'Direccion de acceso',
      value: networkAddressLabel(status),
      level: networkLevel(status),
    },
    {
      label: 'Migraciones',
      value: (status.runtime.pending_migration_count ?? 0) === 0 ? 'Base actualizada' : 'Requiere actualizacion segura',
      level: (status.runtime.pending_migration_count ?? 0) === 0 ? 'ok' : 'review',
    },
  ];
}

function isSingleMachineMode(status: SystemStatus): boolean {
  return status.network.host_type === 'loopback';
}

function networkModeLabel(status: SystemStatus): string {
  if (isSingleMachineMode(status)) return 'Modo monocomputadora';
  if (status.network.lan_ready) return 'Modo multi-PC LAN';
  return 'Modo pendiente de configurar';
}

function networkAddressLabel(status: SystemStatus): string {
  if (isSingleMachineMode(status)) return 'Direccion local configurada';
  if (status.network.lan_ready) return 'Direccion LAN configurada';
  return 'Falta direccion de acceso';
}

function networkLevel(status: SystemStatus): 'ok' | 'review' {
  if (isSingleMachineMode(status) || status.network.lan_ready) return 'ok';
  return 'review';
}

function networkAccessLabel(status: SystemStatus): string {
  return isSingleMachineMode(status) ? 'Acceso local' : 'Acceso LAN';
}

function networkAccessUrl(status: SystemStatus): string {
  return status.network.client_url ?? status.environment.app_url ?? 'pendiente de configurar';
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
