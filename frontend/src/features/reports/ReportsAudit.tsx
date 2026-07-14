import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SearchOutlined, WarningOutlined } from '@ant-design/icons';
import { Alert, Button, DatePicker, Form, Input, Spin, Statistic } from 'antd';
import dayjs from 'dayjs';
import { InstitutionalDataGrid, type InstitutionalColumn } from '@/design-system/ag-grid';
import { PageHeader } from '@/components/ui/page-header';
import { apiClient, system } from '@/lib/api';
import type { AuditLogEntry as ApiAuditLogEntry, AuditLogPage, OperationsReport } from '@/lib/api/types';
import { useExecutiveReport } from '@/hooks/useExecutiveReport';
import { AuditSummaryPanel } from './components/AuditSummaryPanel';
import { computePresetRange, parseReportDate } from './components/reportDateRanges';
import { ReportScope } from './components/ReportScope';

type AuditLogEntry = { action: string; created_at: string; reason?: string | null; result?: string; user?: { name: string } | null };
function AuditLogList({ entries }: { entries: AuditLogEntry[] }) { const columns: InstitutionalColumn<AuditLogEntry>[] = [{ field: 'created_at', headerName: 'Fecha', priority: 'secondary' }, { field: 'action', headerName: 'Acción', priority: 'primary', flex: 1 }, { colId: 'user', headerName: 'Usuario', priority: 'secondary', valueGetter: ({ data }) => data?.user?.name ?? 'Sistema' }, { field: 'reason', headerName: 'Motivo', priority: 'primary', flex: 1 }, { field: 'result', headerName: 'Resultado', priority: 'tertiary' }]; return <InstitutionalDataGrid ariaLabel="Bitácora de auditoría" rows={entries} columns={columns} getRowId={(entry) => `${entry.created_at}-${entry.action}-${entry.user?.name ?? ''}`} state={entries.length ? 'ready' : 'empty'} density="compact" />; }

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
  const [searchParams, setSearchParams] = useSearchParams();
  const summaryRange = useMemo(() => computePresetRange('thisMonth'), []);
  const initialUrlFilters = auditFiltersFromUrl(searchParams);
  const [draft, setDraft] = useState<AuditLogFilters>(initialUrlFilters);
  const [applied, setApplied] = useState<AuditLogFilters>(initialUrlFilters);
  const [rangeError, setRangeError] = useState(() => validateAuditDateRange(initialUrlFilters.from, initialUrlFilters.to));
  const urlFilterKey = searchParams.toString();

  useEffect(() => {
    const next = auditFiltersFromUrl(new URLSearchParams(urlFilterKey));
    setDraft(next);
    setApplied(next);
    setRangeError(validateAuditDateRange(next.from, next.to));
  }, [urlFilterKey]);

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
    enabled: canViewManagerial && validateAuditDateRange(applied.from, applied.to) === '',
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
      <Alert type="warning" showIcon title="Sin permisos para auditoría" description="Su usuario no tiene permisos para consultar el registro de auditoría." />
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
    applyAuditFilters({ ...draft, page: 1 });
  }

  function handleReset() {
    setRangeError('');
    setDraft(EMPTY_FILTERS);
    applyAuditFilters(EMPTY_FILTERS);
  }

  function applyAuditFilters(next: AuditLogFilters) {
    setApplied(next);
    setSearchParams(auditFiltersToUrl(next));
  }

  return (
    <section className="flex flex-col gap-5" aria-label="Registro de auditoria">
      <PageHeader
        title="Auditoria"
        description="Resumen mensual de supervision operativa y bitacora filtrable."
        className="pb-4"
      />

      {applied.from && applied.to && !rangeError ? (
        <ReportScope
          ariaLabel="Alcance del reporte de auditoria"
          from={applied.from}
          to={applied.to}
          source={applied.action ? `Bitácora filtrada por â€œ${applied.action}â€` : 'Bitácora operativa completa'}
        />
      ) : null}

      {summary ? <AuditSummaryPanel report={summary} /> : null}

      {!summary && summaryLoading ? (
        <div role="status" aria-label="Cargando resumen de auditoría..."><Spin /> Cargando resumen de auditoría...</div>
      ) : null}

      {operationsReport ? <OperationsSnapshot report={operationsReport} /> : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          handleApply();
        }}
        className="border border-operational-border bg-operational-surface p-5"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Form.Item label="Acción" htmlFor="audit-action" className="mb-0">
            <div className="relative">
              <SearchOutlined
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
          </Form.Item>
          <Form.Item label="Desde" htmlFor="audit-from" className="mb-0">
            <DatePicker
              id="audit-from"
              aria-label="Desde"
              value={draft.from ? dayjs(draft.from) : null}
              format="YYYY-MM-DD"
              onChange={(_, value) => setDraft((current) => ({ ...current, from: String(value) }))}
              disabled={auditControlsLocked}
            />
          </Form.Item>
          <Form.Item label="Hasta" htmlFor="audit-to" className="mb-0">
            <DatePicker
              id="audit-to"
              aria-label="Hasta"
              value={draft.to ? dayjs(draft.to) : null}
              format="YYYY-MM-DD"
              onChange={(_, value) => setDraft((current) => ({ ...current, to: String(value) }))}
              disabled={auditControlsLocked}
            />
          </Form.Item>
          <div className="flex items-end gap-2">
            <Button htmlType="submit" type="primary" className="flex-1" disabled={auditControlsLocked}>
              Buscar
            </Button>
            <Button htmlType="button" onClick={handleReset} disabled={auditControlsLocked}>
              Limpiar
            </Button>
          </div>
        </div>
      </form>

      {rangeError ? (
        <Alert type="warning" showIcon title="Rango de auditoría no válido" description={rangeError} />
      ) : null}

      {isLoading ? (
        <div role="status" aria-label="Cargando bitácora de auditoría..."><Spin /> Cargando bitácora de auditoría...</div>
      ) : null}

      {isError ? (
        <Alert
          type="error"
          showIcon
          title="No se pudo cargar la auditoría"
          description={<>Verifique la conexión local o sus permisos.
            <Button htmlType="button" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </>}
        />
      ) : null}

      {!isLoading && !isError && data ? (
        <div className="border border-operational-border bg-operational-surface p-5">
          <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Bitacora</h2>
            <span className="text-xs text-muted-foreground">
              {data.meta.total} entradas Â· pagina {data.meta.current_page} de {Math.max(1, Math.ceil(data.meta.total / data.meta.per_page))}
            </span>
          </header>
          {data.data.length === 0 ? (
            <p className="flex items-center justify-center gap-2 border border-dashed border-operational-border bg-muted/40 p-6 text-sm text-muted-foreground">
              <WarningOutlined aria-hidden="true" className="size-4" />
              No hay entradas para los filtros aplicados.
            </p>
          ) : (
            <AuditLogList entries={data.data.map(toSafeAuditEntry)} />
          )}
          {data.meta.total > data.meta.per_page && (
            <div className="mt-3 flex items-center justify-between">
              <Button
                htmlType="button"
                size="small"
                disabled={applied.page <= 1}
                onClick={() => applyAuditFilters({ ...applied, page: applied.page - 1 })}
              >
                Anterior
              </Button>
              <Button
                htmlType="button"
                size="small"
                disabled={applied.page * data.meta.per_page >= data.meta.total}
                onClick={() => applyAuditFilters({ ...applied, page: applied.page + 1 })}
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
    ...report.reprints.slice(0, 2).map((item) => {
      const reference = item.invoice_number ?? item.receipt_number_full ?? item.receipt_number ?? 'institucional';

      return {
        key: `reprint-${reference}-${item.created_at ?? ''}`,
        label: `Reimpresion ${reference}`,
        detail: item.reason || 'Sin motivo registrado',
      };
    }),
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
    <section className="border border-operational-border bg-operational-surface p-5" aria-labelledby="operations-snapshot-title">
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
        <ul className="mt-4 divide-y divide-operational-border border border-operational-border bg-muted/40">
          {recentRows.map((row) => (
            <li key={row.key} className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-medium text-foreground">{row.label}</span>
              <span className="text-xs text-muted-foreground">{row.detail}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 border border-dashed border-operational-border bg-muted/40 p-4 text-sm text-muted-foreground">
          Sin eventos operativos relevantes en el periodo.
        </p>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-operational-border bg-card p-4">
      <Statistic title={label} value={value} />
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

  const start = parseReportDate(from);
  const end = parseReportDate(to);

  if (!start || !end) {
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

function auditFiltersFromUrl(searchParams: URLSearchParams): AuditLogFilters {
  const rawPage = Number(searchParams.get('page'));
  return {
    action: searchParams.get('action') ?? '',
    from: searchParams.get('from') ?? '',
    to: searchParams.get('to') ?? '',
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

function auditFiltersToUrl(filters: AuditLogFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.action.trim()) params.set('action', filters.action.trim());
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.page > 1) params.set('page', String(filters.page));
  return params;
}

function toSafeAuditEntry(entry: ApiAuditLogEntry): AuditLogEntry {
  return {
    action: auditActionLabel(entry.action),
    created_at: entry.created_at ?? '',
    reason: typeof entry.reason === 'string' ? entry.reason : null,
    result: entry.result === 'failed' ? 'error' : entry.result ?? undefined,
    user: entry.user?.name ? { name: entry.user.name } : null,
  };
}

function auditActionLabel(action: string): string {
  const normalized = action.toLowerCase();
  if (normalized.includes('invoice') && (normalized.includes('void') || normalized.includes('annul'))) return 'Factura anulada';
  if (normalized.includes('payment') && (normalized.includes('void') || normalized.includes('revers'))) return 'Pago reversado';
  if (normalized.includes('reprint')) return 'Comprobante reimpreso';
  if (normalized.includes('cash') && normalized.includes('open')) return 'Caja abierta';
  if (normalized.includes('cash') && normalized.includes('clos')) return 'Caja cerrada';
  if (normalized.includes('price')) return 'Precio de servicio actualizado';
  if (normalized.includes('fiscal')) return 'Configuración fiscal actualizada';
  if (normalized.includes('backup')) return 'Respaldo procesado';
  if (normalized.includes('login')) return 'Inicio de sesión';
  return 'Acción operativa auditada';
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
