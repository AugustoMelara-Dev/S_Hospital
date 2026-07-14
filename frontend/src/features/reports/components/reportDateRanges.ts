export type PresetKey = 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'lastMonth' | 'custom';

export const PRESET_LABELS: Record<PresetKey, string> = {
  today: 'Hoy',
  yesterday: 'Ayer',
  last7: '7 dias',
  thisMonth: 'Este mes',
  lastMonth: 'Mes anterior',
  custom: 'Personalizado',
};

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function computePresetRange(preset: PresetKey): { from: string; to: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - 6);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

  switch (preset) {
    case 'today':
      return { from: formatDate(today), to: formatDate(today) };
    case 'yesterday':
      return { from: formatDate(yesterday), to: formatDate(yesterday) };
    case 'last7':
      return { from: formatDate(startOfWeek), to: formatDate(today) };
    case 'thisMonth':
      return { from: formatDate(startOfMonth), to: formatDate(today) };
    case 'lastMonth':
      return { from: formatDate(startOfLastMonth), to: formatDate(endOfLastMonth) };
    case 'custom':
    default:
      return { from: formatDate(startOfMonth), to: formatDate(today) };
  }
}

export function parseReportDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
}
