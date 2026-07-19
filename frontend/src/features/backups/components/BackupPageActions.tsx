import { Database, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

type BackupPageActionsProps = {
  busy: boolean;
  createDisabled?: boolean;
  creatingBackup: boolean;
  onCreateRequest: () => void;
  onRefresh: () => void;
};

export function BackupPageActions({ busy, createDisabled = false, creatingBackup, onCreateRequest, onRefresh }: BackupPageActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
      {createDisabled ? <p className="text-sm text-muted-foreground">Espere a que termine el respaldo pendiente antes de crear otro.</p> : null}
      <Button type="button" size="sm" variant="outline" onClick={onRefresh} disabled={busy} aria-label="Actualizar respaldos y estado operativo">
        <RefreshCw data-icon="inline-start" />Actualizar
      </Button>
      <Button type="button" size="sm" aria-busy={creatingBackup} onClick={onCreateRequest} disabled={creatingBackup || createDisabled}>
        {creatingBackup ? <Spinner data-icon="inline-start" /> : <Database data-icon="inline-start" />}
        {creatingBackup ? 'Creando…' : 'Crear respaldo'}
      </Button>
    </div>
  );
}
