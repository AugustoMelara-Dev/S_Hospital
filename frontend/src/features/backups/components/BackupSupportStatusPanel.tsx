import { HardDrive, Server, ShieldAlert } from 'lucide-react';
import { AdminPanel } from '@/design-system/admin/components';
import type { SystemStatus } from '@/lib/api';
import { SECONDARY_BUTTON } from '../backupsUi';
import { automaticBackupHeartbeatLabel, formatBytes, formatDate, formatRelativeTime, friendlyProductionCheck, friendlyProductionDetail, localAccessIsReady, localAccessLabel, sanitizeTechnicalText, statusLabel, type OperationalStatus } from '../backupPresentation';

type OperationalSummary = {
  level: OperationalStatus;
  label: string;
  description: string;
};

type BackupSupportStatusPanelProps = {
  advancedStatusId: string;
  latestBackupNotConfirmed: boolean;
  onToggleAdvancedStatus: () => void;
  operationalStatus: OperationalSummary;
  showAdvancedStatus: boolean;
  stalePendingCount: number;
  systemStatus: SystemStatus;
};

/**
 * Fórmula dark §2 para badges de estado: tono + subtle 13 % + borde 36 %.
 * "Pendiente"/"Sin dato" nunca se pintan de error (§5): advierten en warn,
 * igual que el resto de estados sin verificar. "Parcial" es informativo → acento.
 */
function adminStatusTag(status: 'pending' | 'partial' | 'validated' | 'manual_required') {
  if (status === 'validated') return 'border-[var(--ui-success-border)] bg-[var(--ui-success-subtle)] text-[color:var(--ui-success)]';
  if (status === 'manual_required') return 'border-[var(--ui-warn-border)] bg-[var(--ui-warn-subtle)] text-[color:var(--ui-warn)]';
  if (status === 'partial') return 'border-[var(--ui-action-border)] bg-[var(--ui-action-subtle)] text-[color:var(--ui-action)]';
  return 'border-[var(--ui-warn-border)] bg-[var(--ui-warn-subtle)] text-[color:var(--ui-warn)]';
}

/** Gobernanza general: correcto/atencion/error. IDs no solo color: texto del tag. */
function badgeVariantClass(level: 'success' | 'pending' | 'failed' | 'ok' | 'review' | 'error') {
  if (level === 'success' || level === 'ok') return 'border-[var(--ui-success-border)] bg-[var(--ui-success-subtle)] text-[color:var(--ui-success)]';
  if (level === 'error' || level === 'failed') return 'border-[var(--ui-danger-border)] bg-[var(--ui-danger-subtle)] text-[color:var(--ui-danger)]';
  return 'border-[var(--ui-warn-border)] bg-[var(--ui-warn-subtle)] text-[color:var(--ui-warn)]';
}

