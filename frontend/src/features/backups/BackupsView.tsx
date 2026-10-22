import { useEffect, useRef, useState } from 'react';
import { AdminCallout, AdminChip, AdminDialog, AdminPageHeader, AdminPanel, AdminPanelHeader, AdminSearch } from '@/design-system/admin/components';
import { useBackups, useCreateBackup } from '@/hooks/useBackups';
import { useSystemStatusSnapshot } from '@/hooks/useServerStatus';
import { BackupDownloadDialog } from './components/BackupDownloadDialog';
import { BackupEmptyState } from './components/BackupExplanationCard';
import { BackupHealthPanel, BackupMaintenanceSection, type BackupHealth, type BackupKpi } from './components/BackupHealthPanel';
import { BackupHistoryTable } from './components/BackupHistoryTable';
import { BackupPageActions } from './components/BackupPageActions';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from './backupsUi';
import {
  automaticBackupHeartbeatLabel,
  backupDownloadFilename,
  formatDate,
  formatRelativeTime,
  friendlyReadinessBlocker,
  isLocalAccessValidationNoise,
  operationalSummary,
  safeBackupsErrorMessage,
  type BackupStatusFilter,
} from './backupPresentation';
import { type AuthUser, type BackupLog, apiClient } from '../../lib/api';
import { downloadBlob } from '../../lib/download';
import type { OperationalStatusReporter } from '@/app/operationalStatus';

type BackupsViewProps = {
  user: AuthUser;
  onStatus: OperationalStatusReporter;
};

