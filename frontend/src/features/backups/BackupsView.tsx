import { useEffect, useRef, useState } from 'react';
import { StatGrid } from '@/components/shared';
import { useBackups, useCreateBackup } from '@/hooks/useBackups';
import { useSystemStatusSnapshot } from '@/hooks/useServerStatus';
import { Alert } from '../../components/ui/alert';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { PaginationControls } from '../../components/ui/pagination';
import { PageHeader } from '../../components/ui/page-header';
import { ErrorState, LoadingState } from '../../components/ui/states';
import { BackupEmptyState } from './components/BackupExplanationCard';
import { BackupHistoryTable } from './components/BackupHistoryTable';
import { BackupPageActions } from './components/BackupPageActions';
import { BackupSupportStatusPanel } from './components/BackupSupportStatusPanel';
import {
  backupDownloadFilename,
  formatBytes,
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

type BackupsViewProps = {
  user: AuthUser;
  onStatus: (message: string) => void;
};

export function BackupsView({ user, onStatus }: BackupsViewProps) {
  const [page, setPage] = useState(1);
  const [manualError, setManualError] = useState('');
  const [showAdvancedStatus, setShowAdvancedStatus] = useState(false);
  const [statusFilter, setStatusFilter] = useState<BackupStatusFilter>('all');
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);
  const [downloadTarget, setDownloadTarget] = useState<BackupLog | null>(null);
  const [downloadingBackupId, setDownloadingBackupId] = useState<number | null>(null);
  const creatingBackupRef = useRef(false);
  const downloadingBackupRef = useRef<number | null>(null);

  const canCreate = user.permissions.includes('backups.create');
  const canDownload = user.permissions.includes('backups.download');
  const canViewSystemStatus = user.permissions.includes('system.status.view');
  const backupsQuery = useBackups({ page, status: statusFilter });
  const createBackupMutation = useCreateBackup();
  const systemStatusQuery = useSystemStatusSnapshot(canViewSystemStatus);

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
  const visiblePendingCount = backupsList.filter((backup) => backup.status === 'pending').length;
  const pendingCount = systemStatus?.backups.pending_count ?? visiblePendingCount;
  const visibleFailedCount = backupsList.filter((backup) => backup.status === 'failed').length;
  const failedCount = systemStatus?.backups.failed_count ?? visibleFailedCount;
  const lastSuccessBackup = backupsList.find((backup) => backup.status === 'success');
  const lastSuccessAt = systemStatus?.backups.last_success_at
    ?? lastSuccessBackup?.completed_at
    ?? lastSuccessBackup?.created_at
    ?? null;
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
    if (canViewSystemStatus) {
      void systemStatusQuery.refetch();
    }
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
            <BackupPageActions
              busy={busy}
              createDisabled={pendingCount > 0}
              creatingBackup={creatingBackup}
              onCreateRequest={() => setConfirmCreateOpen(true)}
              onRefresh={refreshOperationalStatus}
            />
          ) : undefined
        }
      />

      <div className="space-y-6">
        <section aria-label="Indicadores principales de respaldos">
          <StatGrid
            className="sm:grid-cols-2 xl:grid-cols-3"
            items={[
              {
                label: 'Ultimo exitoso',
                value: lastSuccessAt ? formatRelativeTime(lastSuccessAt) : 'Sin respaldo',
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

        {systemStatus && operationalStatus ? (
          <BackupSupportStatusPanel
            advancedStatusId={advancedStatusId}
            latestBackupNotConfirmed={latestBackupNotConfirmed}
            onToggleAdvancedStatus={() => setShowAdvancedStatus((current) => !current)}
            operationalStatus={operationalStatus}
            showAdvancedStatus={showAdvancedStatus}
            stalePendingCount={stalePendingCount}
            systemStatus={systemStatus}
          />
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

        {visibleReadinessBlockers.length ? (
          <Alert title="Pendientes antes de operar">
            {visibleReadinessBlockers.map((blocker) => friendlyReadinessBlocker(blocker.code, blocker.label)).join(' - ')}
          </Alert>
        ) : null}

        {initialLoading ? (
          <LoadingState label="Cargando respaldos locales..." />
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

        {showHistory ? (
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
        ) : null}

        {isEmpty ? (
          <BackupEmptyState canCreate={canCreate} />
        ) : null}
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
