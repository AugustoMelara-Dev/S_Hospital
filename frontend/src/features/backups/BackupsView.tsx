import { RefreshCw, Archive, HardDrive, Server, ShieldAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { StatGrid } from '@/components/shared';
import { useBackups, useCreateBackup } from '@/hooks/useBackups';
import { useSystemStatusSnapshot } from '@/hooks/useServerStatus';
import { ActionBar } from '../../components/ui/action-bar';
import { Button } from '../../components/ui/button';
import { Alert } from '../../components/ui/alert';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { PaginationControls } from '../../components/ui/pagination';
import { PageHeader } from '../../components/ui/page-header';
import { Card, CardContent } from '../../components/ui/card';
import { ErrorState, LoadingState } from '../../components/ui/states';
import { StatusBadge } from '../../components/ui/status-badge';
import { BackupEmptyState } from './components/BackupExplanationCard';
import { BackupHistoryTable } from './components/BackupHistoryTable';
import { type AuthUser, type BackupLog, type SystemStatus, apiClient, userSafeErrorMessage } from '../../lib/api';
import { formatLocalizedDateTime } from '../../lib/format/formatDate';
import { downloadBlob } from '../../lib/download';
import { safeClientMessage } from '../../lib/support/clientIssueLog';

type BackupsViewProps = {
  user: AuthUser;
  onStatus: (message: string) => void;
};

type StatusFilter = 'all' | 'pending' | 'success' | 'failed';
type OperationalStatus = 'ok' | 'review' | 'error';

function formatBytes(size: number | null): string {
  if (size === null || !Number.isFinite(size) || size < 0) return 'Tamaño no disponible';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  return formatLocalizedDateTime(value);
}

function formatRelativeTime(value: string): string {
  const now = new Date();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Fecha no disponible';
  }

  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'ahora';
  if (diffMins < 60) return `hace ${diffMins}m`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  return `hace ${diffDays}d`;
}

function automaticBackupHeartbeatLabel(
  heartbeat: SystemStatus['backups']['queue']['scheduler_heartbeat'],
): { label: string; tone: 'muted' | 'success' | 'warning' } {
  if (!heartbeat) {
    return { label: 'Respaldos automaticos pendientes de revision', tone: 'warning' };
  }

  if (heartbeat.status === 'ok') {
    return { label: 'Respaldos automaticos activos', tone: 'success' };
  }

  if (heartbeat.status === 'never_run') {
    return { label: 'Respaldos automaticos sin ejecucion registrada', tone: 'warning' };
  }

  if (heartbeat.status === 'stale') {
    return { label: 'Respaldos automaticos atrasados', tone: 'warning' };
  }

  if (heartbeat.status === 'stuck') {
    return { label: 'Respaldos automaticos requieren revision del servidor', tone: 'warning' };
  }

  if (heartbeat.status === 'invalid') {
    return { label: 'Respaldos automaticos con fecha no verificable', tone: 'warning' };
  }

  return { label: 'Respaldos automaticos pendientes de revision', tone: 'muted' };
}

function statusLabel(status: 'pending' | 'partial' | 'validated' | 'manual_required'): string {
  if (status === 'validated') return 'Validado';
  if (status === 'partial') return 'Parcial';
  if (status === 'manual_required') return 'Requiere prueba';
  return 'Pendiente';
}

function statusClass(status: 'pending' | 'partial' | 'validated' | 'manual_required'): string {
  if (status === 'validated') return 'status-success';
  if (status === 'partial') return 'status-info';
  if (status === 'manual_required') return 'status-warning';
  return 'border-destructive/30 bg-destructive/10 text-destructive';
}

