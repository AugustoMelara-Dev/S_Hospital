import { CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type BackupStatus = 'pending' | 'success' | 'failed';

const statusConfig = {
  pending: { label: 'Pendiente', variant: 'secondary' as const, icon: Clock3 },
  success: { label: 'Completado', variant: 'default' as const, icon: CheckCircle2 },
  failed: { label: 'Error', variant: 'destructive' as const, icon: XCircle },
};

export function BackupStatusBadge({ status, className }: { status: BackupStatus; className?: string }) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;
  return <Badge variant={config.variant} className={className}><Icon aria-hidden="true" />{config.label}</Badge>;
}

export function getStatusDescription(status: BackupStatus): string {
  return {
    pending: 'Respaldo en proceso. Si tarda demasiado, revise el estado del servidor.',
    success: 'Archivo creado correctamente. Mantenga una copia protegida.',
    failed: 'No se pudo completar. Revise con soporte antes de crear otro.',
  }[status];
}
