import { useState } from 'react';
import { AdminCallout, AdminDialog, MoneyText } from '@/design-system/admin/components';
import { formatDateTime } from '@/lib/format/formatDate';
import { parseCents } from '@/lib/moneyCents';
import type { Service, ServiceHistoryChange } from '@/lib/api';
import { useCatalogServiceHistory } from '@/hooks/useCatalogService';
import { SECONDARY_BUTTON } from './catalogUi';

type ServiceHistoryDialogProps = {
  open: boolean;
  service: Service | null;
  onOpenChange: (open: boolean) => void;
};

export function ServiceHistoryDialog({ open, service, onOpenChange }: ServiceHistoryDialogProps) {
  const [page, setPage] = useState(1);
  const historyQuery = useCatalogServiceHistory(service?.id ?? null, open, page);
  const entries = historyQuery.data?.data ?? [];
  const meta = historyQuery.data?.meta;
  const pageCount = meta ? Math.max(1, Math.ceil(meta.total / meta.per_page)) : 1;

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-2xl"
      title={service ? `Historial de ${service.name}` : 'Historial del concepto'}
      description="Cambios registrados de precio, impuesto y disponibilidad. Los documentos emitidos conservan sus valores históricos."
      footer={<button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={() => onOpenChange(false)}>Cerrar</button>}
    >
      {historyQuery.isLoading ? (
        <div role="status" className="py-5 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">Cargando historial…</div>
      ) : historyQuery.isError ? (
        <AdminCallout tone="error" title="No se pudo cargar el historial">
          <p>Revise la conexión con el servidor local y vuelva a intentar.</p>
          <button type="button" data-ui-press className={`${SECONDARY_BUTTON} mt-3`} onClick={() => void historyQuery.refetch()}>Reintentar</button>
        </AdminCallout>
      ) : entries.length === 0 ? (
        <p className="py-5 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">Todavía no hay cambios registrados para este concepto.</p>
      ) : (
        <ol className="divide-y divide-[var(--ui-line)]" aria-label="Cambios registrados">
          {entries.map((entry) => (
            <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-[color:var(--ui-ink)]">{entry.label}</p>
                <time className="text-[length:var(--ui-text-xs)] tabular-nums text-[color:var(--ui-ink-soft)]" dateTime={entry.created_at ?? undefined}>
                  {formatDateTime(entry.created_at)}
                </time>
              </div>
              <p className="mt-0.5 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
                {entry.user?.name ?? 'Usuario no disponible'}
              </p>
              {entry.changes.length ? (
                <ul className="mt-2 flex flex-col gap-1 text-[length:var(--ui-text-sm)]">
                  {entry.changes.map((change) => (
                    <li key={change.field} className="flex flex-wrap items-baseline gap-1.5">
                      <span className="font-medium">{change.label}:</span>
                      <HistoryValue change={change} value={change.before} />
                      <span aria-hidden="true">→</span>
                      <span className="sr-only">cambió a</span>
                      <HistoryValue change={change} value={change.after} />
                    </li>
                  ))}
                </ul>
              ) : null}
              {entry.reason ? <p className="mt-2 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]"><span className="font-medium text-[color:var(--ui-ink)]">Motivo:</span> {entry.reason}</p> : null}
            </li>
          ))}
        </ol>
      )}
      {meta && pageCount > 1 ? (
        <nav className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--ui-line)] pt-3" aria-label="Páginas del historial">
          <button type="button" data-ui-press className={SECONDARY_BUTTON} disabled={page <= 1 || historyQuery.isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</button>
          <span className="text-[length:var(--ui-text-xs)] tabular-nums text-[color:var(--ui-ink-soft)]">Página {page} de {pageCount}</span>
          <button type="button" data-ui-press className={SECONDARY_BUTTON} disabled={page >= pageCount || historyQuery.isFetching} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Siguiente</button>
        </nav>
      ) : null}
    </AdminDialog>
  );
}

function HistoryValue({ change, value }: { change: ServiceHistoryChange; value: unknown }) {
  if (change.field === 'price' && typeof value === 'string') {
    return <MoneyText cents={parseCents(value)} />;
  }

  if (typeof value === 'boolean') {
    return <span>{value ? 'Sí' : 'No'}</span>;
  }

  if (value === null || value === undefined || value === '') {
    return <span>Sin dato</span>;
  }

  return <span>{String(value)}</span>;
}
