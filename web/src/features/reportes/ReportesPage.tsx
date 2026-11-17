import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, FileSpreadsheet, FileText, RefreshCw } from 'lucide-react';
import { api, downloadFile, errorMessage } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatHundredths } from '@/lib/money';
import { cn } from '@/lib/cn';
import {
  INVOICE_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  type Category,
  type Paginated,
  type PaymentMethod,
  type ReportOperation,
  type ReportSession,
  type ReportStatusFilter,
  type ReportSummary,
  type User,
} from '@/api/types';
import { usePermissions } from '@/auth/hooks';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  Input,
  KpiGrid,
  KpiTile,
  Money,
  PageHeader,
  Select,
  StatusGlyph,
  StatusStamp,
  Tabs,
  toast,
  type Column,
} from '@/ui';
import { DifferenceValue } from '@/features/caja/ArqueoTab';
import { MethodBars } from './MethodBars';
import { PERIOD_LABEL, PRESETS, presetRange, validateRange, type PeriodPreset } from './period';
import { TrendChart } from './TrendChart';

type Filters = {
  preset: PeriodPreset;
  date_from: string;
  date_to: string;
  method: '' | PaymentMethod;
  status: '' | ReportStatusFilter;
  user_id: string;
  category_id: string;
};

type LineRow = ReportSummary['lines'][number] & { _k: number };
type FreeRow = ReportSummary['gratuities'][number] & { _k: number };
type PaymentRow = ReportSummary['payments'][number];

const STATUS_OPTIONS: Array<{ value: ReportStatusFilter; label: string }> = [
  { value: 'issued', label: INVOICE_STATUS_LABEL.pending },
  { value: 'partial', label: INVOICE_STATUS_LABEL.partial },
  { value: 'paid', label: INVOICE_STATUS_LABEL.paid },
  { value: 'without_charge', label: INVOICE_STATUS_LABEL.no_charge },
  { value: 'void', label: INVOICE_STATUS_LABEL.void },
];

function initialFilters(now = new Date()): Filters {
  return { preset: 'month', ...presetRange('month', now), method: '', status: '', user_id: '', category_id: '' };
}

/** Query sent to /reports/summary(.pdf|.xlsx). Empty values are dropped by the API client. */
export function toQuery(f: Filters) {
  return {
    date_from: f.date_from,
    date_to: f.date_to,
    method: f.method || undefined,
    status: f.status || undefined,
    user_id: f.user_id || undefined,
    category_id: f.category_id || undefined,
  };
}

const sameFilters = (a: Filters, b: Filters) => JSON.stringify(toQuery(a)) === JSON.stringify(toQuery(b));

