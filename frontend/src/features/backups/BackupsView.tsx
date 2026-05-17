import { useEffect, useState } from 'react';
import { type AuthUser, type BackupLog, type PaginatedMeta, apiClient } from '../../lib/api';

type BackupsViewProps = {
  user: AuthUser;
  onStatus: (message: string) => void;
};

export function BackupsView({ user, onStatus }: BackupsViewProps) {
  const [backups, setBackups] = useState<BackupLog[]>([]);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const canCreate = user.permissions.includes('backups.create');
  const canDownload = user.permissions.includes('backups.download');

  useEffect(() => {
    void loadBackups(page);
  }, [page]);

  async function loadBackups(nextPage: number) {
    setLoading(true);
    onStatus('Cargando backups locales...');

    try {
      const response = await apiClient.getBackups({ page: nextPage });
      setBackups(response.data);
      setMeta(response.meta);
      onStatus('Backups locales cargados.');
    } catch (error) {
      onStatus(error instanceof Error ? error.message : 'No se pudieron cargar los backups.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateBackup() {
    setLoading(true);
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
      onStatus(error instanceof Error ? error.message : 'No se pudo crear el backup.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="backups-layout" aria-labelledby="backups-title">
      <div className="section-heading">
        <div>
          <p className="app-kicker">Fase 8</p>
          <h2 id="backups-title">Backups locales</h2>
        </div>
        {canCreate ? (
          <button type="button" onClick={handleCreateBackup} disabled={loading}>
            Crear backup
          </button>
        ) : null}
      </div>

      {backups.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Estado</th>
                <th>Tamano</th>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Checksum</th>
                <th>Accion</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((backup) => (
                <tr key={backup.id}>
                  <td>{backup.filename}</td>
                  <td>
                    <span className={`status-pill status-${backup.status}`}>{backup.status}</span>
                  </td>
                  <td>{formatBytes(backup.size_bytes)}</td>
                  <td>{formatDate(backup.completed_at ?? backup.created_at)}</td>
                  <td>{backup.creator?.name ?? 'Sistema'}</td>
                  <td className="checksum-cell">{backup.checksum_sha256 ?? 'No disponible'}</td>
                  <td>
                    {canDownload && backup.status === 'success' ? (
                      <button
                        type="button"
                        className="secondary-button compact-button"
                        aria-label={`Descargar backup ${backup.filename}`}
                        onClick={() => window.location.assign(apiClient.backupDownloadUrl(backup.id))}
                      >
                        Descargar
                      </button>
                    ) : (
                      <span className="muted">No disponible</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {meta ? (
            <div className="pagination-row">
              <button
                type="button"
                className="secondary-button"
                disabled={loading || meta.current_page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Anterior
              </button>
              <span className="muted">
                Pagina {meta.current_page} de {Math.max(1, Math.ceil(meta.total / meta.per_page))}
              </span>
              <button
                type="button"
                className="secondary-button"
                disabled={loading || meta.current_page >= Math.ceil(meta.total / meta.per_page)}
                onClick={() => setPage((current) => current + 1)}
              >
                Siguiente
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="notice">No hay backups registrados.</p>
      )}
    </section>
  );
}

function formatBytes(size: number | null): string {
  if (size === null) {
    return 'No disponible';
  }

  if (size < 1024) {
    return `${size} B`;
  }

  return `${(size / 1024).toFixed(1)} KB`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-HN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}
