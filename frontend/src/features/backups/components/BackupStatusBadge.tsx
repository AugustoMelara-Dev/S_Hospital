import { CheckCircle, Clock, XCircle } from 'lucide-react';
import { cn } from '../../../lib/utils';

type BackupStatus = 'pending' | 'success' | 'failed';

const statusConfig = {
  pending: {
    label: 'Pendiente',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: Clock,
  },
  success: {
    label: 'Completado',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: CheckCircle,
  },
  failed: {
    label: 'Fallido',
    className: 'bg-red-100 text-red-800 border-red-200',
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
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        config.className,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}

export function getStatusDescription(status: BackupStatus): string {
  return {
    pending: 'El backup está siendo creado...',
    success: 'Backup creado exitosamente',
    failed: 'El backup falló. Intente nuevamente.',
  }[status];
}