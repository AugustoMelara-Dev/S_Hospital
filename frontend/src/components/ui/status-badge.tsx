import { type ReactNode } from 'react';
import { Badge } from './badge';

type StatusBadgeProps = {
  status:
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
  children?: ReactNode;
};

const labels: Record<StatusBadgeProps['status'], string> = {
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

const variants: Record<StatusBadgeProps['status'], React.ComponentProps<typeof Badge>['variant']> = {
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

export function StatusBadge({ children, status }: StatusBadgeProps) {
  return <Badge variant={variants[status]}>{children ?? labels[status]}</Badge>;
}
