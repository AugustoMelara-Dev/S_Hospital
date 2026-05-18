import { Download, RefreshCw, Archive, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Alert } from '../../components/ui/alert';
import { PaginationControls } from '../../components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/data-table';
import { PageHeader } from '../../components/ui/page-header';
import { Card, CardContent } from '../../components/ui/card';
import { BackupStatusBadge, getStatusDescription } from './components/BackupStatusBadge';
import { BackupExplanationCard, BackupEmptyState } from './components/BackupExplanationCard';
import { type AuthUser, type BackupLog, type PaginatedMeta, apiClient, userSafeErrorMessage } from '../../lib/api';

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
  const [backups, setBackups] = useState<BackupLog[]>([]);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const canCreate = user.permissions.includes('backups.create');
  const canDownload = user.permissions.includes('backups.download');

  const filteredBackups = statusFilter === 'all'
    ? backups
    : backups.filter(b => b.status === statusFilter);

  const pendingCount = backups.filter(b => b.status === 'pending').length;
  const successCount = backups.filter(b => b.status === 'success').length;
  const failedCount = backups.filter(b => b.status === 'failed').length;

  const lastSuccessBackup = backups.find(b => b.status === 'success');
  const lastFailedBackup = backups.find(b => b.status === 'failed');

  useEffect(() => {
    void loadBackups(page);
  }, [page]);

  useEffect(() => {
    if (!backups.some((backup) => backup.status === 'pending')) {
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
      const response = await apiClient.getBackups({ page: nextPage });
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

  const isEmpty = backups.length === 0 && !loading;

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
                onClick={() => void loadBackups(page)}
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar
              </Button>
              <Button type="button" size="sm" onClick={handleCreateBackup} disabled={loading}>
                <Archive className="h-4 w-4 mr-2" />
                Crear Backup
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="space-y-6">
        <BackupExplanationCard />

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
                      {pendingCount > 0 ? 'Backups creando' : 'No hay backups en cola'}
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
                      {successCount > 0 ? `${successCount} completados` : 'Sin exitosos'}
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
                        ? `${failedCount} fallidos - click para reintentar`
                        : 'Sin errores'}
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
                  onClick={() => setStatusFilter(filter)}
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
                {filteredBackups.map((backup) => (
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
                          onClick={() => void handleDownloadBackup(backup)}
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
          <BackupEmptyState onCreate={handleCreateBackup} canCreate={canCreate} />
        )}
      </div>
    </section>
  );
}