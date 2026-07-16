import { cloneElement, isValidElement, useEffect, useRef, useState, type ReactElement } from 'react';
import { Alert, Button, Col, Flex, Modal, Pagination, Result, Row, Spin, Statistic, Typography } from 'antd';
import { useBackups, useCreateBackup } from '@/hooks/useBackups';
import { useSystemStatusSnapshot } from '@/hooks/useServerStatus';
import { BackupEmptyState } from './components/BackupExplanationCard';
import { BackupHistoryTable } from './components/BackupHistoryTable';
import { BackupPageActions } from './components/BackupPageActions';
import { PageHeader } from '@/design-system/components/PageHeader';
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
  const pendingCount = systemStatus?.backups.pending_count ?? null;
  const failedCount = systemStatus?.backups.failed_count ?? null;
  const lastSuccessAt = systemStatus?.backups.last_success_at ?? null;
  const unavailableGlobalMetricHelper = 'El historial visible no resume todos los respaldos';
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
          ? 'Respaldo completado correctamente.'
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

  const isEmpty = backupsList.length === 0 && !initialLoading && !error && statusFilter === 'all';
  const showHistory = !initialLoading && !error && (backupsList.length > 0 || statusFilter !== 'all');

  return (
    <section id="backups" aria-label="Protección y recuperación" className="flex flex-col gap-6">
      <PageHeader
        title="Protección y recuperación"
        description="Estado, creación y descarga autorizada de copias locales de facturación, caja y reportes."
        actions={canCreate ? (
            <BackupPageActions
              busy={busy}
              createDisabled={(pendingCount ?? visiblePendingCount) > 0}
              creatingBackup={creatingBackup}
              onCreateRequest={() => setConfirmCreateOpen(true)}
              onRefresh={refreshOperationalStatus}
            />
          ) : undefined}
      />

      {backupsQuery.dataUpdatedAt > 0 ? (
        <p className="text-sm text-muted-foreground" role="status">
          Última actualización: {new Date(backupsQuery.dataUpdatedAt).toLocaleString('es-HN')}
        </p>
      ) : null}

      <div className="space-y-6">
        <section aria-label="Indicadores principales de respaldos">
          <Row gutter={[16, 16]}>
            {[
              {
                label: 'Ultimo exitoso',
                value: systemStatus ? (lastSuccessAt ? formatRelativeTime(lastSuccessAt) : 'Sin respaldo') : 'No disponible',
                helper: systemStatus
                  ? (lastSuccessAt ? 'Respaldo protegido mas reciente' : 'Cree un respaldo local protegido')
                  : unavailableGlobalMetricHelper,
                tone: systemStatus && lastSuccessAt ? 'success' : 'warning',
              },
              {
                label: 'Pendientes',
                value: pendingCount ?? 'No disponible',
                helper: pendingCount === null
                  ? unavailableGlobalMetricHelper
                  : pendingCount > 0 ? 'El servidor debe completar estos respaldos' : 'Sin pendientes registrados',
                tone: pendingCount !== null && pendingCount > 0 ? 'warning' : 'success',
              },
              {
                label: 'Fallidos',
                value: failedCount ?? 'No disponible',
                helper: failedCount === null
                  ? unavailableGlobalMetricHelper
                  : failedCount > 0 ? 'Revise con soporte antes de confiar en respaldos' : 'Sin errores registrados',
                tone: failedCount !== null && failedCount > 0 ? 'destructive' : 'success',
              },
            ].map((item) => <Col xs={24} sm={12} xl={8} key={item.label}><article aria-label={item.label}><Statistic title={item.label} value={item.value} /><p>{item.helper}</p></article></Col>)}
          </Row>
        </section>

        {systemStatusError ? (
          <Alert type="error" showIcon title="Estado operativo no disponible" description={systemStatusError} />
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
          <Alert type="warning" showIcon title="Respaldo reciente no confirmado" description="El último respaldo exitoso registrado no se puede confirmar en el servidor local. Cree un respaldo nuevo antes de confiar en la recuperación." />
        ) : null}

        {stalePendingCount > 0 ? (
          <Alert type="warning" showIcon title="Respaldos pendientes por demasiado tiempo" description={`${stalePendingCount} respaldo(s) siguen pendientes por más de ${stalePendingThresholdMinutes} minutos. Revise el estado del servidor local antes de confiar en la automatización.`} />
        ) : null}

        {visibleReadinessBlockers.length ? (
          <Alert type="warning" showIcon title="Pendientes antes de operar" description={visibleReadinessBlockers.map((blocker) => friendlyReadinessBlocker(blocker.code, blocker.label)).join(' - ')} />
        ) : null}

        {initialLoading ? (
          <div role="status" aria-label="Cargando respaldos locales..."><Spin /> Cargando respaldos locales...</div>
        ) : null}

        {error ? (
          <div role="alert"><Result
            status="error"
            title="Error al cargar respaldos"
            subTitle={error}
            extra={<Button onClick={() => {
              setManualError('');
              void backupsQuery.refetch();
            }}>Reintentar carga</Button>}
          /></div>
        ) : null}

        {showHistory ? (
          <section aria-label="Historial de respaldos locales" className="overflow-hidden border border-operational-border bg-operational-surface p-4 sm:p-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold tracking-tight">Historial de respaldos</h2>
              <p className="text-sm text-muted-foreground">Ejecuciones locales, estado y descarga autorizada.</p>
            </div>
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
              <Flex align="center" gap="middle" wrap>
                <Typography.Text type="secondary">
                  Página {meta.current_page} de {Math.max(1, Math.ceil(meta.total / meta.per_page))}
                </Typography.Text>
                <Pagination
                disabled={busy}
                current={meta.current_page}
                pageSize={meta.per_page}
                total={meta.total}
                showSizeChanger={false}
                onChange={setPage}
                itemRender={(_, type, originalElement) => {
                  if (!isValidElement(originalElement) || (type !== 'prev' && type !== 'next')) {
                    return originalElement;
                  }
                  const label = type === 'prev' ? 'Página anterior' : 'Página siguiente';
                  return cloneElement(originalElement as ReactElement<Record<string, unknown>>, {
                    'aria-label': label,
                    title: label,
                  });
                }}
                />
              </Flex>
            ) : null}
          </section>
        ) : null}

        {isEmpty ? (
          <BackupEmptyState canCreate={canCreate} />
        ) : null}
      </div>

      <Modal
        okButtonProps={{ disabled: creatingBackup }}
        cancelButtonProps={{ disabled: creatingBackup }}
        okText={creatingBackup ? 'Creando...' : 'Crear respaldo'}
        onCancel={() => setConfirmCreateOpen(false)}
        onOk={() => {
          setConfirmCreateOpen(false);
          void handleCreateBackup();
        }}
        open={confirmCreateOpen}
        title="¿Crear respaldo local?"
      >
        Se creará una copia de seguridad local. Confirme que aparezca como protegida antes de cerrar esta pantalla.
      </Modal>

      <Modal
        okButtonProps={{ disabled: downloadTarget ? downloadingBackupId === downloadTarget.id : false }}
        cancelButtonProps={{ disabled: downloadTarget ? downloadingBackupId === downloadTarget.id : false }}
        okText={downloadTarget && downloadingBackupId === downloadTarget.id ? 'Descargando...' : 'Descargar'}
        onCancel={() => setDownloadTarget(null)}
        onOk={() => {
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
            <dl className="grid gap-2 border border-border bg-muted/35 p-3 sm:grid-cols-2">
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
      </Modal>
    </section>
  );
}
