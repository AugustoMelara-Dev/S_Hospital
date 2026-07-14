import { CloudServerOutlined, DisconnectOutlined, WalletOutlined, WifiOutlined } from '@ant-design/icons';
import { Space, Tag } from 'antd';
import { type CashSession } from '../../lib/api';

type OperationalStatusProps = {
  cashSession: CashSession | null;
  isOnline: boolean;
  lastCheck: Date | null;
  status: string;
};

export function OperationalStatus({
  cashSession,
  isOnline,
  lastCheck,
  status,
}: OperationalStatusProps) {
  const cashIsOpen = cashSession?.status === 'open';
  const cashLabel = cashSession?.status === 'open' ? `Caja #${cashSession.id}` : 'Sin caja abierta';
  const localConnectionStatusTitle = isOnline
    ? `Conexion local disponible${lastCheck ? `. Ultima revision: ${lastCheck.toLocaleTimeString()}` : ''}`
    : `Sin conexion al servidor local. Estado: ${status}`;

  return (
    <Space
      data-slot="topbar-operational-status"
      aria-label="Indicadores operativos"
    >
      <Tag
        color={isOnline ? 'success' : 'error'}
        icon={isOnline ? <WifiOutlined data-icon aria-hidden="true" /> : <DisconnectOutlined data-icon aria-hidden="true" />}
        title={localConnectionStatusTitle}
        aria-label={localConnectionStatusTitle}
      >
        {isOnline ? 'Conexion local activa' : 'Sin conexion'}
      </Tag>

      <Tag
        color={cashIsOpen ? 'processing' : 'warning'}
        icon={<WalletOutlined data-icon aria-hidden="true" />}
        title={cashLabel}
      >
        {cashLabel}
      </Tag>

      {!isOnline && (
        <Tag color="error" icon={<CloudServerOutlined data-icon aria-hidden="true" />}>Revisar servidor</Tag>
      )}
    </Space>
  );
}
