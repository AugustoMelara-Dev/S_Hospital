import { CalendarDaysIcon, DatabaseIcon, RefreshCwIcon } from 'lucide-react';
import { formatDateLong, formatLocalizedDateTime } from '@/lib/format/formatDate';

type Props = { ariaLabel: string; from: string; to: string; source: string; updatedAt?: number | string | null };

export function ReportScope({ ariaLabel, from, source, to, updatedAt }: Props) {
  const updated = updatedAt ? formatLocalizedDateTime(typeof updatedAt === 'number' ? new Date(updatedAt) : updatedAt) : 'Al cargar este reporte';
  const items = [
    { key: 'period', label: 'Período', icon: CalendarDaysIcon, value: `${formatDateLong(`${from}T12:00:00`)} al ${formatDateLong(`${to}T12:00:00`)}` },
    { key: 'source', label: 'Alcance', icon: DatabaseIcon, value: source },
    { key: 'updated', label: 'Última actualización', icon: RefreshCwIcon, value: updated },
  ];
  return <section aria-label={ariaLabel} className="rounded-xl border border-border bg-card p-3"><dl className="grid gap-3 md:grid-cols-3">{items.map((item) => { const Icon = item.icon; return <div key={item.key}><dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Icon aria-hidden="true" className="size-4" />{item.label}</dt><dd className="mt-1 text-sm">{item.value}</dd></div>; })}</dl></section>;
}
