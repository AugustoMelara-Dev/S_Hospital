import { CheckCircle, Clock, XCircle } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { cn } from '../../../lib/utils';

type BackupStatus = 'pending' | 'success' | 'failed';

const statusConfig = {
  pending: {
    label: 'Pendiente',
    className: 'border-warning/30 bg-warning/10 text-warning',
    icon: Clock,
  },
  success: {
    label: 'Completado',
    className: 'border-success/30 bg-success/10 text-success',
    icon: CheckCircle,
  },
  failed: {
    label: 'Error',
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
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
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold',
        config.className,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </Badge>
  );
}

export function getStatusDescription(status: BackupStatus): string {
  const descriptions: Record<BackupStatus, string> = {
    pending: 'Pendiente del worker de respaldos. Si tarda demasiado, revise el servicio.',
    success: 'Archivo creado con huella SHA256. Valide restore antes de declararlo restaurable.',
    failed: 'No se pudo completar. Revise con soporte antes de crear otro.',
  };

  return descriptions[status];
}
