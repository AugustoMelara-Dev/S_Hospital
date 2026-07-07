import { Archive, RefreshCw } from 'lucide-react';
import { ActionBar } from '@/components/ui/action-bar';
import { Button } from '@/components/ui/button';

type BackupPageActionsProps = {
  busy: boolean;
  creatingBackup: boolean;
  onCreateRequest: () => void;
  onRefresh: () => void;
};

export function BackupPageActions({
  busy,
  creatingBackup,
  onCreateRequest,
  onRefresh,
}: BackupPageActionsProps) {
  return (
    <ActionBar align="end" fullWidthOnMobile>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={busy}
        aria-label="Actualizar respaldos y estado operativo"
      >
        <RefreshCw aria-hidden="true" className="h-4 w-4 mr-2" />
        Actualizar
      </Button>
      <Button
        type="button"
        size="sm"
        aria-busy={creatingBackup}
        onClick={onCreateRequest}
        disabled={creatingBackup}
      >
        <Archive aria-hidden="true" className="h-4 w-4 mr-2" />
        {creatingBackup ? 'Creando...' : 'Crear respaldo'}
      </Button>
    </ActionBar>
  );
}