/** First `limit` rows with a "Ver todas" toggle. */
function Limited<T>({ rows, render, limit = 10 }: { rows: T[]; render: (rows: T[]) => ReactNode; limit?: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, limit);
  return (
    <div className="flex flex-col">
      {render(shown)}
      {rows.length > limit && (
        <div className="flex justify-center border-t border-junta py-1.5">
          <Button size="sm" variant="ghost" onClick={() => setAll((v) => !v)}>
            {all ? 'Ver menos' : `Ver todas (${rows.length})`}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function ReportesPage() {
  const { can } = usePermissions();
  const all = can('reports.all');
  const [draft, setDraft] = useState<Filters>(() => initialFilters());
  const [applied, setApplied] = useState<Filters>(draft);
  const [touched, setTouched] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null);

  const rangeError = validateRange(draft.date_from, draft.date_to);
  const dirty = !sameFilters(draft, applied);
  const query = useMemo(() => toQuery(applied), [applied]);

  const report = useQuery({
    queryKey: ['reports', 'summary', query],
    queryFn: () => api.get<ReportSummary>('/reports/summary', query),
    placeholderData: (prev) => prev,
  });

  const users = useQuery({
    queryKey: ['users', 'list', { per_page: 200 }],
    queryFn: () => api.get<Paginated<User>>('/users', { per_page: 200 }),
    enabled: all && can('users.view'),
    staleTime: 5 * 60_000,
  });
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[] | Paginated<Category>>('/categories'),
    select: (d) => (Array.isArray(d) ? d : d.items),
    enabled: all && can('catalog.view'),
    staleTime: 5 * 60_000,
  });

  function choosePreset(p: PeriodPreset) {
    setTouched(false);
    setDraft((d) => (p === 'custom' ? { ...d, preset: p } : { ...d, preset: p, ...presetRange(p) }));
  }

  function apply(e?: FormEvent) {
    e?.preventDefault();
    setTouched(true);
    if (rangeError) return;
    setApplied(draft);
  }

  async function exportAs(kind: 'pdf' | 'xlsx') {
    setExporting(kind);
    try {
      await downloadFile(`/reports/summary.${kind}`, {
        query,
        ...(kind === 'xlsx' ? { mode: 'save' as const, filename: `reporte-${query.date_from}-${query.date_to}.xlsx` } : {}),
      });
    } catch (err) {
      toast.error({ title: 'No se pudo exportar el reporte.', description: errorMessage(err) });
    } finally {
      setExporting(null);
    }
  }

  const data = report.data;
  const s = data?.summary;
  const loading = report.isPending;

  return (
    <>
      <PageHeader
        title="Reportes"
        className="pb-4"
        description={
          <span role="group" aria-label="Período" className="inline-flex h-9 max-w-full gap-px overflow-x-auto rounded-[var(--radius-md)] border border-junta bg-junta align-middle">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={draft.preset === p}
                onClick={() => choosePreset(p)}
                className={cn(
                  'pressable h-full px-3 text-[13px] font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--focus)]',
                  draft.preset === p ? 'bg-slate text-slate-ink' : 'bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink',
                )}
              >
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </span>
        }
        actions={
          <>
            <Badge tone={all ? 'info' : 'neutral'} shape={all ? 'filled' : 'hollow'}>
              {all ? 'Todas las cajas' : 'Solo sus operaciones'}
            </Badge>
            {can('reports.export') && (
              <>
                <Button leftIcon={<FileText />} loading={exporting === 'pdf'} disabled={dirty} onClick={() => void exportAs('pdf')}>
                  Exportar PDF
                </Button>
                <Button
                  leftIcon={<FileSpreadsheet />}
                  loading={exporting === 'xlsx'}
                  disabled={dirty}
                  onClick={() => void exportAs('xlsx')}
                >
                  Exportar Excel
                </Button>
              </>
            )}
          </>
        }
      />

      <form
        onSubmit={apply}
        noValidate
        aria-label="Filtros del reporte"
        className="mb-4 flex flex-wrap items-end gap-x-3 gap-y-3 rounded-[var(--radius-md)] border border-junta bg-surface px-4 py-3"
      >
        <Field label="Desde" className="w-[148px]" error={touched && rangeError ? rangeError : null}>
          <Input
            type="date"
            value={draft.date_from}
            onChange={(e) => setDraft((d) => ({ ...d, preset: 'custom', date_from: e.target.value }))}
          />
        </Field>
        <Field label="Hasta" className="w-[148px]">
          <Input
            type="date"
            value={draft.date_to}
            onChange={(e) => setDraft((d) => ({ ...d, preset: 'custom', date_to: e.target.value }))}
          />
        </Field>
        <Field label="Método" className="w-[140px]">
          <Select
            value={draft.method}
            onChange={(e) => setDraft((d) => ({ ...d, method: e.target.value as Filters['method'] }))}
            placeholder="Todos"
            options={(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))}
          />
        </Field>
        <Field label="Estado" className="w-[170px]">
          <Select
            value={draft.status}
            onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as Filters['status'] }))}
            placeholder="Todos"
            options={STATUS_OPTIONS}
          />
        </Field>
        {all && users.isSuccess && (
          <Field label="Cajero" className="w-[170px]">
            <Select
              value={draft.user_id}
              onChange={(e) => setDraft((d) => ({ ...d, user_id: e.target.value }))}
              placeholder="Todos"
              options={users.data.items.map((u) => ({ value: String(u.id), label: u.name }))}
            />
          </Field>
        )}
        {all && categories.isSuccess && (
          <Field label="Categoría" className="w-[170px]">
            <Select
              value={draft.category_id}
              onChange={(e) => setDraft((d) => ({ ...d, category_id: e.target.value }))}
              placeholder="Todas"
              options={categories.data.map((c) => ({ value: String(c.id), label: c.name }))}
            />
          </Field>
        )}
        <div className="ml-auto flex items-center gap-3 self-end">
          {dirty && (
            <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-warn" role="status">
              <StatusGlyph shape="hollow" />
              Cambios sin aplicar
            </span>
          )}
          <Button type="submit" variant={dirty ? 'primary' : 'secondary'} loading={report.isFetching && !loading}>
            Aplicar
          </Button>
        </div>
      </form>

      {report.isError && !data ? (
        <Card>
          <EmptyState
            icon={<BarChart3 />}
            title="No se pudo cargar el reporte"
            description={errorMessage(report.error)}
            action={
              <Button leftIcon={<RefreshCw />} onClick={() => void report.refetch()}>
                Reintentar
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <KpiGrid className="grid-cols-2 md:grid-cols-4" aria-label="Indicadores del período">
            <KpiTile label="Facturado" cents={s?.billed_cents} loading={loading} hint={s ? `${s.invoices_count} operaciones` : undefined} />
            <KpiTile label="Cobrado" cents={s?.collected_cents} loading={loading} tone="ok" hint={s ? `${s.paid_count} pagadas` : undefined} />
            <KpiTile
              label="Saldo"
              cents={s?.pending_cents}
              loading={loading}
              tone={s && s.pending_cents > 0 ? 'warn' : 'neutral'}
              hint={s ? `${s.partial_count} con pago parcial` : undefined}
            />
            <KpiTile label="Sin cobro" value={s?.without_charge_count} loading={loading} hint="Operaciones emitidas sin cobro" />
            <KpiTile label="Ticket promedio" cents={s?.average_ticket_cents} loading={loading} hint={s ? `${s.payments_count} cobros` : undefined} />
            <KpiTile
              label="Anulado"
              cents={s?.voided_cents}
              loading={loading}
              tone={s && s.voided_cents > 0 ? 'danger' : 'neutral'}
              hint={s ? `${s.voided_count} ${s.voided_count === 1 ? 'anulada' : 'anuladas'}` : undefined}
            />
            <KpiTile label="Reversado" cents={s?.reversed_cents} loading={loading} tone={s && s.reversed_cents > 0 ? 'danger' : 'neutral'} />
            <KpiTile
              label="Líneas gratuitas"
              value={s?.free_lines_count}
              loading={loading}
              hint={s ? <>Valor <Money cents={s.free_value_cents} /></> : undefined}
            />
          </KpiGrid>

          <div className="grid gap-px overflow-hidden rounded-[var(--radius-md)] border border-junta bg-junta lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
            <section aria-labelledby="rep-tendencia" className="flex min-w-0 flex-col bg-surface">
              <header className="flex min-h-11 items-center justify-between gap-3 border-b border-junta px-4 py-2">
                <h2 id="rep-tendencia" className="text-[15px] leading-5 font-bold text-ink">
                  Tendencia diaria
                </h2>
                <p className="text-[12px] leading-4 text-ink-2">
                  Facturado vs Cobrado por día, del <span className="num">{formatDate(applied.date_from)}</span> al{' '}
                  <span className="num">{formatDate(applied.date_to)}</span> (hora de Honduras).
                </p>
              </header>
              <div className="px-4 py-3">
                {data && data.daily.length > 0 ? (
                  <TrendChart data={data.daily} />
                ) : (
                  <EmptyState compact icon={<BarChart3 />} title={loading ? 'Cargando…' : 'Sin datos en el período'} />
                )}
              </div>
            </section>
            <section aria-labelledby="rep-metodo" className="flex min-w-0 flex-col bg-surface">
              <header className="flex min-h-11 items-center border-b border-junta px-4 py-2">
                <h2 id="rep-metodo" className="text-[15px] leading-5 font-bold text-ink">
                  Cobros por método
                </h2>
              </header>
              <div className="p-4">
                {data ? (
                  <MethodBars
                    label="Cobros por método en el período"
                    rows={(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => {
                      const r = data.by_method.find((x) => x.method === m);
                      return { method: m, amount_cents: r?.amount_cents ?? 0, count: r?.count ?? 0 };
                    })}
                  />
                ) : null}
              </div>
              {data && data.top_services.length > 0 && (
                <div className="border-t border-junta">
                  <h3 className="flex h-9 items-center border-b border-junta bg-surface-2 px-4 text-[12.5px] font-semibold text-ink-2">
                    Servicios con mayor facturación
                  </h3>
                  <ol className="flex flex-col text-[13px]">
                    {data.top_services.slice(0, 5).map((t) => (
                      <li key={t.service_name} className="flex items-baseline justify-between gap-3 border-b border-junta px-4 py-1.5 last:border-b-0">
                        <span className="min-w-0 truncate text-ink">{t.service_name}</span>
                        <span className="flex shrink-0 items-baseline gap-3">
                          <span className="num text-[12px] text-ink-3">× {formatHundredths(t.quantity_hundredths)}</span>
                          <Money cents={t.amount_cents} className="text-ink" />
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </section>
          </div>

          {data && <DetailTabs data={data} />}
        </div>
      )}
    </>
  );
}

function DocLink({ id, number }: { id?: number; number: string }) {
  if (!id) return <span className="num">{number}</span>;
  return (
    <Link to={`/recibos/${id}`} className="num font-medium text-slate-text underline-offset-2 hover:underline">
      {number}
    </Link>
  );
}

function DetailTabs({ data }: { data: ReportSummary }) {
  const opCols: Column<ReportOperation>[] = [
    { key: 'doc', header: 'Documento', cell: (i) => <DocLink id={i.id} number={i.number} /> },
    { key: 'date', header: 'Fecha', cell: (i) => <span className="num">{formatDateTime(i.issued_at)}</span> },
    { key: 'patient', header: 'Paciente', cell: (i) => i.patient_name },
    { key: 'user', header: 'Cajero', cell: (i) => i.cashier_name || <span className="text-ink-3">—</span> },
    { key: 'status', header: 'Estado', cell: (i) => <StatusStamp status={i} /> },
    { key: 'total', header: 'Total', numeric: true, cell: (i) => <Money cents={i.total_cents} /> },
    { key: 'balance', header: 'Saldo', numeric: true, cell: (i) => <Money cents={i.balance_cents} /> },
  ];
  const lineCols: Column<LineRow>[] = [
    { key: 'doc', header: 'Documento', cell: (l) => <DocLink id={l.invoice_id} number={l.invoice_number} /> },
    { key: 'date', header: 'Fecha', cell: (l) => <span className="num">{formatDate(l.issued_at)}</span> },
    { key: 'name', header: 'Concepto', cell: (l) => l.service_name },
    { key: 'cat', header: 'Categoría', cell: (l) => l.category_name },
    { key: 'qty', header: 'Cant.', numeric: true, cell: (l) => formatHundredths(l.quantity_hundredths) },
    { key: 'price', header: 'Precio', numeric: true, cell: (l) => <Money cents={l.unit_price_cents} /> },
    { key: 'total', header: 'Importe', numeric: true, cell: (l) => <Money cents={l.line_total_cents} /> },
  ];
  const payCols: Column<PaymentRow>[] = [
    { key: 'date', header: 'Fecha', cell: (p) => <span className="num">{formatDateTime(p.paid_at)}</span> },
    { key: 'doc', header: 'Documento', cell: (p) => <DocLink id={p.invoice_id} number={p.invoice_number} /> },
    { key: 'patient', header: 'Paciente', cell: (p) => p.patient_name },
    { key: 'method', header: 'Método', cell: (p) => PAYMENT_METHOD_LABEL[p.method] },
    { key: 'ref', header: 'Referencia', cell: (p) => p.reference || <span className="text-ink-3">—</span> },
    { key: 'user', header: 'Cajero', cell: (p) => p.cashier_name || <span className="text-ink-3">—</span> },
    {
      key: 'status',
      header: 'Estado',
      cell: (p) =>
        p.status === 'void' ? (
          <Badge tone="danger" shape="struck">
            Anulado
          </Badge>
        ) : (
          <Badge tone="ok" shape="filled">
            Registrado
          </Badge>
        ),
    },
    { key: 'amount', header: 'Monto', numeric: true, cell: (p) => <Money cents={p.amount_cents} /> },
  ];
  const sessionCols: Column<ReportSession>[] = [
    { key: 'opened', header: 'Turno abierto', cell: (x) => <span className="num">{formatDateTime(x.opened_at)}</span> },
    { key: 'reg', header: 'Caja', cell: (x) => x.register_name },
    { key: 'user', header: 'Operador', cell: (x) => x.user_name },
    { key: 'expected', header: 'Esperado', numeric: true, cell: (x) => <Money cents={x.expected_cash_cents} /> },
    {
      key: 'counted',
      header: 'Contado',
      numeric: true,
      cell: (x) => (x.counted_cents === null ? <span className="text-ink-3">—</span> : <Money cents={x.counted_cents} />),
    },
    {
      key: 'diff',
      header: 'Diferencia',
      numeric: true,
      cell: (x) => {
        if (x.difference_cents === null || x.difference_cents === undefined) {
          return x.status === 'open' ? (
            <Badge tone="ok" shape="filled">
              Abierta
            </Badge>
          ) : (
            <span className="text-ink-3">—</span>
          );
        }
        return <DifferenceValue cents={x.difference_cents} className="justify-end" />;
      },
    },
  ];
  const freeCols: Column<FreeRow>[] = [
    { key: 'doc', header: 'Documento', cell: (l) => <DocLink id={l.invoice_id} number={l.invoice_number} /> },
    { key: 'date', header: 'Fecha', cell: (l) => <span className="num">{formatDate(l.issued_at)}</span> },
    { key: 'patient', header: 'Paciente', cell: (l) => l.patient_name },
    { key: 'name', header: 'Concepto', cell: (l) => l.service_name },
    { key: 'qty', header: 'Cant.', numeric: true, cell: (l) => formatHundredths(l.quantity_hundredths) },
    { key: 'value', header: 'Valor registrado', numeric: true, cell: (l) => <Money cents={l.value_cents} /> },
  ];

  const sessions = data.sessions;
  const lines: LineRow[] = data.lines.map((l, i) => ({ ...l, _k: i }));
  const gratuities: FreeRow[] = data.gratuities.map((l, i) => ({ ...l, _k: i }));

  return (
    <Card flush className="overflow-hidden">
      <div className="px-4 pt-1">
        <Tabs
          label="Detalle del reporte"
          items={[
            {
              value: 'ops',
              label: 'Operaciones',
              count: data.operations.length,
              content: (
                <Limited
                  rows={data.operations}
                  render={(rows) => <DataTable caption="Operaciones" columns={opCols} rows={rows} rowKey={(i) => i.id} density="compact" />}
                />
              ),
            },
            {
              value: 'lines',
              label: 'Detalle',
              count: data.lines.length,
              content: (
                <Limited
                  rows={lines}
                  render={(rows) => (
                    <DataTable caption="Detalle de conceptos" columns={lineCols} rows={rows} rowKey={(l) => l._k} density="compact" />
                  )}
                />
              ),
            },
            {
              value: 'payments',
              label: 'Cobros',
              count: data.payments.length,
              content: (
                <Limited
                  rows={data.payments}
                  render={(rows) => <DataTable caption="Cobros" columns={payCols} rows={rows} rowKey={(p) => p.id} density="compact" />}
                />
              ),
            },
            {
              value: 'sessions',
              label: 'Caja',
              count: sessions.length,
              content: (
                <Limited
                  rows={sessions}
                  render={(rows) => <DataTable caption="Turnos de caja" columns={sessionCols} rows={rows} rowKey={(x) => x.id} density="compact" />}
                />
              ),
            },
            {
              value: 'free',
              label: 'Gratuidades',
              count: data.gratuities.length,
              content: (
                <Limited
                  rows={gratuities}
                  render={(rows) => (
                    <DataTable caption="Gratuidades" columns={freeCols} rows={rows} rowKey={(l) => l._k} density="compact" />
                  )}
                />
              ),
            },
          ]}
        />
      </div>
    </Card>
  );
}
