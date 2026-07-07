import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Search } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { AuditLogList, type AuditLogEntry } from '@/components/ui/audit-log-list';
import { InfoPanel } from '@/components/shared';
import { apiClient, system } from '@/lib/api';
import type { AuditLogPage, OperationsReport } from '@/lib/api/types';
import { useExecutiveReport } from '@/hooks/useExecutiveReport';
import { AuditSummaryPanel } from './components/AuditSummaryPanel';
import { computePresetRange } from './components/reportDateRanges';

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

const AUDIT_ACTION_ALIASES: Array<{ action: string; terms: string[] }> = [
  { action: 'invoice.voided', terms: ['anulacion', 'anular', 'anulada', 'anulado'] },
  { action: 'invoice.reversed', terms: ['reversa', 'reversar', 'reversado'] },
  { action: 'invoice.reprinted', terms: ['reimpresion', 'reimprimir', 'copia'] },
  { action: 'cash_session.opened', terms: ['apertura de caja', 'abrir caja', 'caja abierta'] },
  { action: 'cash_session.closed', terms: ['cierre de caja', 'cerrar caja', 'caja cerrada'] },
  { action: 'payment.registered', terms: ['cobro', 'pago', 'pago registrado'] },
  { action: 'service.price_updated', terms: ['precio', 'cambio de precio'] },
  { action: 'fiscal_sequence', terms: ['fiscal', 'correlativo', 'numeracion'] },
  { action: 'backup', terms: ['respaldo', 'backup'] },
];

type ReportsAuditProps = {
  canExport: boolean;
  canViewExecutiveSummary: boolean;
  canViewManagerial: boolean;
  onStatus: (message: string) => void;
};

export function ReportsAudit({
  canViewExecutiveSummary,
  canViewManagerial,
  onStatus,
}: ReportsAuditProps) {
  const summaryRange = useMemo(() => computePresetRange('thisMonth'), []);
  const [draft, setDraft] = useState<AuditLogFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<AuditLogFilters>(EMPTY_FILTERS);
  const [rangeError, setRangeError] = useState('');

  const queryKey = useMemo(
    () => ['audit-logs', applied] as const,
    [applied],
  );

  const { data, isLoading, isFetching, isError, refetch } = useQuery<AuditLogPage>({
    queryKey,
    queryFn: () =>
      system.getAuditLogs({
        action: resolveAuditActionFilter(applied.action),
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
    canViewExecutiveSummary,
  );
  const { data: operationsReport } = useQuery<OperationsReport>({
    queryKey: ['reports', 'operations', summaryRange] as const,
    queryFn: () => apiClient.getOperationsReport({
      date_from: summaryRange.from,
      date_to: summaryRange.to,
    }),
    enabled: canViewManagerial,
    staleTime: 30_000,
  });
  const auditControlsLocked = isFetching;

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
    const error = validateAuditDateRange(draft.from, draft.to);

    if (error) {
      setRangeError(error);
      onStatus(error);
      return;
    }

    setRangeError('');
    setApplied({ ...draft, page: 1 });
  }

  function handleReset() {
    setRangeError('');
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

      {operationsReport ? <OperationsSnapshot report={operationsReport} /> : null}

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
                placeholder="Anulacion, reimpresion, cierre de caja..."
                className="pl-9"
                autoComplete="off"
                disabled={auditControlsLocked}
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
              disabled={auditControlsLocked}
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
              disabled={auditControlsLocked}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit" className="flex-1" disabled={auditControlsLocked}>
              Buscar
            </Button>
            <Button type="button" variant="secondary" onClick={handleReset} disabled={auditControlsLocked}>
              Limpiar
            </Button>
          </div>
        </div>
      </form>

      {rangeError ? (
        <Alert variant="warning" title="Rango de auditoria no valido">
          {rangeError}
        </Alert>
      ) : null}

      {isLoading ? (
        <LoadingState label="Cargando bitacora de auditoria..." />
      ) : null}

      {isError ? (
        <ErrorState
          title="No se pudo cargar la auditoria"
          description="Verifique la conexion local o sus permisos."
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

function OperationsSnapshot({ report }: { report: OperationsReport }) {
  const recentRows = [
    ...report.voids.slice(0, 2).map((item) => ({
      key: `void-${item.invoice_number}-${item.created_at ?? ''}`,
      label: `Anulacion ${item.invoice_number}`,
      detail: item.reason || 'Sin motivo registrado',
    })),
    ...report.reprints.slice(0, 2).map((item) => ({
      key: `reprint-${item.invoice_number ?? item.receipt_number ?? ''}-${item.created_at ?? ''}`,
      label: `Reimpresion ${item.invoice_number ?? item.receipt_number ?? 'institucional'}`,
      detail: item.reason || 'Sin motivo registrado',
    })),
    ...report.payment_voids.slice(0, 2).map((item) => ({
      key: `payment-void-${item.invoice_number}-${item.created_at ?? ''}`,
      label: `Pago anulado ${item.invoice_number}`,
      detail: item.reason || item.amount,
    })),
    ...report.backups.slice(0, 2).map((item, index) => ({
      key: `backup-${index}-${item.completed_at ?? item.created_at ?? ''}`,
      label: item.status === 'failed' ? 'Respaldo fallido' : 'Respaldo completado',
      detail: item.type ? backupTypeLabel(item.type) : 'Respaldo local',
    })),
  ].slice(0, 6);

  return (
    <section className="rounded-md border border-operational-border bg-operational-surface p-4 shadow-sm" aria-labelledby="operations-snapshot-title">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="operations-snapshot-title" className="text-sm font-semibold text-foreground">
            Operaciones del periodo
          </h2>
          <p className="text-xs text-muted-foreground">
            {report.date_from} a {report.date_to}
          </p>
        </div>
      </header>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Anulaciones" value={report.summary.void_count} />
        <Metric label="Reimpresiones" value={report.summary.reprint_count} />
        <Metric label="Pagos anulados" value={report.summary.payment_void_count} />
        <Metric label="Respaldos fallidos" value={report.summary.failed_backup_count} />
      </dl>

      {recentRows.length > 0 ? (
        <ul className="mt-4 divide-y divide-operational-border rounded-md border border-operational-border bg-operational-panel/20">
          {recentRows.map((row) => (
            <li key={row.key} className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-medium text-foreground">{row.label}</span>
              <span className="text-xs text-muted-foreground">{row.detail}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-md border border-dashed border-operational-border bg-operational-panel/20 p-3 text-sm text-muted-foreground">
          Sin eventos operativos relevantes en el periodo.
        </p>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-operational-border bg-card p-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function backupTypeLabel(type: string): string {
  if (type === 'automatic') return 'Respaldo automatico';
  if (type === 'manual') return 'Respaldo manual';

  return 'Respaldo local';
}

function validateAuditDateRange(from: string, to: string): string {
  if (!from || !to) {
    return '';
  }

  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Seleccione fechas validas para la auditoria.';
  }

  if (start.getTime() > end.getTime()) {
    return 'La fecha de inicio debe ser anterior o igual a la fecha de fin.';
  }

  return '';
}

function resolveAuditActionFilter(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const normalized = normalizeSearchText(trimmed);
  const alias = AUDIT_ACTION_ALIASES.find(({ terms }) =>
    terms.some((term) => normalized.includes(normalizeSearchText(term))),
  );

  return alias?.action ?? trimmed;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
