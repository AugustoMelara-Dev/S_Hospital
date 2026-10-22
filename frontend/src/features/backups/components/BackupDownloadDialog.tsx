import { AdminDialog } from '@/design-system/admin/components';
import { formatBytes, formatDate } from '../backupPresentation';
import type { BackupLog } from '@/lib/api';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../backupsUi';

type Props = {
  downloadingBackupId: number | null;
  onClose: () => void;
  onConfirm: (backup: BackupLog) => void;
  target: BackupLog | null;
};

export function BackupDownloadDialog({ downloadingBackupId, onClose, onConfirm, target }: Props) {
  const busy = target ? downloadingBackupId === target.id : false;
  return (
    <AdminDialog
      open={Boolean(target)}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="¿Descargar respaldo?"
      description="Descargará el respaldo seleccionado. Esta acción queda auditada."
      footer={(
        <>
          <button type="button" data-ui-press className={SECONDARY_BUTTON} disabled={busy} onClick={onClose}>Cancelar</button>
          <button
            type="button"
            data-ui-press
            className={PRIMARY_BUTTON}
            disabled={busy}
            onClick={() => { const selected = target; onClose(); if (selected) onConfirm(selected); }}
          >
            {busy ? 'Descargando…' : 'Descargar'}
          </button>
        </>
      )}
    >
      {target ? (
        <dl className="grid gap-2 rounded-[var(--ui-radius)] border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] p-3 sm:grid-cols-2">
          <div>
            <dt className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-ink-soft)]">Fecha</dt>
            <dd className="font-semibold text-[color:var(--ui-ink)]">{formatDate(target.completed_at ?? target.created_at)}</dd>
          </div>
          <div>
            <dt className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-ink-soft)]">Tamaño</dt>
            <dd className="font-semibold text-[color:var(--ui-ink)]">{formatBytes(target.size_bytes)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-ink-soft)]">Usuario</dt>
            <dd className="font-semibold text-[color:var(--ui-ink)]">{target.creator?.name ?? 'Sistema'}</dd>
          </div>
        </dl>
      ) : null}
    </AdminDialog>
  );
}
