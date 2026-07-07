import { HardDrive, Server, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import type { SystemStatus } from '@/lib/api';
import {
  automaticBackupHeartbeatLabel,
  formatBytes,
  formatDate,
  formatRelativeTime,
  friendlyProductionCheck,
  friendlyProductionDetail,
  localAccessIsReady,
  localAccessLabel,
  operationalStatusBadge,
  statusClass,
  statusLabel,
  type OperationalStatus,
} from '../backupPresentation';

type OperationalSummary = {
  level: OperationalStatus;
  label: string;
  description: string;
  className: string;
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

  return (
    <div className="space-y-4">
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
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-controls={advancedStatusId}
            aria-expanded={showAdvancedStatus}
            onClick={onToggleAdvancedStatus}
          >
            {showAdvancedStatus ? 'Ocultar detalle de soporte' : 'Ver detalle de soporte'}
          </Button>
        </CardContent>
      </Card>

      <section aria-labelledby="backup-recovery-support-title">
        <Card className={`${recoveryStatus.className} shadow-operational`}>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-normal">Guia de soporte</p>
                <h3 id="backup-recovery-support-title" className="mt-1 text-lg font-semibold">
                  Recuperacion con soporte
                </h3>
                <p className="mt-1 max-w-3xl text-sm leading-6">
                  {recoveryStatus.description}
                </p>
              </div>
              <StatusBadge status={recoveryStatus.badgeStatus}>{recoveryStatus.label}</StatusBadge>
            </div>
          </CardContent>
        </Card>
      </section>

      {showAdvancedStatus ? (
        <>
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
                    <p className="text-sm font-semibold">Preparacion de respaldos</p>
                    <p className="text-xs text-muted-foreground">
                      Creacion de archivos: {systemStatus.backups.dump_binary.available ? 'lista' : 'pendiente'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Carpeta de respaldo: {systemStatus.backups.storage.writable ? 'lista' : 'pendiente'} - libre {formatBytes(systemStatus.backups.storage.free_bytes)}
                    </p>
                    {systemStatus.backups.last_success_at ? (
                      <p className="text-xs text-muted-foreground">
                        Ultimo protegido: {formatRelativeTime(systemStatus.backups.last_success_at)}
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
                      Respaldos esperando: {systemStatus.backups.queue.pending_backup_jobs ?? 'pendiente de revision'}
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
                      Instalacion: {systemStatus.readiness.production_ready ? 'lista para operar' : 'con pendientes'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Hora del servidor: {formatDate(systemStatus.environment.server_time)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Version instalada: {systemStatus.environment.app_version}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Zona horaria: {systemStatus.environment.timezone}
                    </p>
                    <p className="text-xs text-info">
                      {systemStatus.readiness.production_ready ? 'Sin pendientes criticos' : 'Faltan pruebas finales'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-operational-border bg-operational-surface shadow-operational">
              <CardContent className="pt-6">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Checklist operativo</h3>
                    <p className="text-xs text-muted-foreground">
                      Estos puntos ayudan a confirmar que los respaldos y la instalacion estan listos.
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
                      <p className="text-sm font-medium">Tareas con problema</p>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${systemStatus.backups.queue.failed_jobs_count ? 'border-warning/30 bg-warning/10 text-warning' : 'border-success/30 bg-success/10 text-success-foreground'}`}>
                        {systemStatus.backups.queue.failed_jobs_count ?? 'Sin dato'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Si aparece un numero mayor a cero, revise el ultimo respaldo con error.
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
                      Ultima actividad: {systemStatus.runtime.laravel_log.modified_at ? formatDate(systemStatus.runtime.laravel_log.modified_at) : 'sin registro'}
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
                      Si no hay actividad reciente, pida revisar los respaldos automaticos.
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
                              {route.path === '/up' ? 'Servidor responde' : route.path === '/login' ? 'Pantalla de ingreso abre' : 'Pantalla de verificacion abre'}
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
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Pruebas fisicas</p>
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
        </>
      ) : null}
    </div>
  );
}

function recoverySupportStatus(
  systemStatus: SystemStatus,
  latestBackupNotConfirmed: boolean,
): { badgeStatus: 'success' | 'pending' | 'failed'; className: string; description: string; label: string } {
  const hasRestoreBlocker = systemStatus.readiness.blockers.some((blocker) => blocker.code === 'PENDING_RESTORE_VALIDATION');

  if (!systemStatus.backups.last_success_at) {
    return {
      badgeStatus: 'pending',
      className: 'status-warning',
      description: 'Cree un respaldo local y pida a soporte validar una copia protegida antes de operar sin supervision.',
      label: 'Requiere soporte',
    };
  }

  if (latestBackupNotConfirmed || hasRestoreBlocker) {
    return {
      badgeStatus: 'pending',
      className: 'status-warning',
      description: 'Pida a soporte validar una copia protegida antes de confiar en la recuperacion del sistema.',
      label: 'Requiere soporte',
    };
  }

  return {
    badgeStatus: 'success',
    className: 'status-success',
    description: 'Hay respaldo protegido reciente. Mantenga la validacion de recuperacion como tarea de soporte controlada.',
    label: 'Guia lista',
  };
}
