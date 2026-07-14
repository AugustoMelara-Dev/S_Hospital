import { CheckCircleOutlined as CheckCircle, ClockCircleOutlined as Clock, CloseCircleOutlined as XCircle } from '@ant-design/icons';
import { Tag } from 'antd';

type BackupStatus = 'pending' | 'success' | 'failed';

const statusConfig = {
  pending: {
    label: 'Pendiente',
    color: 'warning',
    icon: Clock,
  },
  success: {
    label: 'Completado',
    color: 'success',
    icon: CheckCircle,
  },
  failed: {
    label: 'Error',
    color: 'error',
    icon: XCircle,
  },
};

interface BackupStatusBadgeProps {
  status: BackupStatus;
  className?: string;
}

export function BackupStatusBadge({ status, className }: BackupStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <Tag color={config.color} className={className} icon={<Icon aria-hidden="true" />}>
      {config.label}
    </Tag>
  );
}

export function getStatusDescription(status: BackupStatus): string {
  const descriptions: Record<BackupStatus, string> = {
    pending: 'Respaldo en proceso. Si tarda demasiado, revise el estado del servidor.',
    success: 'Archivo creado correctamente. Mantenga una copia protegida.',
    failed: 'No se pudo completar. Revise con soporte antes de crear otro.',
  };

  return descriptions[status];
}
