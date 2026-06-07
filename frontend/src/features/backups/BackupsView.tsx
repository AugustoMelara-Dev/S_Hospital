import { Download, RefreshCw, Archive, CheckCircle, Clock, XCircle, HardDrive, Server, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Alert } from '../../components/ui/alert';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { PaginationControls } from '../../components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/data-table';
import { PageHeader } from '../../components/ui/page-header';
import { Card, CardContent } from '../../components/ui/card';
import { BackupStatusBadge, getStatusDescription } from './components/BackupStatusBadge';
import { BackupExplanationCard, BackupEmptyState } from './components/BackupExplanationCard';
import { type AuthUser, type BackupLog, type PaginatedMeta, type SystemStatus, apiClient, userSafeErrorMessage } from '../../lib/api';
import { formatLocalizedDateTime } from '../../lib/format/formatDate';
import { backupDisplayName } from '../../lib/backupLabels';

type BackupsViewProps = {
  user: AuthUser;
  onStatus: (message: string) => void;
};

type StatusFilter = 'all' | 'pending' | 'success' | 'failed';
type OperationalStatus = 'ok' | 'review' | 'error';

function formatBytes(size: number | null): string {
  if (size === null) return '—';
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
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'ahora';
  if (diffMins < 60) return `hace ${diffMins}m`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  return `hace ${diffDays}d`;
}

function statusLabel(status: 'pending' | 'partial' | 'validated' | 'manual_required'): string {
  if (status === 'validated') return 'Validado';
  if (status === 'partial') return 'Parcial';
  if (status === 'manual_required') return 'Requiere prueba';
  return 'Pendiente';
}

function statusClass(status: 'pending' | 'partial' | 'validated' | 'manual_required'): string {
  if (status === 'validated') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'partial') return 'border-sky-200 bg-sky-50 text-sky-800';
  if (status === 'manual_required') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-red-200 bg-red-50 text-red-800';
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
    BACKUP_WORKER_CONTINUOUS: 'Respaldos automaticos activos',
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
    .trim() || 'Pendiente de revision.';
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
    return fallback.includes('disponible') ? 'Listo para operar.' : 'Requiere revision tecnica.';
  }

  return sanitizeTechnicalText(fallback);
}

function friendlyReadinessBlocker(code: string, fallback: string): string {
  const labels: Record<string, string> = {
    APP_ENV_PRODUCTION: 'Completar modo de operacion final',
    APP_DEBUG_OFF: 'Ocultar mensajes internos',
    APP_DEBUG_FALSE: 'Ocultar mensajes internos',
    PENDING_LAN_CLIENT_VALIDATION: 'Validar acceso desde una segunda computadora',
    PENDING_HARDWARE_VALIDATION: 'Validar recibo fisico media carta/carta/A5',
    PENDING_RESTORE_VALIDATION: 'Validar restauracion segura',
    PENDING_CONCURRENCY_VALIDATION: 'Validar concurrencia de caja',
    PENDING_ENVIRONMENT_VALIDATION: 'Revisar configuracion final del servidor',
    PENDING_DATABASE_MIGRATIONS: 'Actualizar base de datos con respaldo previo',
  };

  return labels[code] ?? sanitizeTechnicalText(fallback);
}

