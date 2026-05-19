import { Download, RefreshCw, Archive, CheckCircle, Clock, XCircle, HardDrive, Server, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
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

type BackupsViewProps = {
  user: AuthUser;
  onStatus: (message: string) => void;
};

type StatusFilter = 'all' | 'pending' | 'success' | 'failed';

function formatBytes(size: number | null): string {
  if (size === null) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-HN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
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
  let [backups, setBackups] = useState<BackupLog[]>([]);
  if (!Array.isArray(backups)) {
    backups = [];
  }
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [systemStatusError, setSystemStatusError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);
  const [downloadTarget, setDownloadTarget] = useState<BackupLog | null>(null);
  const canCreate = user.permissions.includes('backups.create');
  const canDownload = user.permissions.includes('backups.download');

  const backupsList = Array.isArray(backups) ? backups : [];

  const pendingCount = backupsList.filter(b => b.status === 'pending').length;
  const successCount = backupsList.filter(b => b.status === 'success').length;
  const failedCount = backupsList.filter(b => b.status === 'failed').length;

  const lastSuccessBackup = backupsList.find(b => b.status === 'success');
  const lastFailedBackup = backupsList.find(b => b.status === 'failed');

  useEffect(() => {
    void loadBackups(page);
  }, [page, statusFilter]);

  useEffect(() => {
    void loadSystemStatus();
  }, []);

  useEffect(() => {
    if (!backupsList.some((backup) => backup.status === 'pending')) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadBackups(page, false);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [backups, page]);

  async function loadBackups(nextPage: number, announce = true) {
    setLoading(true);
    setError('');
    if (announce) {
      onStatus('Cargando backups locales...');
    }

    try {
      const response = await apiClient.getBackups({ page: nextPage, status: statusFilter });
      setBackups(response.data);
      setMeta(response.meta);
      if (announce) {
        onStatus('Backups locales cargados.');
      }
    } catch (error) {
      const message = userSafeErrorMessage(error, 'No se pudieron cargar los backups.');
      setError(message);
      onStatus(message);
    } finally {
      setLoading(false);
    }
  }

  async function loadSystemStatus() {
    setSystemStatusError('');

    try {
      setSystemStatus(await apiClient.getSystemStatus());
    } catch (error) {
      const message = userSafeErrorMessage(error, 'No se pudo cargar el estado operativo del servidor.');
      setSystemStatusError(message);
    }
  }

  function refreshOperationalStatus() {
    void loadBackups(page);
    void loadSystemStatus();
  }

  async function handleCreateBackup() {
    setLoading(true);
    setError('');
    onStatus('Creando backup local...');

    try {
      const backup = await apiClient.createBackup();
      setBackups((current) => [backup, ...current]);
      onStatus(
        backup.status === 'success'
          ? 'Backup local creado.'
          : 'Backup registrado y en cola local.',
      );
    } catch (error) {
      const message = userSafeErrorMessage(error, 'No se pudo crear el backup.');
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
      onStatus(`Backup ${backup.filename} descargado.`);
    } catch (error) {
      const message = userSafeErrorMessage(error, 'No se pudo descargar el backup.');
      setError(message);
      onStatus(message);
    }
  }

  const isEmpty = backupsList.length === 0 && !loading;

  return (
    <section id="backups" aria-labelledby="backups-title">
      <PageHeader
        title="Backups"
        description="Copias de seguridad de la base de datos"
        actions={
          canCreate ? (
            <div className="flex items-center gap-2">
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
                Crear Backup
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

        {systemStatus ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className={systemStatus.backups.dump_binary.available && systemStatus.backups.storage.writable ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-white/80 p-2.5">
                    <HardDrive className="h-5 w-5 text-slate-700" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold">Backups del servidor</p>
                    <p className="text-xs text-muted-foreground">
                      Dump: {systemStatus.backups.dump_binary.available ? systemStatus.backups.dump_binary.name : 'no detectado'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Almacenamiento: {systemStatus.backups.storage.writable ? 'escribible' : 'no escribible'} · libre {formatBytes(systemStatus.backups.storage.free_bytes)}
                    </p>
                    {systemStatus.backups.last_success_at ? (
                      <p className="text-xs text-muted-foreground">
                        Ultimo exitoso: {formatRelativeTime(systemStatus.backups.last_success_at)}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-700">Sin backup exitoso registrado.</p>
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
                    <p className="text-sm font-semibold">Worker y cola local</p>
                    <p className="text-xs text-muted-foreground">
                      Conexion: {systemStatus.backups.queue.connection}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Jobs backup: {systemStatus.backups.queue.pending_backup_jobs ?? 'no medible'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Pendientes registrados: {systemStatus.backups.pending_count}
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
                    <p className="text-sm font-semibold">{systemStatus.readiness.state}</p>
                    <p className="text-xs text-muted-foreground">
                      Entorno: {systemStatus.environment.app_env} · debug {systemStatus.environment.app_debug ? 'activo' : 'apagado'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      DB: {systemStatus.database.driver} · URL {systemStatus.environment.app_url}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Hora: {formatDate(systemStatus.environment.server_time)} · {systemStatus.environment.timezone}
                    </p>
                    <p className="text-xs text-sky-800">
                      PRODUCTION_READY: {systemStatus.readiness.production_ready ? 'si' : 'no'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {systemStatus?.readiness.blockers.length ? (
          <Alert title="Pendientes antes de PRODUCTION_READY">
            {systemStatus.readiness.blockers.map((blocker) => blocker.label).join(' · ')}
          </Alert>
        ) : null}

        {systemStatus ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardContent className="pt-6">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Checklist operativo de producción</h3>
                    <p className="text-xs text-muted-foreground">
                      Estos checks preparan el servidor, pero no sustituyen la prueba física final.
                    </p>
                  </div>
                  <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800">
                    {systemStatus.readiness.production_ready ? 'PRODUCTION_READY' : 'PRODUCTION_READY: no'}
                  </span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {systemStatus.preflight.production_checks.map((check) => (
                    <div key={check.code} className="rounded-md border border-border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium">{check.label}</p>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(check.status)}`}>
                          {statusLabel(check.status)}
                        </span>
                      </div>
                      <p className="mt-1 break-words text-xs text-muted-foreground">{check.detail}</p>
                    </div>
                  ))}
                  <div className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">Migraciones aplicadas</p>
                      <span className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                        {systemStatus.runtime.migration_count ?? 'N/D'}
                      </span>
                    </div>
                    <p className="mt-1 break-words font-mono text-xs text-muted-foreground">
                      {systemStatus.runtime.latest_migration ?? 'migrations no disponible'}
                    </p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">Jobs fallidos</p>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${systemStatus.backups.queue.failed_jobs_count ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                        {systemStatus.backups.queue.failed_jobs_count ?? 'N/D'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tabla jobs: {systemStatus.backups.queue.jobs_table_available ? 'si' : 'no'} · failed_jobs: {systemStatus.backups.queue.failed_jobs_table_available ? 'si' : 'no'}
                    </p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">Log Laravel</p>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${systemStatus.runtime.laravel_log.exists ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                        {systemStatus.runtime.laravel_log.exists ? formatBytes(systemStatus.runtime.laravel_log.size_bytes) : 'no existe'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ultima escritura: {systemStatus.runtime.laravel_log.modified_at ? formatDate(systemStatus.runtime.laravel_log.modified_at) : 'sin registro'}
                    </p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">Log backup worker</p>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${systemStatus.runtime.backup_automation_log.exists ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                        {systemStatus.runtime.backup_automation_log.exists ? formatBytes(systemStatus.runtime.backup_automation_log.size_bytes) : 'no existe'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Reiniciar: Start-ScheduledTask -TaskName HospitalBillingOS-BackupWorker
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
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Rutas públicas LAN</p>
                    <ul className="mt-2 space-y-2">
                      {systemStatus.preflight.public_routes.map((route) => (
                        <li key={route.path} className="flex items-start justify-between gap-3 rounded-md border border-border p-2">
                          <span>
                            <span className="block font-mono text-sm">{route.path}</span>
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
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Evidencia física</p>
                    <ul className="mt-2 space-y-2">
                      {systemStatus.preflight.physical_proofs.map((proof) => (
                        <li key={proof.code} className="rounded-md border border-border p-2">
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-sm font-medium">{proof.label}</span>
                            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(proof.status)}`}>
                              {statusLabel(proof.status)}
                            </span>
                          </div>
                          <p className="mt-1 break-words font-mono text-xs text-muted-foreground">{proof.required_file}</p>
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
          <Alert variant="destructive" title="Error al cargar backups">
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
                      {pendingCount > 0 ? 'Backups creando en esta pagina' : 'No hay pendientes en esta pagina'}
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
                        : 'Sin backups'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {successCount > 0 ? `${successCount} completados en esta pagina` : 'Sin exitosos en esta pagina'}
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
                        ? `${failedCount} fallidos - revise el detalle y cree un nuevo backup`
                        : 'Sin fallos en esta pagina'}
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
                  {filter === 'all' ? 'Todos' : filter === 'pending' ? 'Pendientes' : filter === 'success' ? 'Exitosos' : 'Fallidos'}
                </Button>
              ))}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tamaño</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backupsList.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      No hay backups con este estado. Quite el filtro para ver todos.
                    </TableCell>
                  </TableRow>
                )}
                {backupsList.map((backup) => (
                  <TableRow key={backup.id}>
                    <TableCell>{formatDate(backup.completed_at ?? backup.created_at)}</TableCell>
                    <TableCell className="font-mono text-sm">{backup.filename}</TableCell>
                    <TableCell>{formatBytes(backup.size_bytes)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <BackupStatusBadge status={backup.status as 'pending' | 'success' | 'failed'} />
                        <span className="text-xs text-muted-foreground">
                          {getStatusDescription(backup.status as 'pending' | 'success' | 'failed')}
                        </span>
                        {backup.status === 'failed' && backup.error_message && (
                          <span className="text-xs text-destructive max-w-[200px] truncate">
                            {backup.error_message}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{backup.creator?.name ?? 'Sistema'}</TableCell>
                    <TableCell className="text-right">
                      {canDownload && backup.status === 'success' ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Descargar backup ${backup.filename}`}
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
        confirmLabel="Crear backup"
        onCancel={() => setConfirmCreateOpen(false)}
        onConfirm={() => {
          setConfirmCreateOpen(false);
          void handleCreateBackup();
        }}
        open={confirmCreateOpen}
        title="¿Crear backup local?"
      >
        Se registrará una copia de seguridad local y puede quedar en cola si el worker de backups no está activo.
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
        title="¿Descargar backup?"
      >
        Descargará el archivo {downloadTarget?.filename}. Esta acción queda auditada.
      </ConfirmDialog>
    </section>
  );
}
