import { formatLocalizedDateTime } from './format/formatDate';

type BackupLabelInput = {
  completed_at?: string | null;
  created_at?: string | null;
  type: string;
};

export function backupTypeLabel(type: string): string {
  return { manual: 'Manual', scheduled: 'Automatico' }[type] ?? 'Operativo';
}

export function backupStatusLabel(status: string): string {
  return { pending: 'Pendiente', success: 'Protegido', failed: 'Error' }[status] ?? 'Pendiente';
}

export function backupDisplayName(backup: BackupLabelInput): string {
  const typeLabel = backupTypeLabel(backup.type).toLowerCase();
  const dateLabel = formatLocalizedDateTime(backup.completed_at ?? backup.created_at);
  return `Respaldo ${typeLabel} - ${dateLabel === '-' ? 'fecha no disponible' : dateLabel}`;
}
