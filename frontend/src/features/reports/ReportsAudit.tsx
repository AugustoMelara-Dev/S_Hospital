import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Search } from 'lucide-react';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { AuditLogList, type AuditLogEntry } from '@/components/ui/audit-log-list';
import { InfoPanel } from '@/components/shared';
import { system } from '@/lib/api';
import type { AuditLogPage } from '@/lib/api/types';
import { useExecutiveReport } from '@/hooks/useExecutiveReport';
import { AuditSummaryPanel } from './components/AuditSummaryPanel';
import { computePresetRange } from './components/ReportFiltersPanel';

type AuditLogFilters = {
  action: string;
  from: string;
  to: string;
  page: number;
};

const EMPTY_FILTERS: AuditLogFilters = {
  action: '',
  from: '',
  to: '',
  page: 1,
};

type ReportsAuditProps = {
  canExport: boolean;
  canViewManagerial: boolean;
  onStatus: (message: string) => void;
};

export function ReportsAudit({
  canViewManagerial,
}: ReportsAuditProps) {
  const summaryRange = useMemo(() => computePresetRange('thisMonth'), []);
  const [draft, setDraft] = useState<AuditLogFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<AuditLogFilters>(EMPTY_FILTERS);

  const queryKey = useMemo(
    () => ['audit-logs', applied] as const,
    [applied],
  );

  const { data, isLoading, isError, refetch } = useQuery<AuditLogPage>({
    queryKey,
    queryFn: () =>
      system.getAuditLogs({
        action: applied.action || undefined,
        from: applied.from || undefined,
        to: applied.to || undefined,
        page: applied.page,
        per_page: 25,
      }),
    enabled: canViewManagerial,
    staleTime: 30_000,
  });
  const { data: summary, isFetching: summaryLoading } = useExecutiveReport(
    { date_from: summaryRange.from, date_to: summaryRange.to },
    canViewManagerial,
  );

  if (!canViewManagerial) {
    return (
      <InfoPanel
        tone="warning"
        title="Sin permisos para auditoria"
        description="Su usuario no tiene permisos para consultar el registro de auditoria."
      />
    );
  }

  function handleApply() {
    setApplied({ ...draft, page: 1 });
  }

  function handleReset() {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
  }

  return (
    <section className="flex flex-col gap-5" aria-label="Registro de auditoria">
      <PageHeader
        title="Auditoria"
        description="Resumen mensual de supervision operativa y bitacora filtrable."
        className="pb-4"
      />

      {summary ? <AuditSummaryPanel report={summary} /> : null}

      {!summary && summaryLoading ? (
        <LoadingState label="Cargando resumen de auditoria..." />
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          handleApply();
        }}
        className="rounded-md border border-operational-border bg-operational-surface p-4 shadow-sm"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label htmlFor="audit-action" className="text-xs font-semibold text-muted-foreground">
              Acción
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="audit-action"
                value={draft.action}
                onChange={(event) => setDraft((current) => ({ ...current, action: event.target.value }))}
                placeholder="login, fiscal.update, …"
                className="pl-9"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="audit-from" className="text-xs font-semibold text-muted-foreground">
              Desde
            </label>
            <Input
              id="audit-from"
              type="date"
              value={draft.from}
              onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="audit-to" className="text-xs font-semibold text-muted-foreground">
              Hasta
            </label>
            <Input
              id="audit-to"
              type="date"
              value={draft.to}
              onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit" className="flex-1">
              Buscar
            </Button>
            <Button type="button" variant="secondary" onClick={handleReset}>
              Limpiar
            </Button>
          </div>
        </div>
      </form>

      {isLoading ? (
        <LoadingState label="Cargando bitacora de auditoria..." />
      ) : null}

      {isError ? (
        <ErrorState
          title="No se pudo cargar la auditoria"
          description="Verifique la conexion LAN o sus permisos."
          action={
            <Button type="button" variant="secondary" onClick={() => void refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : null}

      {!isLoading && !isError && data ? (
        <div className="rounded-md border border-operational-border bg-operational-surface p-4 shadow-sm">
          <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Bitacora</h2>
            <span className="text-xs text-muted-foreground">
              {data.meta.total} entradas · pagina {data.meta.current_page} de {Math.max(1, Math.ceil(data.meta.total / data.meta.per_page))}
            </span>
          </header>
          {data.data.length === 0 ? (
            <p className="flex items-center justify-center gap-2 rounded-md border border-dashed border-operational-border bg-operational-panel/20 p-6 text-sm text-muted-foreground">
              <AlertTriangle aria-hidden="true" className="size-4" />
              No hay entradas para los filtros aplicados.
            </p>
          ) : (
            <AuditLogList entries={data.data as AuditLogEntry[]} />
          )}
          {data.meta.total > data.meta.per_page && (
            <div className="mt-3 flex items-center justify-between">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={applied.page <= 1}
                onClick={() => setApplied((current) => ({ ...current, page: current.page - 1 }))}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={applied.page * data.meta.per_page >= data.meta.total}
                onClick={() => setApplied((current) => ({ ...current, page: current.page + 1 }))}
              >
                Siguiente
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
