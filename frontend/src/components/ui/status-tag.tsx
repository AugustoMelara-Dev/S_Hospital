import { type ReactNode } from 'react';
import { Tag, type TagProps } from 'antd';

export type StatusTagKind =
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

const STATUS_COLOR: Record<StatusTagKind, string> = {
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

const STATUS_LABEL: Partial<Record<StatusTagKind, string>> = {
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

export type StatusTagProps = Omit<TagProps, 'color'> & {
  children?: ReactNode;
  kind: StatusTagKind;
  label?: ReactNode;
};

/**
 * Institutional status tag. All colors come from Ant Design design tokens; no
 * hex literals allowed in feature code.
 */
export function StatusTag({ children, kind, label, ...props }: StatusTagProps) {
  return (
    <Tag color={STATUS_COLOR[kind]} variant="solid" {...props}>
      {children ?? label ?? STATUS_LABEL[kind] ?? 'Estado'}
    </Tag>
  );
}
