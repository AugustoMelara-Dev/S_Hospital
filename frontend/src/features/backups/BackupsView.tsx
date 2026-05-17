import { useEffect, useState } from 'react';
import { type AuthUser, type BackupLog, apiClient } from '../../lib/api';

type BackupsViewProps = {
  user: AuthUser;
  onStatus: (message: string) => void;
};

export function BackupsView({ user, onStatus }: BackupsViewProps) {
  const [backups, setBackups] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(false);
  const canCreate = user.permissions.includes('backups.create');
  const canDownload = user.permissions.includes('backups.download');

  useEffect(() => {
    void loadBackups();
  }, []);

  async function loadBackups() {
    setLoading(true);
    onStatus('Cargando backups locales...');

    try {
      const response = await apiClient.getBackups();
      setBackups(response.data);
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
          : 'Backup registrado como fallido; revise el servidor.',
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
        <button type="button" onClick={handleCreateBackup} disabled={!canCreate || loading}>
          Crear backup
        </button>
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
