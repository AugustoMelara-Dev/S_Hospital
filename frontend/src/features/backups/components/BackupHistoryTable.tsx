import { Download } from 'lucide-react';
import { AdminTable, type AdminColumn } from '@/design-system/admin/components';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { BackupLog } from '@/lib/api';
import { formatLocalizedDateTime } from '@/lib/format/formatDate';
import { SECONDARY_BUTTON } from '../backupsUi';
import { formatBytes } from '../backupPresentation';
import { BackupStatusBadge, getStatusDescription } from './BackupStatusBadge';

type BackupStatusFilter = 'all' | 'pending' | 'success' | 'failed';
type Props = { backups: BackupLog[]; canDownload: boolean; downloadingBackupId: number | null; onDownloadRequest: (backup: BackupLog) => void; onStatusFilterChange: (filter: BackupStatusFilter) => void; statusFilter: BackupStatusFilter };
const filterOptions = [{ label: 'Todos', value: 'all' }, { label: 'Pendientes', value: 'pending' }, { label: 'Completados', value: 'success' }, { label: 'Fallidos', value: 'failed' }] as const;

export function BackupHistoryTable({ backups, canDownload, downloadingBackupId, onDownloadRequest, onStatusFilterChange, statusFilter }: Props) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const emptyMessage = statusFilter === 'all' ? 'No hay respaldos registrados' : 'No hay respaldos con este estado';
  const columns: Array<AdminColumn<BackupLog>> = [
    { key: 'date', header: 'Fecha', mobilePrimary: true, cell: (backup) => formatDate(backup.completed_at ?? backup.created_at) },
    { key: 'status', header: 'Estado', cell: (backup) => <StatusCell backup={backup} /> },
    { key: 'size', header: 'Tamaño', align: 'right', cell: (backup) => <span className="tabular-nums">{formatBytes(backup.size_bytes)}</span> },
    { key: 'user', header: 'Usuario', cell: (backup) => backup.creator?.name ?? 'Sistema' },
    { key: 'actions', header: 'Acciones', align: 'right', cell: (backup) => <DownloadAction backup={backup} canDownload={canDownload} downloadingBackupId={downloadingBackupId} onDownloadRequest={onDownloadRequest} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div
        role="radiogroup"
        aria-label="Filtros de estado de respaldos"
        className="flex w-fit flex-wrap gap-1 border-b border-[var(--ui-line)]"
      >
        {filterOptions.map((option) => (
          <label key={option.value} className="-mb-px cursor-pointer">
            <input
              type="radio"
              name="backup-status-filter"
              value={option.value}
              checked={statusFilter === option.value}
              onChange={() => onStatusFilterChange(option.value)}
              className="peer sr-only"
            />
            <span className="flex h-[var(--ui-control-h)] items-center border-b-2 border-transparent px-3 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)] hover:border-[var(--ui-line-strong)] hover:text-[color:var(--ui-ink)] peer-checked:border-[var(--ui-action)] peer-checked:font-semibold peer-checked:text-[color:var(--ui-action)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--ui-focus)]">
              {option.label}
            </span>
          </label>
        ))}
      </div>

      <div role="region" aria-label="Historial de respaldos locales">
        {isMobile ? (
          backups.length ? (
            <ul aria-label="Historial de respaldos locales" className="flex flex-col divide-y divide-[var(--ui-line)] overflow-hidden rounded-[var(--ui-radius)] border border-[var(--ui-line)]">
              {backups.map((backup) => (
                <li key={backup.id} className="flex flex-col gap-3 bg-[var(--ui-surface)] p-4">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <strong className="block [overflow-wrap:anywhere]">{formatDate(backup.completed_at ?? backup.created_at)}</strong>
                      <p className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">{backup.creator?.name ?? 'Sistema'} · {formatBytes(backup.size_bytes)}</p>
                    </div>
                    <BackupStatusBadge status={backup.status} />
                  </div>
                  <p className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">{getStatusDescription(backup.status)}</p>
                  <BackupVerificationSummary backup={backup} />
                  {backup.status === 'failed' ? <p className="w-fit rounded-[var(--ui-radius)] border border-[var(--ui-danger-border)] bg-[var(--ui-danger-subtle)] px-1.5 py-0.5 text-[length:var(--ui-text-xs)] font-semibold text-[color:var(--ui-danger)]">No se completó. Revise con soporte técnico.</p> : null}
                  <DownloadAction backup={backup} canDownload={canDownload} downloadingBackupId={downloadingBackupId} onDownloadRequest={onDownloadRequest} showLabel />
                </li>
              ))}
            </ul>
          ) : (
            <p role="status" className="rounded-[var(--ui-radius)] border border-dashed border-[var(--ui-line-strong)] bg-[var(--ui-surface-alt)] px-4 py-6 text-center text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">{emptyMessage}</p>
          )
        ) : (
          <AdminTable<BackupLog>
            caption="Historial de respaldos locales"
            columns={columns}
            rows={backups}
            getRowKey={(backup) => String(backup.id)}
            empty={emptyMessage}
          />
        )}
      </div>
    </div>
  );
}

function StatusCell({ backup }: { backup: BackupLog }) {
  return (
    <div className="flex flex-col gap-1">
      <BackupStatusBadge status={backup.status} />
      <span className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">{getStatusDescription(backup.status)}</span>
      <BackupVerificationSummary backup={backup} />
    </div>
  );
}

function BackupVerificationSummary({ backup }: { backup: BackupLog }) {
  if (backup.status !== 'success') return null;

  return (
    <span className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
      {backup.verification_scope === 'encrypted_file_integrity' ? 'Copia revisada' : 'Copia sin revisar'}
      {' · '}
      {backup.restore_tested === true ? 'Recuperación ensayada en este equipo' : 'Recuperación aún no ensayada en este equipo'}
    </span>
  );
}

function DownloadAction({ backup, canDownload, downloadingBackupId, onDownloadRequest, showLabel = false }: { backup: BackupLog; canDownload: boolean; downloadingBackupId: number | null; onDownloadRequest: (backup: BackupLog) => void; showLabel?: boolean }) {
  if (!canDownload || backup.status !== 'success') return <span className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">Sin descarga</span>;
  return (
    <button
      type="button"
      data-ui-press
      className={SECONDARY_BUTTON}
      aria-label={`Descargar respaldo del ${formatDate(backup.completed_at ?? backup.created_at)}`}
      disabled={downloadingBackupId !== null}
      onClick={() => onDownloadRequest(backup)}
    >
      <Download aria-hidden="true" className="size-4" strokeWidth={1.5} />{showLabel ? 'Descargar' : null}
    </button>
  );
}

function formatDate(value: string) { return formatLocalizedDateTime(value); }
