import { Tag, type TagProps } from 'antd';
import type { ReactNode } from 'react';

export type InstitutionalStatusKind =
  | 'normal'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'pending'
  | 'closed'
  | 'failed'
  | 'void'
  | 'open'
  | 'paid'
  | 'partial';

const statusColor: Record<InstitutionalStatusKind, string> = {
  normal: 'default',
  success: 'success',
  warning: 'warning',
  danger: 'error',
  info: 'processing',
  neutral: 'default',
  pending: 'warning',
  closed: 'default',
  failed: 'error',
  void: 'error',
  open: 'success',
  paid: 'success',
  partial: 'warning',
};

const statusLabel: Record<InstitutionalStatusKind, string> = {
  normal: 'Normal',
  success: 'Correcto',
  warning: 'Atención',
  danger: 'Urgente',
  info: 'Información',
  neutral: 'Sin estado',
  pending: 'Pendiente',
  closed: 'Cerrado',
  failed: 'Requiere atención',
  void: 'Anulada',
  open: 'Abierto',
  paid: 'Pagada',
  partial: 'Parcial',
};

type InstitutionalStatusProps = Omit<TagProps, 'color'> & {
  children?: ReactNode;
  status: InstitutionalStatusKind;
};

export function InstitutionalStatus({ children, status, ...props }: InstitutionalStatusProps) {
  return (
    <Tag color={statusColor[status]} variant="solid" {...props}>
      {children ?? statusLabel[status]}
    </Tag>
  );
}
