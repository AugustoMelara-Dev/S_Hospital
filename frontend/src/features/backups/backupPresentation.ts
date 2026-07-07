import type { BackupLog, SystemStatus } from '@/lib/api';
import { userSafeErrorMessage } from '@/lib/api';
import { formatLocalizedDateTime } from '@/lib/format/formatDate';
import { safeClientMessage } from '@/lib/support/clientIssueLog';

export type BackupStatusFilter = 'all' | 'pending' | 'success' | 'failed';
export type OperationalStatus = 'ok' | 'review' | 'error';

export function formatBytes(size: number | null): string {
  if (size === null || !Number.isFinite(size) || size < 0) return 'Tamaño no disponible';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(value: string): string {
  return formatLocalizedDateTime(value);
}

export function formatRelativeTime(value: string): string {
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

export function automaticBackupHeartbeatLabel(
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

export function statusLabel(status: 'pending' | 'partial' | 'validated' | 'manual_required'): string {
  if (status === 'validated') return 'Validado';
  if (status === 'partial') return 'Parcial';
  if (status === 'manual_required') return 'Requiere prueba';
  return 'Pendiente';
}

export function statusClass(status: 'pending' | 'partial' | 'validated' | 'manual_required'): string {
  if (status === 'validated') return 'status-success';
  if (status === 'partial') return 'status-info';
  if (status === 'manual_required') return 'status-warning';
  return 'border-destructive/30 bg-destructive/10 text-destructive';
}

export function friendlyProductionCheck(code: string, fallback: string): string {
  const labels: Record<string, string> = {
    APP_ENV_PRODUCTION: 'Modo de operacion final',
    APP_DEBUG_OFF: 'Mensajes internos ocultos',
    APP_DEBUG_FALSE: 'Mensajes internos ocultos',
    MYSQL_FAMILY: 'Base de datos local correcta',
    MYSQL_FAMILY_DATABASE: 'Base de datos local correcta',
    DUMP_BINARY_AVAILABLE: 'Creacion de respaldos disponible',
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

export function sanitizeTechnicalText(value: string): string {
  return value
    .replace(/APP_ENV|APP_DEBUG|debug|mysqldump|mariadb-dump|php artisan|queue:work|--queue=backups|--tries=1|--timeout=600|HTTP 200|SPA cargada/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Pendiente de revision.';
}

export function friendlyProductionDetail(code: string, fallback: string): string {
  if (code === 'BACKUP_WORKER_CONTINUOUS') {
    return 'Debe estar activo para que los respaldos pendientes se completen.';
  }

  if (code === 'DATABASE_MIGRATIONS_CURRENT') {
    return fallback.includes('pendientes')
      ? 'Requiere respaldo y actualizacion segura antes de operar reportes.'
      : 'Base de datos actualizada.';
  }

  if (code === 'DUMP_BINARY_AVAILABLE') {
    return 'El servidor puede generar archivos de respaldo.';
  }

  if (code === 'APP_ENV_PRODUCTION' || code === 'APP_DEBUG_OFF' || code === 'APP_DEBUG_FALSE') {
    return 'Este punto se revisa durante la instalacion final.';
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

export function friendlyReadinessBlocker(code: string, fallback: string): string {
  const labels: Record<string, string> = {
    APP_ENV_PRODUCTION: 'Completar modo de operacion final',
    APP_DEBUG_OFF: 'Ocultar mensajes internos',
    APP_DEBUG_FALSE: 'Ocultar mensajes internos',
    PENDING_LAN_CLIENT_VALIDATION: 'Confirmar prueba desde segunda PC LAN',
    PENDING_HARDWARE_VALIDATION: 'Validar recibo institucional carta, media carta o A5',
    PENDING_RESTORE_VALIDATION: 'Confirmar recuperacion con soporte',
    PENDING_CONCURRENCY_VALIDATION: 'Confirmar flujo de caja local',
    PENDING_ENVIRONMENT_VALIDATION: 'Revisar configuracion final del servidor',
    PENDING_DATABASE_MIGRATIONS: 'Actualizar base de datos con respaldo previo',
  };

  return labels[code] ?? sanitizeTechnicalText(fallback);
}

export function isLocalAccessValidationNoise(code: string, isSingleMachineMode: boolean): boolean {
  return isSingleMachineMode && (
    code === 'PENDING_LAN_CLIENT_VALIDATION' ||
    code === 'LAN_CLIENT_VALIDATION_PROOF' ||
    code === 'PUBLIC_ROUTES_AVAILABLE'
  );
}

export function operationalSummary(status: SystemStatus): { level: OperationalStatus; label: string; description: string; className: string } {
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
  const isSingleMachineMode = status.network.host_type === 'loopback';
  const needsReview =
    status.backups.pending_count > 0 ||
    status.readiness.blockers.some((blocker) => (
      blocker.status !== 'validated' && !isLocalAccessValidationNoise(blocker.code, isSingleMachineMode)
    )) ||
    status.preflight.production_checks.some((check) => (
      check.status !== 'validated' && !isLocalAccessValidationNoise(check.code, isSingleMachineMode)
    )) ||
    (status.runtime.pending_migration_count ?? 0) > 0 ||
    (!localAccessReady && status.preflight.public_routes.some((route) => route.status !== 'validated')) ||
    status.preflight.physical_proofs.some((proof) => (
      proof.status !== 'validated' && !isLocalAccessValidationNoise(proof.code, isSingleMachineMode)
    ));

  if (needsReview) {
    return {
      level: 'review',
      label: 'Requiere revision',
      description: 'Falta completar respaldo reciente, validacion del recibo o configuracion final antes de operar sin supervision.',
      className: 'status-warning',
    };
  }

  return {
    level: 'ok',
    label: 'Todo bien',
    description: 'Respaldos y chequeos basicos estan al dia. Mantenga el cierre diario y los respaldos protegidos.',
    className: 'status-success',
  };
}

export function operationalStatusBadge(level: OperationalStatus): 'success' | 'pending' | 'failed' {
  if (level === 'ok') return 'success';
  if (level === 'error') return 'failed';
  return 'pending';
}

export function safeBackupsErrorMessage(error: unknown, fallback: string): string {
  const message = safeClientMessage(userSafeErrorMessage(error, fallback));

  return message.includes('[redacted]') || message.includes('[ruta-local]') || message.includes('[detalle-tecnico]')
    ? fallback
    : message || fallback;
}

export function backupDownloadFilename(backup: BackupLog): string {
  const rawDate = backup.completed_at ?? backup.created_at;
  const match = rawDate.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  const date = match ? `${match[1]}-${match[2]}${match[3]}` : 'sin-fecha';

  return `respaldo-local-${date}.sql.gz.enc`;
}

export function localAccessIsReady(status: SystemStatus): boolean {
  return status.network.lan_ready || status.network.host_type === 'loopback';
}

export function localAccessLabel(status: SystemStatus): string {
  if (localAccessIsReady(status)) {
    return status.network.client_url ?? 'este equipo';
  }

  return 'configurar IP LAN';
}
