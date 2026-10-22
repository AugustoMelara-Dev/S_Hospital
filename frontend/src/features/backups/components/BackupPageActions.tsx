import { Database, RefreshCw } from 'lucide-react';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../backupsUi';

type BackupPageActionsProps = {
  busy: boolean;
  createDisabled?: boolean;
  creatingBackup: boolean;
  onCreateRequest: () => void;
  onRefresh: () => void;
};

export function BackupPageActions({ busy, createDisabled = false, creatingBackup, onCreateRequest, onRefresh }: BackupPageActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {createDisabled ? <p className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">Espere a que termine el respaldo pendiente antes de crear otro.</p> : null}
      <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={onRefresh} disabled={busy} aria-label="Actualizar respaldos y estado operativo">
        <RefreshCw aria-hidden="true" className="size-4" strokeWidth={1.5} />Actualizar
      </button>
      <button type="button" data-ui-press className={PRIMARY_BUTTON} aria-busy={creatingBackup} onClick={onCreateRequest} disabled={creatingBackup || createDisabled}>
        <Database aria-hidden="true" className="size-4" strokeWidth={1.5} />
        {creatingBackup ? 'Creando…' : 'Crear respaldo'}
      </button>
    </div>
  );
}
