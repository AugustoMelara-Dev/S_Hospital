import { CalendarRange, Database, RefreshCw } from 'lucide-react';
import { formatDateLong, formatLocalizedDateTime } from '@/lib/format/formatDate';

type ReportScopeProps = {
  ariaLabel: string;
  from: string;
  to: string;
  source: string;
  updatedAt?: number | string | null;
};

export function ReportScope({ ariaLabel, from, source, to, updatedAt }: ReportScopeProps) {
  const fromLabel = formatDateLong(`${from}T12:00:00`);
  const toLabel = formatDateLong(`${to}T12:00:00`);
  const updatedLabel = updatedAt
    ? formatLocalizedDateTime(typeof updatedAt === 'number' ? new Date(updatedAt) : updatedAt)
    : 'Al cargar este reporte';

  return (
    <section
      aria-label={ariaLabel}
      className="grid gap-3 rounded-panel border border-operational-border bg-operational-panel/45 px-4 py-3 text-sm sm:grid-cols-3"
    >
      <ScopeItem icon={<CalendarRange aria-hidden="true" />} label="Período">
        {fromLabel} al {toLabel}
      </ScopeItem>
      <ScopeItem icon={<Database aria-hidden="true" />} label="Alcance">
        {source}
      </ScopeItem>
      <ScopeItem icon={<RefreshCw aria-hidden="true" />} label="Última actualización">
        {updatedLabel}
      </ScopeItem>
    </section>
  );
}

function ScopeItem({
  children,
  icon,
  label,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex min-w-0 gap-2.5">
      <span className="mt-0.5 shrink-0 text-hospital-primary [&_svg]:size-4">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-medium leading-relaxed text-foreground">{children}</p>
      </div>
    </div>
  );
}