export function BackupSupportStatusPanel({
  advancedStatusId,
  latestBackupNotConfirmed,
  onToggleAdvancedStatus,
  operationalStatus,
  showAdvancedStatus,
  stalePendingCount,
  systemStatus,
}: BackupSupportStatusPanelProps) {
  const automaticBackupHeartbeat = automaticBackupHeartbeatLabel(systemStatus.backups.queue.scheduler_heartbeat);
  const recoveryStatus = recoverySupportStatus(systemStatus, latestBackupNotConfirmed);

  // Chip con tono semántico: la forma del ADMIN_TAG pero sin su borde/tinta
  // neutrales, para que `border-*`/`text-*` del tono no compitan en cascada.
  const TONE_CHIP_BASE = 'inline-flex w-fit items-center gap-1.5 rounded-[var(--ui-radius)] border px-1.5 py-0.5 text-[length:var(--ui-text-xs)] font-semibold';

  return (
    <div className="flex flex-col gap-4">
      <AdminPanel as="div" className={operationalStatus.level === 'error' ? 'border-[var(--ui-danger-border)]' : operationalStatus.level === 'ok' ? 'border-[var(--ui-success-border)]' : 'border-[var(--ui-warn-border)]'}>
        <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-[length:var(--ui-text-xs)] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-ink-soft)]">Estado operativo</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h3 className="text-[length:var(--ui-text-xl)] font-semibold text-[color:var(--ui-ink)]">{operationalStatus.label}</h3>
              <span className={`${TONE_CHIP_BASE} ${badgeVariantClass(operationalStatus.level)}`}>
                {operationalStatus.level === 'ok' ? 'Correcto' : operationalStatus.level === 'error' ? 'Error' : 'Atencion'}
              </span>
            </div>
            <p className="mt-1 max-w-3xl text-[length:var(--ui-text-sm)] leading-6 text-[color:var(--ui-ink-soft)]">{operationalStatus.description}</p>
          </div>
          <button
            type="button"
            data-ui-press
            className={SECONDARY_BUTTON}
            aria-controls={advancedStatusId}
            aria-expanded={showAdvancedStatus}
            onClick={onToggleAdvancedStatus}
          >
            {showAdvancedStatus ? 'Ocultar detalle de soporte' : 'Ver detalle de soporte'}
          </button>
        </div>
      </AdminPanel>

      <section aria-labelledby="backup-recovery-support-title">
        <AdminPanel as="div" className={recoveryStatus.badgeStatus === 'success' ? 'border-[var(--ui-success-border)]' : 'border-[var(--ui-warn-border)]'}>
          <div className="p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[length:var(--ui-text-xs)] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-ink-soft)]">Guia de soporte</p>
                <h3 id="backup-recovery-support-title" className="mt-1 text-[length:var(--ui-text-lg)] font-semibold text-[color:var(--ui-ink)]">
                  Recuperacion con soporte
                </h3>
                <p className="mt-1 max-w-3xl text-[length:var(--ui-text-sm)] leading-6 text-[color:var(--ui-ink-soft)]">
                  {recoveryStatus.description}
                </p>
              </div>
              <span className={`${TONE_CHIP_BASE} ${badgeVariantClass(recoveryStatus.badgeStatus)}`}>{recoveryStatus.label}</span>
            </div>
          </div>
        </AdminPanel>
      </section>

      {showAdvancedStatus ? (
        <>
          <div id={advancedStatusId} className="grid grid-cols-1 gap-4 xl:grid-cols-4">
            <AdminPanel as="div" className={systemStatus.database.connected && systemStatus.frontend.dist_index_exists && systemStatus.frontend.assets_present && localAccessIsReady(systemStatus) ? 'border-[var(--ui-success-border)]' : 'border-[var(--ui-warn-border)]'}>
              <div className="flex items-start gap-3 p-4">
                <Server aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[color:var(--ui-ink-soft)]" strokeWidth={1.5} />
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">Servidor, datos y red local</p>
                  <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Base de datos: {systemStatus.database.connected ? 'conectada' : 'pendiente'}</p>
                  <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Interfaz: {systemStatus.frontend.dist_index_exists && systemStatus.frontend.assets_present ? 'lista' : 'requiere build'}</p>
                  <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Acceso cliente: {localAccessLabel(systemStatus)}</p>
                  <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">{systemStatus.network.guidance}</p>
                </div>
              </div>
            </AdminPanel>

            <AdminPanel as="div" className={systemStatus.backups.dump_binary.available && systemStatus.backups.storage.writable ? 'border-[var(--ui-success-border)]' : 'border-[var(--ui-warn-border)]'}>
              <div className="flex items-start gap-3 p-4">
                <HardDrive aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[color:var(--ui-ink-soft)]" strokeWidth={1.5} />
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">Preparacion de respaldos</p>
                  <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Creacion de archivos: {systemStatus.backups.dump_binary.available ? 'lista' : 'pendiente'}</p>
                  <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Carpeta de respaldo: {systemStatus.backups.storage.writable ? 'lista' : 'pendiente'} - libre {formatBytes(systemStatus.backups.storage.free_bytes)}</p>
                  {systemStatus.backups.last_success_at ? (
                    <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Ultimo protegido: {formatRelativeTime(systemStatus.backups.last_success_at)}</p>
                  ) : (
                    <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-warn)]">Sin respaldo protegido registrado.</p>
                  )}
                </div>
              </div>
            </AdminPanel>

            <AdminPanel as="div" className={systemStatus.backups.pending_count > 0 ? 'border-[var(--ui-warn-border)]' : undefined}>
              <div className="flex items-start gap-3 p-4">
                <Server aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[color:var(--ui-ink-soft)]" strokeWidth={1.5} />
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">Proceso de respaldo</p>
                  <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Respaldos esperando: {systemStatus.backups.queue.pending_backup_jobs ?? 'pendiente de revision'}</p>
                  <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">En proceso registrados: {systemStatus.backups.pending_count}</p>
                  <p className={`text-[length:var(--ui-text-xs)] ${stalePendingCount > 0 ? 'text-[color:var(--ui-warn)]' : 'text-[color:var(--ui-ink-soft)]'}`}>Atascados: {stalePendingCount}</p>
                  <p className={`text-[length:var(--ui-text-xs)] ${automaticBackupHeartbeat.tone === 'success' ? 'text-[color:var(--ui-success)]' : automaticBackupHeartbeat.tone === 'warning' ? 'text-[color:var(--ui-warn)]' : 'text-[color:var(--ui-ink-soft)]'}`}>
                    {automaticBackupHeartbeat.label}
                  </p>
                </div>
              </div>
            </AdminPanel>

            <AdminPanel as="div" className="border-[var(--ui-action-border)]">
              <div className="flex items-start gap-3 p-4">
                <ShieldAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[color:var(--ui-action)]" strokeWidth={1.5} />
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">Estado general</p>
                  <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Instalacion: {systemStatus.readiness.production_ready ? 'lista para operar' : 'con pendientes'}</p>
                  <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Hora del servidor: {formatDate(systemStatus.environment.server_time)}</p>
                  <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Version instalada: {systemStatus.environment.app_version}</p>
                  <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Zona horaria: {systemStatus.environment.timezone}</p>
                  <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-action)]">{systemStatus.readiness.production_ready ? 'Sin pendientes criticos' : 'Faltan pruebas finales'}</p>
                </div>
              </div>
            </AdminPanel>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <AdminPanel as="div">
              <div className="p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">Checklist operativo</h3>
                    <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Estos puntos ayudan a confirmar que los respaldos y la instalacion estan listos.</p>
                  </div>
                  <span className={`${TONE_CHIP_BASE} ${systemStatus.readiness.production_ready ? 'border-[var(--ui-success-border)] bg-[var(--ui-success-subtle)] text-[color:var(--ui-success)]' : 'border-[var(--ui-warn-border)] bg-[var(--ui-warn-subtle)] text-[color:var(--ui-warn)]'}`}>
                    {systemStatus.readiness.production_ready ? 'Listo' : 'Pendiente'}
                  </span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {systemStatus.preflight.production_checks.map((check) => (
                    <div key={check.code} className="rounded-[var(--ui-radius)] border border-[var(--ui-line)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]">{friendlyProductionCheck(check.code, check.label)}</p>
                        <span className={`shrink-0 rounded-[var(--ui-radius)] border px-2 py-0.5 text-[length:var(--ui-text-xs)] font-semibold ${adminStatusTag(check.status)}`}>{statusLabel(check.status)}</span>
                      </div>
                      <p className="mt-1 break-words text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">{friendlyProductionDetail(check.code, check.detail)}</p>
                    </div>
                  ))}
                  <div className="rounded-[var(--ui-radius)] border border-[var(--ui-line)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]">Estado de datos</p>
                      <span className={`shrink-0 rounded-[var(--ui-radius)] border px-2 py-0.5 text-[length:var(--ui-text-xs)] font-semibold ${systemStatus.runtime.pending_migration_count === null ? 'border-[var(--ui-warn-border)] bg-[var(--ui-warn-subtle)] text-[color:var(--ui-warn)]' : systemStatus.runtime.pending_migration_count > 0 ? 'border-[var(--ui-danger-border)] bg-[var(--ui-danger-subtle)] text-[color:var(--ui-danger)]' : 'border-[var(--ui-success-border)] bg-[var(--ui-success-subtle)] text-[color:var(--ui-success)]'}`}>
                        {systemStatus.runtime.pending_migration_count === null ? 'Sin dato' : systemStatus.runtime.pending_migration_count > 0 ? 'Requiere revision' : 'Actualizada'}
                      </span>
                    </div>
                    <p className="mt-1 break-words text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
                      {systemStatus.runtime.pending_migration_count === null
                        ? 'No se pudo verificar el estado de la base de datos.'
                        : systemStatus.runtime.pending_migration_count > 0
                          ? 'Haga respaldo y pida soporte para actualizar antes de revisar reportes.'
                          : 'La base de datos está al día.'}
                    </p>
                  </div>
                  <div className="rounded-[var(--ui-radius)] border border-[var(--ui-line)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]">Tareas con problema</p>
                      <span className={`shrink-0 rounded-[var(--ui-radius)] border px-2 py-0.5 text-[length:var(--ui-text-xs)] font-semibold ${systemStatus.backups.queue.failed_jobs_count ? 'border-[var(--ui-warn-border)] bg-[var(--ui-warn-subtle)] text-[color:var(--ui-warn)]' : 'border-[var(--ui-success-border)] bg-[var(--ui-success-subtle)] text-[color:var(--ui-success)]'}`}>
                        {systemStatus.backups.queue.failed_jobs_count ?? 'Sin dato'}
                      </span>
                    </div>
                    <p className="mt-1 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Si aparece un numero mayor a cero, revise el ultimo respaldo con error.</p>
                  </div>
                  <div className="rounded-[var(--ui-radius)] border border-[var(--ui-line)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]">Registro operativo</p>
                      <span className={`shrink-0 rounded-[var(--ui-radius)] border px-2 py-0.5 text-[length:var(--ui-text-xs)] font-semibold ${systemStatus.runtime.laravel_log.exists ? 'border-[var(--ui-action-border)] bg-[var(--ui-action-subtle)] text-[color:var(--ui-action)]' : 'border-[var(--ui-warn-border)] bg-[var(--ui-warn-subtle)] text-[color:var(--ui-warn)]'}`}>
                        {systemStatus.runtime.laravel_log.exists ? formatBytes(systemStatus.runtime.laravel_log.size_bytes) : 'no existe'}
                      </span>
                    </div>
                    <p className="mt-1 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Ultima actividad: {systemStatus.runtime.laravel_log.modified_at ? formatDate(systemStatus.runtime.laravel_log.modified_at) : 'sin registro'}</p>
                  </div>
                  <div className="rounded-[var(--ui-radius)] border border-[var(--ui-line)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]">Actividad de respaldos</p>
                      <span className={`shrink-0 rounded-[var(--ui-radius)] border px-2 py-0.5 text-[length:var(--ui-text-xs)] font-semibold ${systemStatus.runtime.backup_automation_log.exists ? 'border-[var(--ui-action-border)] bg-[var(--ui-action-subtle)] text-[color:var(--ui-action)]' : 'border-[var(--ui-warn-border)] bg-[var(--ui-warn-subtle)] text-[color:var(--ui-warn)]'}`}>
                        {systemStatus.runtime.backup_automation_log.exists ? formatBytes(systemStatus.runtime.backup_automation_log.size_bytes) : 'no existe'}
                      </span>
                    </div>
                    <p className="mt-1 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Si no hay actividad reciente, pida revisar los respaldos automaticos.</p>
                  </div>
                </div>
              </div>
            </AdminPanel>

            <AdminPanel as="div">
              <div className="p-4">
                <h3 className="text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">Pruebas de campo obligatorias</h3>
                <div className="mt-3 flex flex-col gap-3">
                  <div>
                    <p className="text-[length:var(--ui-text-xs)] font-semibold uppercase text-[color:var(--ui-ink-soft)]">Prueba en red local</p>
                    <ul className="mt-2 flex flex-col gap-2">
                      {systemStatus.preflight.public_routes.map((route) => (
                        <li key={route.path} className="flex items-start justify-between gap-3 rounded-[var(--ui-radius)] border border-[var(--ui-line)] p-2">
                          <span>
                            <span className="block text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]">
                              {route.path === '/up' ? 'Servidor responde' : route.path === '/login' ? 'Pantalla de ingreso abre' : 'Pantalla de verificacion abre'}
                            </span>
                            <span className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">{sanitizeTechnicalText(route.expected)}</span>
                          </span>
                          <span className={`shrink-0 rounded-[var(--ui-radius)] border px-2 py-0.5 text-[length:var(--ui-text-xs)] font-semibold ${adminStatusTag(route.status)}`}>{statusLabel(route.status)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[length:var(--ui-text-xs)] font-semibold uppercase text-[color:var(--ui-ink-soft)]">Pruebas fisicas</p>
                    <ul className="mt-2 flex flex-col gap-2">
                      {systemStatus.preflight.physical_proofs.map((proof) => (
                        <li key={proof.code} className="rounded-[var(--ui-radius)] border border-[var(--ui-line)] p-2">
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]">{proof.label}</span>
                            <span className={`shrink-0 rounded-[var(--ui-radius)] border px-2 py-0.5 text-[length:var(--ui-text-xs)] font-semibold ${adminStatusTag(proof.status)}`}>{statusLabel(proof.status)}</span>
                          </div>
                          <p className="mt-1 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">{proof.detail}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </AdminPanel>
          </div>
        </>
      ) : null}
    </div>
  );
}

function recoverySupportStatus(
  systemStatus: SystemStatus,
  latestBackupNotConfirmed: boolean,
): { badgeStatus: 'success' | 'pending' | 'failed'; description: string; label: string } {
  const hasRestoreBlocker = systemStatus.readiness.blockers.some((blocker) => blocker.code === 'PENDING_RESTORE_VALIDATION');

  if (!systemStatus.backups.last_success_at) {
    return {
      badgeStatus: 'pending',
      description: 'Cree un respaldo local y pida a soporte validar una copia protegida antes de operar sin supervision.',
      label: 'Requiere soporte',
    };
  }

  if (latestBackupNotConfirmed || hasRestoreBlocker) {
    return {
      badgeStatus: 'pending',
      description: 'Pida a soporte validar una copia protegida antes de confiar en la recuperacion del sistema.',
      label: 'Requiere soporte',
    };
  }

  return {
    badgeStatus: 'success',
    description: 'Hay respaldo protegido reciente. Mantenga la validacion de recuperacion como tarea de soporte controlada.',
    label: 'Guia lista',
  };
}
