import { DatabaseOutlined as Archive, ReloadOutlined as RefreshCw } from '@ant-design/icons';
import { Button, Space } from 'antd';

type BackupPageActionsProps = {
  busy: boolean;
  createDisabled?: boolean;
  creatingBackup: boolean;
  onCreateRequest: () => void;
  onRefresh: () => void;
};

export function BackupPageActions({
  busy,
  createDisabled = false,
  creatingBackup,
  onCreateRequest,
  onRefresh,
}: BackupPageActionsProps) {
  return (
    <Space wrap className="border border-white/15 bg-white/5 p-2">
      {createDisabled ? (
        <p className="text-sm text-muted-foreground">Espere a que termine el respaldo pendiente antes de crear otro.</p>
      ) : null}
      <Button
        htmlType="button"
        size="small"
        icon={<RefreshCw aria-hidden="true" />}
        onClick={onRefresh}
        disabled={busy}
        aria-label="Actualizar respaldos y estado operativo"
      >
        Actualizar
      </Button>
      <Button
        type="primary"
        htmlType="button"
        size="small"
        icon={<Archive aria-hidden="true" />}
        aria-busy={creatingBackup}
        onClick={onCreateRequest}
        disabled={creatingBackup || createDisabled}
      >
        {creatingBackup ? 'Creando...' : 'Crear respaldo'}
      </Button>
    </Space>
  );
}
