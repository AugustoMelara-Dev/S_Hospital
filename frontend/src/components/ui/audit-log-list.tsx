import { useId } from 'react';
import { EmptyState } from './states';
import { formatLocalizedDateTime } from '@/lib/format/formatDate';

export type AuditLogEntry = {
  id?: number | string;
  action: string;
  result?: 'success' | 'denied' | 'error' | string;
  reason?: string | null;
  user?: { name?: string | null; username?: string | null } | null;
  created_at?: string | null;
  ip?: string | null;
  entity_type?: string | null;
  entity_id?: number | string | null;
};

type AuditLogListProps = {
  entries: AuditLogEntry[];
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
};

function humanizeAction(action: string): string {
  return action
    .replace(/[._]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function humanizeResult(result: string | undefined): string {
  if (!result) return '';
  if (result === 'success') return 'Éxito';
  if (result === 'denied') return 'Denegado';
  if (result === 'error') return 'Con error';
  return result;
}

function resultTone(result: string | undefined): string {
  if (result === 'denied' || result === 'error') {
    return 'border-destructive/40 bg-destructive/10 text-destructive';
  }
  if (result === 'success') {
    return 'border-success/40 bg-success/10 text-success-foreground';
  }
  return 'border-operational-border bg-operational-panel text-muted-foreground';
}

export function AuditLogList({
  entries,
  emptyTitle = 'Sin movimientos auditados',
  emptyDescription = 'Las acciones críticas aparecerán registradas aquí.',
  className,
}: AuditLogListProps) {
  const headingId = useId();

  if (entries.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        className={className}
      />
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      className={className}
      data-slot="audit-log-list"
    >
      <h2 id={headingId} className="sr-only">
        Listado de auditoría
      </h2>
      <ol className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li
            key={entry.id ?? `${entry.action}-${entry.created_at ?? ''}`}
            className="rounded-md border border-operational-border bg-operational-surface p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {humanizeAction(entry.action)}
                </p>
                {entry.user?.name ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {entry.user.name}
                    {entry.user.username ? ` (${entry.user.username})` : ''}
                  </p>
                ) : null}
                {entry.reason ? (
                  <p className="mt-1 text-xs text-foreground">
                    <span className="font-semibold">Motivo:</span>{' '}
                    {entry.reason}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-1 text-right">
                <span
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${resultTone(entry.result)}`}
                >
                  {humanizeResult(entry.result)}
                </span>
                <time className="text-xs tabular-nums text-muted-foreground" dateTime={entry.created_at ?? undefined}>
                  {entry.created_at ? formatLocalizedDateTime(entry.created_at) : 'Sin fecha'}
                </time>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}