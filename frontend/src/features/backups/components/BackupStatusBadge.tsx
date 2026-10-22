import { CheckCircle2, Clock3, XCircle } from 'lucide-react';

type BackupStatus = 'pending' | 'success' | 'failed';

/**
 * Fórmula dark §2: texto del tono + fondo translúcido 13 % + borde 36 % del
 * tono (never tono puro sólido). Nunca solo color: el ícono+texto acompaña.
 */
const statusConfig = {
  pending: {
    label: 'Pendiente',
    className: 'border-[var(--ui-warn-border)] bg-[var(--ui-warn-subtle)] text-[color:var(--ui-warn)]',
    icon: Clock3,
  },
  success: {
    label: 'Completado',
    className: 'border-[var(--ui-success-border)] bg-[var(--ui-success-subtle)] text-[color:var(--ui-success)]',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Error',
    className: 'border-[var(--ui-danger-border)] bg-[var(--ui-danger-subtle)] text-[color:var(--ui-danger)]',
    icon: XCircle,
  },
} as const;

export function BackupStatusBadge({ status, className }: { status: BackupStatus; className?: string }) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;
  return (
    <span className={`inline-flex w-fit items-center gap-1.5 rounded-[var(--ui-radius)] border px-1.5 py-0.5 text-[length:var(--ui-text-xs)] font-semibold ${config.className} ${className ?? ''}`}>
      <Icon aria-hidden="true" className="size-3.5" strokeWidth={1.5} />{config.label}
    </span>
  );
}

export function getStatusDescription(status: BackupStatus): string {
  return {
    pending: 'Respaldo en proceso. Si tarda demasiado, revise el estado del servidor.',
    success: 'Archivo creado correctamente. Mantenga una copia protegida.',
    failed: 'No se pudo completar. Revise con soporte antes de crear otro.',
  }[status];
}