function friendlyProductionCheck(code: string, fallback: string): string {
  const labels: Record<string, string> = {
    APP_ENV_PRODUCTION: 'Modo de operación final',
    APP_DEBUG_OFF: 'Mensajes internos ocultos',
    APP_DEBUG_FALSE: 'Mensajes internos ocultos',
    MYSQL_FAMILY: 'Base de datos local correcta',
    MYSQL_FAMILY_DATABASE: 'Base de datos local correcta',
    DUMP_BINARY_AVAILABLE: 'Creación de respaldos disponible',
    STORAGE_WRITABLE: 'Carpeta de respaldos lista',
    BACKUP_STORAGE_WRITABLE: 'Carpeta de respaldos lista',
    BACKUP_WORKER_CONTINUOUS: 'Respaldos automáticos activos',
    DATABASE_MIGRATIONS_CURRENT: 'Base de datos actualizada',
    PUBLIC_ROUTES_AVAILABLE: 'Acceso desde la red local',
    SERVER_LOGS_WRITABLE: 'Registro operativo disponible',
    APP_CACHE_WRITABLE: 'Archivos temporales del sistema listos',
  };

  return labels[code] ?? sanitizeTechnicalText(fallback);
}

function sanitizeTechnicalText(value: string): string {
  return value
    .replace(/APP_ENV|APP_DEBUG|debug|mysqldump|mariadb-dump|php artisan|queue:work|--queue=backups|--tries=1|--timeout=600|HTTP 200|SPA cargada/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Pendiente de revisión.';
}

function friendlyProductionDetail(code: string, fallback: string): string {
  if (code === 'BACKUP_WORKER_CONTINUOUS') {
    return 'Debe estar activo para que los respaldos pendientes se completen.';
  }

  if (code === 'DATABASE_MIGRATIONS_CURRENT') {
    return fallback.includes('pendientes')
      ? 'Requiere respaldo y actualización segura antes de operar reportes.'
      : 'Base de datos actualizada.';
  }

  if (code === 'DUMP_BINARY_AVAILABLE') {
    return 'El servidor puede generar archivos de respaldo.';
  }

  if (code === 'APP_ENV_PRODUCTION' || code === 'APP_DEBUG_OFF' || code === 'APP_DEBUG_FALSE') {
    return 'Este punto se revisa durante la instalación final.';
  }

  if (code === 'MYSQL_FAMILY_DATABASE') {
    return fallback.includes('detectada') ? 'Base de datos local detectada.' : 'Base de datos local pendiente.';
  }

  if (code === 'BACKUP_STORAGE_WRITABLE') {
    return fallback.includes('Disponible') ? 'Carpeta de respaldos lista.' : 'Carpeta de respaldos pendiente.';
  }

  if (code === 'SERVER_LOGS_WRITABLE' || code === 'APP_CACHE_WRITABLE') {
    return fallback.includes('disponible') ? 'Listo para operar.' : 'Requiere revisión técnica.';
  }

  return sanitizeTechnicalText(fallback);
}

function friendlyReadinessBlocker(code: string, fallback: string): string {
  const labels: Record<string, string> = {
    APP_ENV_PRODUCTION: 'Completar modo de operación final',
    APP_DEBUG_OFF: 'Ocultar mensajes internos',
    APP_DEBUG_FALSE: 'Ocultar mensajes internos',
    PENDING_LAN_CLIENT_VALIDATION: 'Confirmar acceso local en este equipo',
    PENDING_HARDWARE_VALIDATION: 'Validar recibo institucional carta, media carta o A5',
    PENDING_RESTORE_VALIDATION: 'Confirmar recuperacion con soporte',
    PENDING_CONCURRENCY_VALIDATION: 'Confirmar flujo de caja local',
    PENDING_ENVIRONMENT_VALIDATION: 'Revisar configuración final del servidor',
    PENDING_DATABASE_MIGRATIONS: 'Actualizar base de datos con respaldo previo',
  };

  return labels[code] ?? sanitizeTechnicalText(fallback);
}

function isLocalAccessValidationNoise(code: string, localAccessReady: boolean): boolean {
  return localAccessReady && (
    code === 'PENDING_LAN_CLIENT_VALIDATION' ||
    code === 'LAN_CLIENT_VALIDATION_PROOF' ||
    code === 'PUBLIC_ROUTES_AVAILABLE'
  );
}

function operationalSummary(status: SystemStatus): { level: OperationalStatus; label: string; description: string; className: string } {
  const latestBackupNotConfirmed = status.backups.last_success_at !== null
    && (
      status.backups.last_success_file_exists === false ||
      status.backups.last_success_checksum_matches === false
    );
  const hasError =
    !status.database.connected ||
    !status.frontend.dist_index_exists ||
    !status.frontend.assets_present ||
    !status.backups.storage.writable ||
    !status.backups.dump_binary.available ||
    latestBackupNotConfirmed ||
    !status.runtime.logs_writable ||
    !status.runtime.cache_writable ||
    (status.backups.queue.failed_jobs_count ?? 0) > 0 ||
    status.backups.last_failure_at !== null;

  if (hasError) {
    return {
      level: 'error',
      label: 'Error',
      description: 'Hay un problema que puede afectar respaldos o continuidad. Pida soporte si no puede resolverlo.',
      className: 'border-destructive/30 bg-destructive/10 text-destructive',
    };
  }

  const localAccessReady = localAccessIsReady(status);
  const needsReview =
    status.backups.pending_count > 0 ||
    status.readiness.blockers.some((blocker) => (
      blocker.status !== 'validated' && !isLocalAccessValidationNoise(blocker.code, localAccessReady)
    )) ||
    status.preflight.production_checks.some((check) => (
      check.status !== 'validated' && !isLocalAccessValidationNoise(check.code, localAccessReady)
    )) ||
    (status.runtime.pending_migration_count ?? 0) > 0 ||
    (!localAccessReady && status.preflight.public_routes.some((route) => route.status !== 'validated')) ||
    status.preflight.physical_proofs.some((proof) => (
      proof.status !== 'validated' && !isLocalAccessValidationNoise(proof.code, localAccessReady)
    ));

  if (needsReview) {
    return {
      level: 'review',
      label: 'Requiere revisi\u00f3n',
      description: 'Falta completar respaldo reciente, validación del recibo o configuración final antes de operar sin supervisión.',
      className: 'status-warning',
    };
  }

  return {
    level: 'ok',
    label: 'Todo bien',
    description: 'Respaldos y chequeos básicos están al día. Mantenga el cierre diario y los respaldos protegidos.',
    className: 'status-success',
  };
}

function operationalStatusBadge(level: OperationalStatus): 'success' | 'pending' | 'failed' {
  if (level === 'ok') return 'success';
  if (level === 'error') return 'failed';
  return 'pending';
}

function safeBackupsErrorMessage(error: unknown, fallback: string): string {
  const message = safeClientMessage(userSafeErrorMessage(error, fallback));

  return message.includes('[redacted]') || message.includes('[ruta-local]') || message.includes('[detalle-tecnico]')
    ? fallback
    : message || fallback;
}

function backupDownloadFilename(backup: BackupLog): string {
  const rawDate = backup.completed_at ?? backup.created_at;
  const date = rawDate.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? 'sin-fecha';

  return `respaldo-local-${date}-${backup.id}.sql.gz.enc`;
}

function backupIntegrityFingerprint(checksum: string | null | undefined): string {
  if (!checksum || !/^[a-f0-9]{64}$/i.test(checksum)) {
    return 'No disponible';
  }

  return checksum.slice(0, 12).toLowerCase();
}

function localAccessIsReady(status: SystemStatus): boolean {
  return status.network.lan_ready || status.network.host_type === 'loopback';
}

function localAccessLabel(status: SystemStatus): string {
  if (localAccessIsReady(status)) {
    return status.network.client_url ?? 'este equipo';
  }

  return 'configurar IP LAN';
}

export function BackupsView({ user, onStatus }: BackupsViewProps) {
  const [page, setPage] = useState(1);
  const [manualError, setManualError] = useState('');
  const [showAdvancedStatus, setShowAdvancedStatus] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);
  const [downloadTarget, setDownloadTarget] = useState<BackupLog | null>(null);
  const [downloadingBackupId, setDownloadingBackupId] = useState<number | null>(null);
  const creatingBackupRef = useRef(false);
  const downloadingBackupRef = useRef<number | null>(null);
  const canCreate = user.permissions.includes('backups.create');
  const canDownload = user.permissions.includes('backups.download');
  const backupsQuery = useBackups({ page, status: statusFilter });
  const createBackupMutation = useCreateBackup();
  const systemStatusQuery = useSystemStatusSnapshot();

  const backupsList = Array.isArray(backupsQuery.data?.data) ? backupsQuery.data.data : [];
  const meta = backupsQuery.data?.meta ?? null;
  const systemStatus = systemStatusQuery.data ?? null;
  const creatingBackup = createBackupMutation.isPending;
  const initialLoading = backupsQuery.isLoading && backupsList.length === 0;
  const busy = backupsQuery.isFetching || systemStatusQuery.isFetching || creatingBackup;
  const backupsQueryError = backupsQuery.isError
    ? safeBackupsErrorMessage(backupsQuery.error, 'No se pudieron cargar los respaldos.')
    : '';
  const systemStatusError = systemStatusQuery.isError
    ? safeBackupsErrorMessage(systemStatusQuery.error, 'No se pudo cargar el estado operativo del servidor.')
    : '';
  const error = manualError || backupsQueryError;

  const visiblePendingCount = backupsList.filter(b => b.status === 'pending').length;
  const pendingCount = systemStatus?.backups.pending_count ?? visiblePendingCount;
  const visibleFailedCount = backupsList.filter(b => b.status === 'failed').length;
  const failedCount = systemStatus?.backups.failed_count ?? visibleFailedCount;

  const lastSuccessBackup = backupsList.find(b => b.status === 'success');
  const lastSuccessAt = systemStatus?.backups.last_success_at
    ?? lastSuccessBackup?.completed_at
    ?? lastSuccessBackup?.created_at
    ?? null;
  const operationalStatus = systemStatus ? operationalSummary(systemStatus) : null;
  const visibleReadinessBlockers = systemStatus
    ? systemStatus.readiness.blockers.filter((blocker) => (
      !isLocalAccessValidationNoise(blocker.code, localAccessIsReady(systemStatus))
    ))
    : [];
  const latestBackupNotConfirmed = systemStatus?.backups.last_success_at
    ? systemStatus.backups.last_success_file_exists === false
      || systemStatus.backups.last_success_checksum_matches === false
    : false;
  const stalePendingCount = systemStatus?.backups.stale_pending_count ?? 0;
  const stalePendingThresholdMinutes = systemStatus?.backups.stale_pending_threshold_minutes ?? 15;
  const automaticBackupHeartbeat = automaticBackupHeartbeatLabel(systemStatus?.backups.queue.scheduler_heartbeat);
  const advancedStatusId = 'backups-advanced-status';

  useEffect(() => {
    if (backupsQuery.isLoading) {
      onStatus('Cargando respaldos locales...');
    }
  }, [backupsQuery.isLoading, onStatus]);

  useEffect(() => {
    if (backupsQuery.isSuccess && !backupsQuery.isFetching) {
      onStatus('Respaldos locales cargados.');
    }
  }, [backupsQuery.isFetching, backupsQuery.isSuccess, backupsQuery.dataUpdatedAt, onStatus]);

  useEffect(() => {
    if (backupsQueryError) {
      onStatus(backupsQueryError);
    }
  }, [backupsQueryError, onStatus]);

  useEffect(() => {
    if (systemStatusError) {
      onStatus(systemStatusError);
    }
  }, [systemStatusError, onStatus]);

  function refreshOperationalStatus() {
    setManualError('');
    onStatus('Actualizando respaldos locales...');
    void backupsQuery.refetch();
    void systemStatusQuery.refetch();
  }

  async function handleCreateBackup() {
    if (creatingBackupRef.current) {
      onStatus('Espere a que termine el respaldo en curso.');
      return;
    }

    creatingBackupRef.current = true;
    setManualError('');
    onStatus('Creando respaldo local...');

    try {
      const backup = await createBackupMutation.mutateAsync();
      setPage(1);
      onStatus(
        backup.status === 'success'
          ? 'Respaldo completado correctamente.'
          : 'Respaldo registrado. Revise su estado en la lista.',
      );
    } catch (error) {
      const message = safeBackupsErrorMessage(error, 'No se pudo crear el respaldo.');
      setManualError(message);
      onStatus(message);
    } finally {
      creatingBackupRef.current = false;
    }
  }

  async function handleDownloadBackup(backup: BackupLog) {
    if (downloadingBackupRef.current !== null) {
      onStatus('Espere a que termine la descarga actual.');
      return;
    }

    downloadingBackupRef.current = backup.id;
    setDownloadingBackupId(backup.id);
    setManualError('');

    try {
      const blob = await apiClient.downloadBackup(backup.id);
      downloadBlob(blob, backupDownloadFilename(backup));
      onStatus('Respaldo descargado correctamente.');
    } catch (error) {
      const message = safeBackupsErrorMessage(error, 'No se pudo descargar el respaldo.');
      setManualError(message);
      onStatus(message);
    } finally {
      downloadingBackupRef.current = null;
      setDownloadingBackupId(null);
    }
  }

  const isEmpty = backupsList.length === 0 && !initialLoading && !error && statusFilter === 'all';
  const showHistory = !initialLoading && !error && (backupsList.length > 0 || statusFilter !== 'all');

  return (
    <section id="backups" aria-labelledby="backups-title">
      <PageHeader
        title="Respaldos"
        description="Copias de seguridad de facturación, caja y reportes"
        actions={
          canCreate ? (
            <ActionBar align="end" fullWidthOnMobile>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={refreshOperationalStatus}
                disabled={busy}
                aria-label="Actualizar respaldos y estado operativo"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4 mr-2" />
                Actualizar
              </Button>
              <Button
                type="button"
                size="sm"
                aria-busy={creatingBackup}
                onClick={() => setConfirmCreateOpen(true)}
                disabled={creatingBackup}
              >
                <Archive aria-hidden="true" className="h-4 w-4 mr-2" />
                {creatingBackup ? 'Creando...' : 'Crear respaldo'}
              </Button>
            </ActionBar>
          ) : undefined
        }
      />

      <div className="space-y-6">
        <Alert title="Restauración no disponible desde la app">
          La restauración de un respaldo se realiza únicamente desde el servidor local por personal autorizado. Si necesita recuperar información, solicite soporte técnico.
        </Alert>

        <section aria-label="Indicadores principales de respaldos">
          <StatGrid
            className="sm:grid-cols-2 xl:grid-cols-3"
            items={[
              {
                label: 'Ultimo exitoso',
                value: lastSuccessAt
                  ? formatRelativeTime(lastSuccessAt)
                  : 'Sin respaldo',
                helper: lastSuccessAt ? 'Respaldo protegido mas reciente' : 'Cree un respaldo local protegido',
                tone: lastSuccessAt ? 'success' : 'warning',
              },
              {
                label: 'Pendientes',
                value: pendingCount,
                helper: pendingCount > 0 ? 'El servidor debe completar estos respaldos' : 'Sin pendientes registrados',
                tone: pendingCount > 0 ? 'warning' : 'success',
              },
              {
                label: 'Fallidos',
                value: failedCount,
                helper: failedCount > 0 ? 'Revise con soporte antes de confiar en respaldos' : 'Sin errores registrados',
                tone: failedCount > 0 ? 'destructive' : 'success',
              },
            ]}
          />
        </section>

        {systemStatusError ? (
          <Alert variant="destructive" title="Estado operativo no disponible">
            {systemStatusError}
          </Alert>
        ) : null}

        {operationalStatus ? (
          <Card className={`${operationalStatus.className} shadow-operational`}>
            <CardContent className="flex flex-col gap-3 pt-6 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-normal">Estado operativo</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold">{operationalStatus.label}</h3>
                  <StatusBadge status={operationalStatusBadge(operationalStatus.level)}>
                    {operationalStatus.level === 'ok' ? 'Correcto' : operationalStatus.level === 'error' ? 'Error' : 'Atencion'}
                  </StatusBadge>
                </div>
                <p className="mt-1 max-w-3xl text-sm leading-6">{operationalStatus.description}</p>
                <p className={`mt-2 text-xs ${
                  automaticBackupHeartbeat.tone === 'success'
                    ? 'text-success-foreground'
                    : automaticBackupHeartbeat.tone === 'warning'
                      ? 'text-warning'
                      : 'text-muted-foreground'
                }`}>
                  {automaticBackupHeartbeat.label}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-controls={advancedStatusId}
                aria-expanded={showAdvancedStatus}
                onClick={() => setShowAdvancedStatus((current) => !current)}
              >
                {showAdvancedStatus ? 'Ocultar detalle de soporte' : 'Ver detalle de soporte'}
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {latestBackupNotConfirmed ? (
          <Alert variant="warning" title="Respaldo reciente no confirmado">
            El ultimo respaldo exitoso registrado no se puede confirmar en el servidor local. Cree un respaldo nuevo antes de confiar en la recuperacion.
          </Alert>
        ) : null}

        {stalePendingCount > 0 ? (
          <Alert title="Respaldos pendientes por demasiado tiempo">
            {stalePendingCount} respaldo(s) siguen pendientes por mas de {stalePendingThresholdMinutes} minutos. Revise el estado del servidor local antes de confiar en la automatizacion.
          </Alert>
        ) : null}

        {systemStatus && showAdvancedStatus ? (
          <div id={advancedStatusId} className="grid grid-cols-1 gap-4 xl:grid-cols-4">
            <Card className={`${systemStatus.database.connected && systemStatus.frontend.dist_index_exists && systemStatus.frontend.assets_present && localAccessIsReady(systemStatus) ? 'status-success' : 'status-warning'} shadow-operational`}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-background/80 p-2.5">
                    <Server aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold">Servidor, datos y red local</p>
                    <p className="text-xs text-muted-foreground">
                      Base de datos: {systemStatus.database.connected ? 'conectada' : 'pendiente'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Interfaz: {systemStatus.frontend.dist_index_exists && systemStatus.frontend.assets_present ? 'lista' : 'requiere build'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Acceso cliente: {localAccessLabel(systemStatus)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {systemStatus.network.guidance}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={`${systemStatus.backups.dump_binary.available && systemStatus.backups.storage.writable ? 'status-success' : 'status-warning'} shadow-operational`}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-background/80 p-2.5">
                    <HardDrive aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold">Preparación de respaldos</p>
                    <p className="text-xs text-muted-foreground">
                      Creación de archivos: {systemStatus.backups.dump_binary.available ? 'lista' : 'pendiente'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Carpeta de respaldo: {systemStatus.backups.storage.writable ? 'lista' : 'pendiente'} · libre {formatBytes(systemStatus.backups.storage.free_bytes)}
                    </p>
                    {systemStatus.backups.last_success_at ? (
                      <p className="text-xs text-muted-foreground">
                        Último protegido: {formatRelativeTime(systemStatus.backups.last_success_at)}
                      </p>
                    ) : (
                      <p className="text-xs text-warning">Sin respaldo protegido registrado.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={`${systemStatus.backups.pending_count > 0 ? 'status-warning' : 'bg-muted/30'} shadow-operational`}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-background/80 p-2.5">
                    <Server aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold">Proceso de respaldo</p>
                    <p className="text-xs text-muted-foreground">
                      Respaldos esperando: {systemStatus.backups.queue.pending_backup_jobs ?? 'pendiente de revisión'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      En proceso registrados: {systemStatus.backups.pending_count}
                    </p>
                    <p className={stalePendingCount > 0 ? 'text-xs text-warning' : 'text-xs text-muted-foreground'}>
                      Atascados: {stalePendingCount}
                    </p>
                    <p className={`text-xs ${
                      automaticBackupHeartbeat.tone === 'success'
                        ? 'text-success-foreground'
                        : automaticBackupHeartbeat.tone === 'warning'
                          ? 'text-warning'
                          : 'text-muted-foreground'
                    }`}>
                      {automaticBackupHeartbeat.label}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="status-info shadow-operational">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-background/80 p-2.5">
                    <ShieldAlert aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold">Estado general</p>
                    <p className="text-xs text-muted-foreground">
                      Instalación: {systemStatus.readiness.production_ready ? 'lista para operar' : 'con pendientes'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Hora del servidor: {formatDate(systemStatus.environment.server_time)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Versión instalada: {systemStatus.environment.app_version}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Zona horaria: {systemStatus.environment.timezone}
                    </p>
                    <p className="text-xs text-info">
                      {systemStatus.readiness.production_ready ? 'Sin pendientes críticos' : 'Faltan pruebas finales'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {visibleReadinessBlockers.length ? (
          <Alert title="Pendientes antes de operar">
            {visibleReadinessBlockers.map((blocker) => friendlyReadinessBlocker(blocker.code, blocker.label)).join(' - ')}
          </Alert>
        ) : null}

        {initialLoading ? (
          <LoadingState label="Cargando respaldos locales..." />
        ) : null}

        {systemStatus && showAdvancedStatus ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-operational-border bg-operational-surface shadow-operational">
              <CardContent className="pt-6">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Checklist operativo</h3>
                    <p className="text-xs text-muted-foreground">
                      Estos puntos ayudan a confirmar que los respaldos y la instalación están listos.
                    </p>
                  </div>
                  <span className="rounded-md border border-info/30 bg-info/10 px-2 py-1 text-xs font-semibold text-info">
                    {systemStatus.readiness.production_ready ? 'Listo' : 'Pendiente'}
                  </span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {systemStatus.preflight.production_checks.map((check) => (
                    <div key={check.code} className="rounded-md border border-border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium">{friendlyProductionCheck(check.code, check.label)}</p>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(check.status)}`}>
                          {statusLabel(check.status)}
                        </span>
                      </div>
                      <p className="mt-1 break-words text-xs text-muted-foreground">{friendlyProductionDetail(check.code, check.detail)}</p>
                    </div>
                  ))}
                  <div className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">Estado de datos</p>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        systemStatus.runtime.pending_migration_count === null
                          ? 'border-warning/30 bg-warning/10 text-warning'
                          : systemStatus.runtime.pending_migration_count > 0
                            ? 'border-destructive/30 bg-destructive/10 text-destructive'
                            : 'border-success/30 bg-success/10 text-success-foreground'
                      }`}>
                        {systemStatus.runtime.pending_migration_count === null
                          ? 'Sin dato'
                          : systemStatus.runtime.pending_migration_count > 0
                            ? 'Requiere revisión'
                            : 'Actualizada'}
                      </span>
                    </div>
                    <p className="mt-1 break-words text-xs text-muted-foreground">
                      {systemStatus.runtime.pending_migration_count === null
                        ? 'No se pudo verificar el estado de la base de datos.'
                        : systemStatus.runtime.pending_migration_count > 0
                          ? 'Haga respaldo y pida soporte para actualizar antes de revisar reportes.'
                          : `Migraciones aplicadas: ${systemStatus.runtime.migration_count ?? 0}.`}
                    </p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">Tareas con problema</p>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${systemStatus.backups.queue.failed_jobs_count ? 'border-warning/30 bg-warning/10 text-warning' : 'border-success/30 bg-success/10 text-success-foreground'}`}>
                        {systemStatus.backups.queue.failed_jobs_count ?? 'Sin dato'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Si aparece un número mayor a cero, revise el último respaldo con error.
                    </p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">Registro operativo</p>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${systemStatus.runtime.laravel_log.exists ? 'border-info/30 bg-info/10 text-info' : 'border-warning/30 bg-warning/10 text-warning'}`}>
                        {systemStatus.runtime.laravel_log.exists ? formatBytes(systemStatus.runtime.laravel_log.size_bytes) : 'no existe'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Última actividad: {systemStatus.runtime.laravel_log.modified_at ? formatDate(systemStatus.runtime.laravel_log.modified_at) : 'sin registro'}
                    </p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">Actividad de respaldos</p>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${systemStatus.runtime.backup_automation_log.exists ? 'border-info/30 bg-info/10 text-info' : 'border-warning/30 bg-warning/10 text-warning'}`}>
                        {systemStatus.runtime.backup_automation_log.exists ? formatBytes(systemStatus.runtime.backup_automation_log.size_bytes) : 'no existe'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Si no hay actividad reciente, pida revisar los respaldos automáticos.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-operational-border bg-operational-surface shadow-operational">
              <CardContent className="pt-6">
                <h3 className="text-sm font-semibold">Pruebas de campo obligatorias</h3>
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Prueba en red local</p>
                    <ul className="mt-2 space-y-2">
                      {systemStatus.preflight.public_routes.map((route) => (
                        <li key={route.path} className="flex items-start justify-between gap-3 rounded-md border border-border p-2">
                          <span>
                            <span className="block text-sm font-medium">
                              {route.path === '/up' ? 'Servidor responde' : route.path === '/login' ? 'Pantalla de ingreso abre' : 'Pantalla de verificación abre'}
                            </span>
                            <span className="text-xs text-muted-foreground">{route.expected}</span>
                          </span>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(route.status)}`}>
                            {statusLabel(route.status)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Pruebas físicas</p>
                    <ul className="mt-2 space-y-2">
                      {systemStatus.preflight.physical_proofs.map((proof) => (
                        <li key={proof.code} className="rounded-md border border-border p-2">
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-sm font-medium">{proof.label}</span>
                            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(proof.status)}`}>
                              {statusLabel(proof.status)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{proof.detail}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {error ? (
          <ErrorState
            title="Error al cargar respaldos"
            message={error}
            onRetry={() => {
              setManualError('');
              void backupsQuery.refetch();
            }}
            retryLabel="Reintentar carga"
          />
        ) : null}

        {showHistory && (
          <div className="space-y-4">

            <BackupHistoryTable
              backups={backupsList}
              canDownload={canDownload}
              downloadingBackupId={downloadingBackupId}
              onDownloadRequest={setDownloadTarget}
              onStatusFilterChange={(filter) => {
                setStatusFilter(filter);
                setPage(1);
              }}
              statusFilter={statusFilter}
            />

            {meta ? (
              <PaginationControls loading={busy} meta={meta} onPageChange={setPage} />
            ) : null}
          </div>
        )}

        {isEmpty && (
          <BackupEmptyState canCreate={canCreate} />
        )}
      </div>
      <ConfirmDialog
        confirmDisabled={creatingBackup}
        cancelDisabled={creatingBackup}
        confirmLabel={creatingBackup ? 'Creando...' : 'Crear respaldo'}
        onCancel={() => setConfirmCreateOpen(false)}
        onConfirm={() => {
          setConfirmCreateOpen(false);
          void handleCreateBackup();
        }}
        open={confirmCreateOpen}
        title="¿Crear respaldo local?"
      >
        Se creará una copia de seguridad local. Confirme que aparezca como protegida antes de cerrar esta pantalla.
      </ConfirmDialog>
      <ConfirmDialog
        confirmDisabled={downloadTarget ? downloadingBackupId === downloadTarget.id : false}
        cancelDisabled={downloadTarget ? downloadingBackupId === downloadTarget.id : false}
        confirmLabel={downloadTarget && downloadingBackupId === downloadTarget.id ? 'Descargando...' : 'Descargar'}
        onCancel={() => setDownloadTarget(null)}
        onConfirm={() => {
          const target = downloadTarget;
          setDownloadTarget(null);
          if (target) void handleDownloadBackup(target);
        }}
        open={Boolean(downloadTarget)}
        title="¿Descargar respaldo?"
      >
        <div className="space-y-3 text-sm">
          <p>Descargará el respaldo seleccionado. Esta acción queda auditada.</p>
          {downloadTarget ? (
            <dl className="grid gap-2 rounded-md border border-border bg-muted/35 p-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Fecha</dt>
                <dd className="font-semibold">{formatDate(downloadTarget.completed_at ?? downloadTarget.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Tamaño</dt>
                <dd className="font-semibold">{formatBytes(downloadTarget.size_bytes)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Verificacion</dt>
                <dd className="font-semibold">{backupIntegrityFingerprint(downloadTarget.checksum_sha256)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-muted-foreground">Usuario</dt>
                <dd className="font-semibold">{downloadTarget.creator?.name ?? 'Sistema'}</dd>
              </div>
            </dl>
          ) : null}
        </div>
      </ConfirmDialog>
    </section>
  );
}