function operationalSummary(status: SystemStatus): { level: OperationalStatus; label: string; description: string; className: string } {
  const hasError =
    !status.database.connected ||
    !status.frontend.dist_index_exists ||
    !status.frontend.assets_present ||
    !status.backups.storage.writable ||
    !status.backups.dump_binary.available ||
    !status.runtime.logs_writable ||
    !status.runtime.cache_writable ||
    (status.backups.queue.failed_jobs_count ?? 0) > 0 ||
    status.backups.last_failure_at !== null;

  if (hasError) {
    return {
      level: 'error',
      label: 'Error',
      description: 'Hay un problema que puede afectar respaldos o continuidad. Pida soporte si no puede resolverlo.',
      className: 'border-red-200 bg-red-50 text-red-900',
    };
  }

  const needsReview =
    !status.readiness.production_ready ||
    !status.network.lan_ready ||
    status.backups.pending_count > 0 ||
    status.readiness.blockers.some((blocker) => blocker.status !== 'validated') ||
    status.preflight.production_checks.some((check) => check.status !== 'validated') ||
    (status.runtime.pending_migration_count ?? 0) > 0 ||
    status.preflight.public_routes.some((route) => route.status !== 'validated') ||
    status.preflight.physical_proofs.some((proof) => proof.status !== 'validated');

  if (needsReview) {
    return {
      level: 'review',
      label: 'Pendiente',
      description: 'Falta completar respaldo reciente, validacion de red/impresora o configuracion final antes de operar sin supervision.',
      className: 'border-amber-200 bg-amber-50 text-amber-900',
    };
  }

  return {
    level: 'ok',
    label: 'Protegido',
    description: 'Respaldos y chequeos basicos estan al dia. Mantenga el cierre diario y los respaldos protegidos.',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  };
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function BackupsView({ user, onStatus }: BackupsViewProps) {
  const [backupsState, setBackups] = useState<BackupLog[]>([]);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [systemStatusError, setSystemStatusError] = useState('');
  const [showAdvancedStatus, setShowAdvancedStatus] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);
  const [downloadTarget, setDownloadTarget] = useState<BackupLog | null>(null);
  const canCreate = user.permissions.includes('backups.create');
  const canDownload = user.permissions.includes('backups.download');

  const backupsList = useMemo(
    () => (Array.isArray(backupsState) ? backupsState : []),
    [backupsState],
  );

  const pendingCount = backupsList.filter(b => b.status === 'pending').length;
  const successCount = backupsList.filter(b => b.status === 'success').length;
  const failedCount = backupsList.filter(b => b.status === 'failed').length;

  const lastSuccessBackup = backupsList.find(b => b.status === 'success');
  const lastFailedBackup = backupsList.find(b => b.status === 'failed');
  const operationalStatus = systemStatus ? operationalSummary(systemStatus) : null;

  const loadBackups = useCallback(async (nextPage: number, announce = true) => {
    setLoading(true);
    setError('');
    if (announce) {
      onStatus('Cargando respaldos locales...');
    }

    try {
      const response = await apiClient.getBackups({ page: nextPage, status: statusFilter });
      setBackups(response.data);
      setMeta(response.meta);
      if (announce) {
        onStatus('Respaldos locales cargados.');
      }
    } catch (error) {
      const message = userSafeErrorMessage(error, 'No se pudieron cargar los respaldos.');
      setError(message);
      onStatus(message);
    } finally {
      setLoading(false);
    }
  }, [onStatus, statusFilter]);

  const loadSystemStatus = useCallback(async () => {
    setSystemStatusError('');

    try {
      setSystemStatus(await apiClient.getSystemStatus());
    } catch (error) {
      const message = userSafeErrorMessage(error, 'No se pudo cargar el estado operativo del servidor.');
      setSystemStatusError(message);
    }
  }, []);

  useEffect(() => {
    void loadBackups(page);
  }, [loadBackups, page]);

  useEffect(() => {
    void loadSystemStatus();
  }, [loadSystemStatus]);

  useEffect(() => {
    if (!backupsList.some((backup) => backup.status === 'pending')) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadBackups(page, false);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [backupsList, loadBackups, page]);

  function refreshOperationalStatus() {
    void loadBackups(page);
    void loadSystemStatus();
  }

  async function handleCreateBackup() {
    setLoading(true);
    setError('');
    onStatus('Creando respaldo local...');

    try {
      const backup = await apiClient.createBackup();
      setBackups((current) => [backup, ...current]);
      onStatus(
        backup.status === 'success'
          ? 'Respaldo protegido.'
          : 'Respaldo registrado. Revise su estado en la lista.',
      );
    } catch (error) {
      const message = userSafeErrorMessage(error, 'No se pudo crear el respaldo.');
      setError(message);
      onStatus(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadBackup(backup: BackupLog) {
    try {
      const blob = await apiClient.downloadBackup(backup.id);
      saveBlob(blob, backup.filename);
      onStatus(`${backupDisplayName(backup)} descargado.`);
    } catch (error) {
      const message = userSafeErrorMessage(error, 'No se pudo descargar el respaldo.');
      setError(message);
      onStatus(message);
    }
  }

  const isEmpty = backupsList.length === 0 && !loading;

  return (
    <section id="backups" aria-labelledby="backups-title">
      <PageHeader
        title="Respaldos"
        description="Copias de seguridad de facturación, caja y reportes"
        actions={
          canCreate ? (
            <div className="flex items-center gap-2">
              {systemStatus && (
                <span
                  className={`hidden md:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                    systemStatus.backups.worker_recently_active
                      ? 'bg-emerald-100 text-emerald-900'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                  aria-label={systemStatus.backups.worker_recently_active ? 'Respaldos automáticos activos' : 'Respaldos automáticos pendientes'}
                >
                  <span
                    className={`inline-block size-1.5 rounded-full ${
                      systemStatus.backups.worker_recently_active ? 'bg-emerald-600' : 'bg-amber-600'
                    }`}
                  />
                  Automáticos {systemStatus.backups.worker_recently_active ? 'activos' : 'pendientes'}
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={refreshOperationalStatus}
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar
              </Button>
              <Button type="button" size="sm" onClick={() => setConfirmCreateOpen(true)} disabled={loading}>
                <Archive className="h-4 w-4 mr-2" />
                Crear respaldo
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="space-y-6">
        <BackupExplanationCard />

        {systemStatusError ? (
          <Alert variant="destructive" title="Estado operativo no disponible">
            {systemStatusError}
          </Alert>
        ) : null}

        {operationalStatus ? (
          <Card className={operationalStatus.className}>
            <CardContent className="flex flex-col gap-3 pt-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-normal">Estado operativo</p>
                <h2 className="mt-1 text-xl font-semibold">{operationalStatus.label}</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6">{operationalStatus.description}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAdvancedStatus((current) => !current)}
              >
                {showAdvancedStatus ? 'Ocultar detalle avanzado' : 'Ver detalle avanzado'}
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {systemStatus && showAdvancedStatus ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
            <Card className={systemStatus.database.connected && systemStatus.frontend.dist_index_exists && systemStatus.frontend.assets_present && systemStatus.network.lan_ready ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-white/80 p-2.5">
                    <Server className="h-5 w-5 text-slate-700" />
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
                      Acceso cliente: {systemStatus.network.lan_ready ? systemStatus.network.client_url : 'configurar IP LAN'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {systemStatus.network.guidance}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={systemStatus.backups.dump_binary.available && systemStatus.backups.storage.writable ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-white/80 p-2.5">
                    <HardDrive className="h-5 w-5 text-slate-700" />
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
                      <p className="text-xs text-amber-700">Sin respaldo protegido registrado.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={systemStatus.backups.pending_count > 0 ? 'border-amber-200 bg-amber-50' : 'bg-muted/30'}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-white/80 p-2.5">
                    <Server className="h-5 w-5 text-slate-700" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold">Proceso de respaldo</p>
                    <p className="text-xs text-muted-foreground">
                      Respaldos esperando: {systemStatus.backups.queue.pending_backup_jobs ?? 'pendiente de revisión'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      En proceso registrados: {systemStatus.backups.pending_count}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-sky-200 bg-sky-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-white/80 p-2.5">
                    <ShieldAlert className="h-5 w-5 text-slate-700" />
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
                    <p className="text-xs text-sky-800">
                      {systemStatus.readiness.production_ready ? 'Sin pendientes críticos' : 'Faltan pruebas finales'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {systemStatus?.readiness.blockers.length ? (
          <Alert title="Pendientes antes de operar">
            {systemStatus.readiness.blockers.map((blocker) => friendlyReadinessBlocker(blocker.code, blocker.label)).join(' - ')}
          </Alert>
        ) : null}

        {systemStatus && showAdvancedStatus ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardContent className="pt-6">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Checklist operativo</h3>
                    <p className="text-xs text-muted-foreground">
                      Estos puntos ayudan a confirmar que los respaldos y la instalación están listos.
                    </p>
                  </div>
                  <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800">
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
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : systemStatus.runtime.pending_migration_count > 0
                            ? 'border-red-200 bg-red-50 text-red-800'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      }`}>
                        {systemStatus.runtime.pending_migration_count === null
                          ? 'Sin dato'
                          : systemStatus.runtime.pending_migration_count > 0
                            ? 'Requiere revision'
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
                      <p className="text-sm font-medium">Respaldos con error</p>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${systemStatus.backups.queue.failed_jobs_count ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
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
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${systemStatus.runtime.laravel_log.exists ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                        {systemStatus.runtime.laravel_log.exists ? formatBytes(systemStatus.runtime.laravel_log.size_bytes) : 'no existe'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ultima actividad: {systemStatus.runtime.laravel_log.modified_at ? formatDate(systemStatus.runtime.laravel_log.modified_at) : 'sin registro'}
                    </p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">Actividad de respaldos</p>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${systemStatus.runtime.backup_automation_log.exists ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                        {systemStatus.runtime.backup_automation_log.exists ? formatBytes(systemStatus.runtime.backup_automation_log.size_bytes) : 'no existe'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Si no hay actividad reciente, pida revisar los respaldos automaticos.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
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
          <Alert variant="destructive" title="Error al cargar respaldos">
            {error}
          </Alert>
        ) : null}

        {!isEmpty && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className={pendingCount > 0 ? 'border-amber-200 bg-amber-50' : 'bg-muted/30'}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${pendingCount > 0 ? 'bg-amber-100' : 'bg-muted'}`}>
                    <Clock className={`h-5 w-5 ${pendingCount > 0 ? 'text-amber-600' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {pendingCount > 0 ? `${pendingCount} en proceso` : 'Sin pendientes'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {pendingCount > 0 ? 'Respaldos en proceso en esta página' : 'No hay pendientes en esta página'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-100">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {lastSuccessBackup
                        ? `Último: ${formatRelativeTime(lastSuccessBackup.completed_at ?? lastSuccessBackup.created_at)}`
                        : 'Sin respaldo protegido'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {successCount > 0 ? `${successCount} protegidos en esta página` : 'Sin respaldos protegidos en esta página'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={failedCount > 0 ? 'border-red-200 bg-red-50' : 'bg-muted/30'}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${failedCount > 0 ? 'bg-red-100' : 'bg-muted'}`}>
                    <XCircle className={`h-5 w-5 ${failedCount > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {lastFailedBackup
                        ? `Último: ${formatRelativeTime(lastFailedBackup.completed_at ?? lastFailedBackup.created_at)}`
                        : 'Sin fallos'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {failedCount > 0
                        ? `${failedCount} con error - avise al administrador antes de crear otro respaldo`
                        : 'Sin fallos en esta página'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {!isEmpty && !loading && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filtrar:</span>
              {(['all', 'pending', 'success', 'failed'] as StatusFilter[]).map((filter) => (
                <Button
                  key={filter}
                  type="button"
                  variant={statusFilter === filter ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setStatusFilter(filter);
                    setPage(1);
                  }}
                  className="h-8"
                >
                  {filter === 'all' ? 'Todos' : filter === 'pending' ? 'Pendientes' : filter === 'success' ? 'Protegidos' : 'Error'}
                </Button>
              ))}
            </div>

            <Table className="min-w-[960px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40 whitespace-nowrap px-4 py-3">Fecha</TableHead>
                  <TableHead className="min-w-72 px-4 py-3">Respaldo</TableHead>
                  <TableHead className="w-24 whitespace-nowrap px-4 py-3">Tamaño</TableHead>
                  <TableHead className="px-4 py-3">Estado</TableHead>
                  <TableHead className="w-44 whitespace-nowrap px-4 py-3">Usuario</TableHead>
                  <TableHead className="px-4 py-3 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backupsList.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      No hay respaldos con este estado. Quite el filtro para ver todos.
                    </TableCell>
                  </TableRow>
                )}
                {backupsList.map((backup) => (
                  <TableRow key={backup.id}>
                    <TableCell className="whitespace-nowrap px-4 py-3">{formatDate(backup.completed_at ?? backup.created_at)}</TableCell>
                    <TableCell className="min-w-72 break-words px-4 py-3 text-sm">{backupDisplayName(backup)}</TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-3">{formatBytes(backup.size_bytes)}</TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <BackupStatusBadge status={backup.status as 'pending' | 'success' | 'failed'} />
                        <span className="text-xs text-muted-foreground">
                          {getStatusDescription(backup.status as 'pending' | 'success' | 'failed')}
                        </span>
                        {backup.status === 'failed' && backup.error_message && (
                          <span className="text-xs text-destructive max-w-[200px] truncate">
                            No se completo. Revise con soporte local.
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-3">{backup.creator?.name ?? 'Sistema'}</TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      {canDownload && backup.status === 'success' ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Descargar ${backupDisplayName(backup)}`}
                          onClick={() => setDownloadTarget(backup)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {meta ? (
              <PaginationControls loading={loading} meta={meta} onPageChange={setPage} />
            ) : null}
          </div>
        )}

        {isEmpty && (
          <BackupEmptyState onCreate={() => setConfirmCreateOpen(true)} canCreate={canCreate} />
        )}
      </div>
      <ConfirmDialog
        confirmLabel="Crear respaldo"
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
        confirmLabel="Descargar"
        onCancel={() => setDownloadTarget(null)}
        onConfirm={() => {
          const target = downloadTarget;
          setDownloadTarget(null);
          if (target) void handleDownloadBackup(target);
        }}
        open={Boolean(downloadTarget)}
        title="¿Descargar respaldo?"
      >
        Descargara {downloadTarget ? backupDisplayName(downloadTarget) : 'este respaldo'}. Esta accion queda auditada.
      </ConfirmDialog>
    </section>
  );
}
