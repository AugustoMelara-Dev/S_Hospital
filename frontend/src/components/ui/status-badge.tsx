import { Circle } from 'lucide-react';
import { type ReactNode } from 'react';
import { Badge } from './badge';

type KnownStatus =
  | 'active'
  | 'closed'
  | 'failed'
  | 'info'
  | 'open'
  | 'paid'
  | 'partial'
  | 'pending'
  | 'success'
  | 'void';

type StatusBadgeProps = {
  children?: ReactNode;
  className?: string;
  icon?: ReactNode;
  status: KnownStatus | (string & {});
};

const labels: Record<KnownStatus, string> = {
  active: 'Activo',
  closed: 'Cerrado',
  failed: 'Requiere atención',
  info: 'Información',
  open: 'Abierto',
  paid: 'Pagada',
  partial: 'Parcial',
  pending: 'Pendiente',
  success: 'Correcto',
  void: 'Anulada',
};

const variants: Record<KnownStatus, React.ComponentProps<typeof Badge>['variant']> = {
  active: 'success',
  closed: 'secondary',
  failed: 'destructive',
  info: 'info',
  open: 'success',
  paid: 'success',
  partial: 'warning',
  pending: 'warning',
  success: 'success',
  void: 'destructive',
};

export function StatusBadge({ children, className, icon, status }: StatusBadgeProps) {
  const knownStatus = isKnownStatus(status) ? status : undefined;

  return (
    <Badge variant={knownStatus ? variants[knownStatus] : 'secondary'} className={className}>
      {icon ?? <Circle data-icon aria-hidden="true" className="size-2 fill-current" />}
      {children ?? (knownStatus ? labels[knownStatus] : 'Estado desconocido')}
    </Badge>
  );
}

function isKnownStatus(status: string): status is KnownStatus {
  return Object.prototype.hasOwnProperty.call(labels, status);
}