export function BackupsView({ user, onStatus }: BackupsViewProps) {
  const [page, setPage] = useState(1);
  const [manualError, setManualError] = useState('');
  const [showAdvancedStatus, setShowAdvancedStatus] = useState(false);
  const [statusFilter, setStatusFilter] = useState<BackupStatusFilter>('all');
  const [historyQuery, setHistoryQuery] = useState('');
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);
  const [downloadTarget, setDownloadTarget] = useState<BackupLog | null>(null);
  const [downloadingBackupId, setDownloadingBackupId] = useState<number | null>(null);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const creatingBackupRef = useRef(false);
  const downloadingBackupRef = useRef<number | null>(null);

  const canCreate = user.permissions.includes('backups.create');
  const canDownload = user.permissions.includes('backups.download');
  const canViewBackups = user.permissions.includes('backups.view');
  const canViewSystemStatus = user.permissions.includes('system.status.view');
  const backupsQuery = useBackups({ page, status: statusFilter, enabled: canViewBackups });
  const createBackupMutation = useCreateBackup();
  const systemStatusQuery = useSystemStatusSnapshot(canViewSystemStatus);

  const backupsList = Array.isArray(backupsQuery.data?.data) ? backupsQuery.data.data : [];
  const meta = backupsQuery.data?.meta ?? null;
  const systemStatus = systemStatusQuery.data ?? null;
  const creatingBackup = createBackupMutation.isPending;
  const initialLoading = backupsQuery.isLoading && backupsList.length === 0;
  const statusInitialLoading = canViewSystemStatus && systemStatusQuery.isLoading && !systemStatus;
  const busy = backupsQuery.isFetching || systemStatusQuery.isFetching || creatingBackup;
  const backupsQueryError = backupsQuery.isError
    ? safeBackupsErrorMessage(backupsQuery.error, 'No se pudieron cargar los respaldos.')
    : '';
  const systemStatusError = systemStatusQuery.isError
    ? safeBackupsErrorMessage(systemStatusQuery.error, 'No se pudo cargar el estado operativo del servidor.')
    : '';
  const error = manualError || backupsQueryError;
  const pendingCount = systemStatus?.backups.pending_count ?? null;
  const confirmedSystemPendingCount = typeof pendingCount === 'number'
    && Number.isInteger(pendingCount)
    && pendingCount >= 0
    ? pendingCount
    : null;
  const historyGlobalPendingCount = meta?.global_pending_count;
  const confirmedHistoryPendingCount = typeof historyGlobalPendingCount === 'number'
    && Number.isInteger(historyGlobalPendingCount)
    && historyGlobalPendingCount >= 0
    ? historyGlobalPendingCount
    : null;
  const failedCount = systemStatus?.backups.failed_count ?? null;
  const lastSuccessAt = systemStatus?.backups.last_success_at ?? null;
  const latestIntegrityBackup = backupsList.find((backup) => (
    backup.status === 'success'
    && backup.verification_scope === 'encrypted_file_integrity'
  )) ?? null;
  const operationalStatus = systemStatus ? operationalSummary(systemStatus) : null;
  const visibleReadinessBlockers = systemStatus
    ? systemStatus.readiness.blockers.filter((blocker) => (
      !isLocalAccessValidationNoise(blocker.code, systemStatus.network.host_type === 'loopback')
    ))
    : [];
  const latestBackupNotConfirmed = systemStatus?.backups.last_success_at
    ? systemStatus.backups.last_success_file_exists === false
      || systemStatus.backups.last_success_checksum_matches === false
    : false;
  const stalePendingCount = systemStatus?.backups.stale_pending_count ?? 0;
  const stalePendingThresholdMinutes = systemStatus?.backups.stale_pending_threshold_minutes ?? 15;
  const advancedStatusId = 'backups-advanced-status';
  const backupCreationStateLoading = canViewSystemStatus ? statusInitialLoading : initialLoading;
  const backupCreationStateError = canViewSystemStatus ? systemStatusError : backupsQueryError;
  const authoritativePendingCount = canViewSystemStatus ? confirmedSystemPendingCount : confirmedHistoryPendingCount;
  const globalBackupStateConfirmed = !backupCreationStateLoading
    && !backupCreationStateError
    && authoritativePendingCount !== null;
  const backupCreationBlocked = !globalBackupStateConfirmed
    || (authoritativePendingCount !== null && authoritativePendingCount > 0);
  const backupCreationGuardMessage = backupCreationStateLoading
    ? 'Confirmando si hay respaldos pendientes antes de habilitar la creación.'
    : backupCreationStateError
      ? 'No se puede crear un respaldo porque no se confirmó si existe otro pendiente.'
      : authoritativePendingCount === null
        ? 'No se pudo confirmar si hay respaldos pendientes. Actualice antes de crear uno.'
        : null;
  const showCreationStateUnavailable = canCreate
    && !backupCreationStateLoading
    && !backupCreationStateError
    && !globalBackupStateConfirmed;

  // Estado tipado explícito: un dato ausente NUNCA se pinta como salud.
  const health: BackupHealth = systemStatusError
    ? 'error'
    : !systemStatus
      ? 'sin-verificar'
      : operationalStatus?.level === 'error'
        ? 'error'
        : operationalStatus?.level === 'review'
          ? 'requiere-prueba'
          : latestIntegrityBackup
            ? 'verificado'
            : 'sin-verificar';
  const lastIntegrityValue = latestIntegrityBackup
    ? formatDate(latestIntegrityBackup.completed_at ?? latestIntegrityBackup.created_at)
    : 'Sin integridad confirmada';
  const restoreStatusValue = latestIntegrityBackup?.restore_tested === true
    ? 'Restauración probada en este equipo'
    : 'Restauración no probada en este equipo';
  const heartbeat = systemStatus
    ? automaticBackupHeartbeatLabel(systemStatus.backups.queue.scheduler_heartbeat)
    : null;
  const automaticLabel = !heartbeat
    ? 'Sin verificar'
    : heartbeat.tone === 'success'
      ? 'Verificado'
      : heartbeat.tone === 'warning'
        ? 'Requiere prueba'
        : 'Sin verificar';
  const pendingFailureValue = pendingCount === null || failedCount === null
    ? 'Sin verificar'
    : `${pendingCount} pendientes · ${failedCount} ${lastSuccessAt ? 'fallidos recientes' : 'fallidos'}`;
  const updatedAtLabel = backupsQuery.dataUpdatedAt > 0
    ? new Date(backupsQuery.dataUpdatedAt).toLocaleString('es-HN')
    : 'Sin verificar';
  const kpis: BackupKpi[] = [
    {
      label: 'Ultimo exitoso',
      value: systemStatus ? (lastSuccessAt ? formatRelativeTime(lastSuccessAt) : 'Sin respaldo') : 'No disponible',
      helper: systemStatus
        ? (lastSuccessAt ? 'Copia creada más reciente; revise su integridad' : 'Cree un respaldo local')
        : 'El historial visible puede estar incompleto: falta el estado del servidor',
    },
    {
      label: 'Pendientes',
      value: pendingCount ?? 'No disponible',
      helper: pendingCount === null
        ? 'El historial visible puede estar incompleto: falta el estado del servidor'
        : pendingCount > 0 ? 'El servidor debe completar estos respaldos' : 'Sin pendientes registrados',
    },
    {
      label: 'Fallidos',
      value: failedCount ?? 'No disponible',
      helper: failedCount === null
        ? 'El historial visible puede estar incompleto: falta el estado del servidor'
        : failedCount > 0
          ? lastSuccessAt
            ? 'Fallos desde la última copia exitosa; revise con soporte'
            : 'Revise con soporte antes de confiar en respaldos'
          : lastSuccessAt
            ? 'Sin fallos desde la última copia exitosa'
            : 'Sin fallos registrados',
    },
  ];

  const normalizedHistoryQuery = historyQuery.trim().toLowerCase();
  const filteredBackups = normalizedHistoryQuery
    ? backupsList.filter((backup) => {
      const haystack = [backup.id, backup.status, backup.created_at, backup.completed_at, backup.creator?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedHistoryQuery);
    })
    : backupsList;

  useEffect(() => {
    if (backupsQueryError) {
      onStatus({ key: 'backups:list:error', level: 'error', message: backupsQueryError });
    }
  }, [backupsQueryError, onStatus]);

  useEffect(() => {
    if (systemStatusError) {
      onStatus({ key: 'backups:status:error', level: 'error', message: systemStatusError });
    }
  }, [systemStatusError, onStatus]);

  function refreshOperationalStatus() {
    setManualError('');
    onStatus({ key: 'backups:refresh', level: 'info', message: 'Actualizando respaldos locales...' });
    void backupsQuery.refetch();
    if (canViewSystemStatus) {
      void systemStatusQuery.refetch();
    }
  }

  async function handleCreateBackup() {
    if (backupCreationBlocked) {
      setConfirmCreateOpen(false);
      onStatus({
        key: 'backups:create:precondition',
        level: 'warning',
        message: backupCreationGuardMessage ?? 'Espere a que termine el respaldo pendiente.',
      });
      return;
    }

    if (creatingBackupRef.current) {
      onStatus({ key: 'backups:create:busy', level: 'warning', message: 'Espere a que termine el respaldo en curso.' });
      return;
    }

    creatingBackupRef.current = true;
    setManualError('');
    onStatus({ key: 'backups:create:progress', level: 'info', message: 'Creando respaldo local...', toast: false });

    try {
      const backup = await createBackupMutation.mutateAsync();
      setPage(1);
      onStatus({
        key: 'backups:create:success',
        level: backup.status === 'success' ? 'success' : 'info',
        message: backup.status === 'success'
          ? backup.verification_scope === 'encrypted_file_integrity'
            ? 'Respaldo creado con integridad verificada. La restauración se prueba por separado.'
            : 'Respaldo creado. Confirme su integridad antes de usarlo.'
          : 'Respaldo registrado. Revise su estado en la lista.',
      });
    } catch (error) {
      const message = safeBackupsErrorMessage(error, 'No se pudo crear el respaldo.');
      setManualError(message);
      onStatus({ key: 'backups:create:error', level: 'error', message });
    } finally {
      creatingBackupRef.current = false;
    }
  }

  async function handleDownloadBackup(backup: BackupLog) {
    if (downloadingBackupRef.current !== null) {
      onStatus({ key: 'backups:download:busy', level: 'warning', message: 'Espere a que termine la descarga actual.' });
      return;
    }

    downloadingBackupRef.current = backup.id;
    setDownloadingBackupId(backup.id);
    setManualError('');

    try {
      const blob = await apiClient.downloadBackup(backup.id);
      downloadBlob(blob, backupDownloadFilename(backup));
      onStatus({ key: 'backups:download:success', level: 'success', message: 'Respaldo descargado correctamente.' });
    } catch (error) {
      const message = safeBackupsErrorMessage(error, 'No se pudo descargar el respaldo.');
      setManualError(message);
      onStatus({ key: 'backups:download:error', level: 'error', message });
    } finally {
      downloadingBackupRef.current = null;
      setDownloadingBackupId(null);
    }
  }

  const isEmpty = canViewBackups && backupsList.length === 0 && !initialLoading && !error && statusFilter === 'all';
  const showHistory = canViewBackups && !initialLoading && !error && (backupsList.length > 0 || statusFilter !== 'all' || normalizedHistoryQuery !== '');
  const visibleCountLabel = initialLoading
    ? 'Conteo pendiente'
    : backupsQueryError && backupsList.length === 0
      ? 'Conteo no disponible'
      : `${filteredBackups.length} respaldo${filteredBackups.length === 1 ? '' : 's'} visible${filteredBackups.length === 1 ? '' : 's'}`;

  return (
    <section id="backups" aria-label="Respaldos y recuperación" className="flex flex-col gap-4">
      <AdminPageHeader
          headingId="backups-title"
          title="Respaldos"
          description="Cree, revise y descargue copias locales de la información del hospital."
          actions={canCreate ? (
            globalBackupStateConfirmed ? (
              <BackupPageActions
                busy={busy}
                createDisabled={authoritativePendingCount !== null && authoritativePendingCount > 0}
                creatingBackup={creatingBackup}
                onCreateRequest={() => setConfirmCreateOpen(true)}
                onRefresh={refreshOperationalStatus}
              />
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <p className="max-w-md text-right text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]" role="status">
                  {showCreationStateUnavailable ? 'Creación temporalmente no disponible.' : backupCreationGuardMessage}
                </p>
                <button type="button" data-ui-press className={PRIMARY_BUTTON} disabled>
                  Crear respaldo
                </button>
              </div>
            )
          ) : (
            <AdminChip tone="neutral">Solo consulta</AdminChip>
          )}
      />

      {statusInitialLoading ? (
        <AdminPanel as="section" aria-label="Salud del respaldo">
          <div className="flex items-center justify-between gap-3 p-4" role="status" aria-label="Verificando salud del respaldo">
            <h2 className="text-[length:var(--ui-text-lg)] font-semibold text-[color:var(--ui-ink)]">Salud del respaldo</h2>
            <span className="rounded-[var(--ui-radius)] border border-[var(--ui-line)] bg-[var(--ui-surface)] px-2 py-0.5 text-[length:var(--ui-text-xs)] font-semibold text-[color:var(--ui-ink-soft)]">
              Estado: Verificando
            </span>
          </div>
        </AdminPanel>
      ) : (
        <BackupHealthPanel
          automaticLabel={automaticLabel}
          health={health}
          kpis={kpis}
          lastIntegrityValue={lastIntegrityValue}
          pendingFailureValue={pendingFailureValue}
          restoreStatusValue={restoreStatusValue}
          updatedAtLabel={updatedAtLabel}
        />
      )}

      {systemStatusError ? (
        <AdminCallout tone="error" title="Estado operativo no disponible">
          <div className="flex flex-col items-start gap-3">
            <span>{systemStatusError}</span>
            <button
              type="button"
              data-ui-press
              className={SECONDARY_BUTTON}
              disabled={systemStatusQuery.isFetching}
              onClick={refreshOperationalStatus}
            >
              {systemStatusQuery.isFetching ? 'Comprobando…' : 'Reintentar estado'}
            </button>
          </div>
        </AdminCallout>
      ) : null}

      {showCreationStateUnavailable ? (
        <AdminCallout tone="warn" title="Estado de creación sin confirmar">
          <div className="flex flex-col items-start gap-3">
            <span>{backupCreationGuardMessage}</span>
            <button
              type="button"
              data-ui-press
              className={SECONDARY_BUTTON}
              disabled={busy}
              onClick={refreshOperationalStatus}
            >
              {busy ? 'Comprobando…' : 'Reintentar estado'}
            </button>
          </div>
        </AdminCallout>
      ) : null}

      {canViewBackups ? <AdminPanel as="section" role="group" aria-label="Historial de respaldos locales">
        <AdminPanelHeader
          id="backup-history-title"
          title="Historial de respaldos"
          description="Ejecuciones locales, estado y descarga autorizada."
        />
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <AdminSearch
              id="backup-history-search"
              label="Buscar respaldo"
              value={historyQuery}
              onValueChange={(value) => { setHistoryQuery(value); setPage(1); }}
              placeholder="Buscar por fecha, estado o usuario…"
              className="sm:max-w-sm"
            />
            <span className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]" aria-live="polite">
              {visibleCountLabel}
            </span>
          </div>

          {initialLoading ? (
            <div role="status" aria-label="Cargando respaldos locales..." className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">Cargando respaldos locales...</div>
          ) : null}

          {error ? (
            <AdminCallout tone="error" title="Error al cargar respaldos">
              {error}
              <div className="mt-3">
                <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={() => { setManualError(''); void backupsQuery.refetch(); }}>Reintentar carga</button>
              </div>
            </AdminCallout>
          ) : null}

          {showHistory ? (
            <>
              <BackupHistoryTable
                backups={filteredBackups}
                canDownload={canDownload}
                downloadingBackupId={downloadingBackupId}
                onDownloadRequest={setDownloadTarget}
                onStatusFilterChange={(filter) => { setStatusFilter(filter); setPage(1); }}
                statusFilter={statusFilter}
              />

              {meta ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">Página {meta.current_page} de {Math.max(1, Math.ceil(meta.total / meta.per_page))}</span>
                  <button type="button" data-ui-press className={SECONDARY_BUTTON} disabled={busy || meta.current_page <= 1} onClick={() => setPage(meta.current_page - 1)} aria-label="Página anterior">Anterior</button>
                  <button type="button" data-ui-press className={SECONDARY_BUTTON} disabled={busy || meta.current_page >= Math.ceil(meta.total / meta.per_page)} onClick={() => setPage(meta.current_page + 1)} aria-label="Página siguiente">Siguiente</button>
                </div>
              ) : null}
            </>
          ) : null}

          {isEmpty ? <BackupEmptyState canCreate={canCreate} /> : null}
        </div>
      </AdminPanel> : null}

      <BackupMaintenanceSection
        advancedStatusId={advancedStatusId}
        latestBackupNotConfirmed={latestBackupNotConfirmed}
        onToggle={setMaintenanceOpen}
        onToggleAdvancedStatus={() => setShowAdvancedStatus((current) => !current)}
        operationalStatus={operationalStatus}
        open={maintenanceOpen}
        readinessBlockers={visibleReadinessBlockers.map((blocker) => friendlyReadinessBlocker(blocker.code, blocker.label))}
        showAdvancedStatus={showAdvancedStatus}
        stalePendingCount={stalePendingCount}
        stalePendingThresholdMinutes={stalePendingThresholdMinutes}
        systemStatus={systemStatus}
      />

      <AdminDialog
        open={confirmCreateOpen}
        onOpenChange={setConfirmCreateOpen}
        title="¿Crear respaldo local?"
        description="Se creará una copia de seguridad local. Confirme que aparezca con integridad verificada antes de usarla. La restauración se prueba por separado."
        footer={(
          <>
            <button type="button" data-ui-press className={SECONDARY_BUTTON} disabled={creatingBackup} onClick={() => setConfirmCreateOpen(false)}>Cancelar</button>
            <button type="button" data-ui-press className={PRIMARY_BUTTON} disabled={creatingBackup || backupCreationBlocked} onClick={() => void handleCreateBackup()}>
              {creatingBackup ? 'Creando…' : 'Crear respaldo'}
            </button>
          </>
        )}
      >
        <p className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">Confirme la creación del respaldo local antes de continuar.</p>
      </AdminDialog>

      <BackupDownloadDialog
        downloadingBackupId={downloadingBackupId}
        onClose={() => setDownloadTarget(null)}
        onConfirm={(backup) => void handleDownloadBackup(backup)}
        target={downloadTarget}
      />
    </section>
  );
}
