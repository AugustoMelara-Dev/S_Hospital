import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronRight, FilterX, Search } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/dates';
import { qk } from '@/api/queryClient';
import { DISPLAY_STATUS_TO_API, INVOICE_STATUS_LABEL, type InvoiceDisplayStatus, type InvoiceSummary, type Paginated } from '@/api/types';
import {
  Button,
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  INVOICE_STATUS_SHAPE,
  Input,
  PageHeader,
  Select,
  StatusGlyph,
  StatusStamp,
  type Column,
} from '@/ui';
import { Amount, Dash } from './components/Amount';
import { useDebouncedValue } from '@/features/cobrar/hooks';

const PER_PAGE = 25;
const STATUS_OPTIONS = (Object.keys(INVOICE_STATUS_LABEL) as InvoiceDisplayStatus[]).map((s) => ({
  value: s,
  label: INVOICE_STATUS_LABEL[s],
}));

function isDisplayStatus(v: string): v is InvoiceDisplayStatus {
  return v in INVOICE_STATUS_LABEL;
}

const GLYPH_TONE: Record<InvoiceDisplayStatus, string> = {
  pending: 'text-warn',
  partial: 'text-slate',
  paid: 'text-ok',
  no_charge: 'text-ink-2',
  void: 'text-danger',
};
const LEGEND: InvoiceDisplayStatus[] = ['pending', 'partial', 'paid', 'no_charge', 'void'];

const columns: Column<InvoiceSummary>[] = [
  {
    key: 'number',
    header: 'Documento',
    width: '200px',
    cell: (r) => <span className="num text-[14.5px] font-semibold text-ink">{r.number}</span>,
  },
  { key: 'issued_at', header: 'Fecha', width: '168px', cell: (r) => <span className="tabular text-ink-2">{formatDateTime(r.issued_at)}</span> },
  { key: 'patient', header: 'Paciente', cell: (r) => <span className="font-medium text-ink">{r.patient_name}</span> },
  { key: 'total', header: 'Total', numeric: true, width: '128px', cell: (r) => <Amount cents={r.total_cents} className="font-semibold text-ink" /> },
  {
    key: 'balance',
    header: 'Saldo',
    numeric: true,
    width: '128px',
    cell: (r) =>
      r.balance_cents > 0 && r.status !== 'void' ? (
        <Amount cents={r.balance_cents} className="font-semibold text-warn" />
      ) : (
        <Dash label="Sin saldo" />
      ),
  },
  { key: 'status', header: 'Estado', width: '176px', cell: (r) => <StatusStamp status={r} /> },
];

/** /recibos — facturas emitidas con filtros en la URL (?search=&date_from=&date_to=&status=&pending=1&page=). */
export default function RecibosPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const urlSearch = params.get('search') ?? '';
  const dateFrom = params.get('date_from') ?? '';
  const dateTo = params.get('date_to') ?? '';
  const rawStatus = params.get('status') ?? '';
  const status = isDisplayStatus(rawStatus) ? rawStatus : '';
  const pending = params.get('pending') === '1';
  const page = Math.max(1, Number(params.get('page')) || 1);

  function update(patch: Record<string, string | null>) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v === null || v === '') next.delete(k);
          else next.set(k, v);
        }
        if (!('page' in patch)) next.delete('page');
        return next;
      },
      { replace: true },
    );
  }

  // Search box mirrors ?search= (the command palette links here) and writes back debounced.
  const [text, setText] = useState(urlSearch);
  const [lastUrlSearch, setLastUrlSearch] = useState(urlSearch);
  if (urlSearch !== lastUrlSearch) {
    setLastUrlSearch(urlSearch);
    setText(urlSearch);
  }
  const debounced = useDebouncedValue(text, 300);
  useEffect(() => {
    const value = debounced.trim();
    if (debounced === text && value !== urlSearch) update({ search: value });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const query = {
    search: urlSearch,
    date_from: dateFrom,
    date_to: dateTo,
    status: status ? DISPLAY_STATUS_TO_API[status] : '',
    pending: pending ? 1 : undefined,
    page,
    per_page: PER_PAGE,
  };
  const list = useQuery({
    queryKey: qk.invoices(query),
    queryFn: ({ signal }) => api.get<Paginated<InvoiceSummary>>('/invoices', query, { signal }),
    placeholderData: keepPreviousData,
  });

  const hasFilters = Boolean(urlSearch || dateFrom || dateTo || status || pending);
  const dateError = dateFrom && dateTo && dateFrom > dateTo ? '“Desde” no puede ser posterior a “Hasta”.' : null;

  return (
    <>
      <PageHeader title="Recibos" description="Facturas emitidas, cobros pendientes y reimpresiones." />

      <section aria-label="Facturas" className="overflow-hidden rounded-[var(--radius-md)] border border-junta bg-surface">
        <div role="search" className="flex flex-wrap items-end gap-x-3 gap-y-2 border-b border-junta px-4 py-3">
          <Field label="Paciente o número" className="min-w-[240px] flex-1">
            <Input
              type="search"
              prefix={<Search />}
              value={text}
              placeholder="Ej. María López o 000-001-01-00000012"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') update({ search: text.trim() });
              }}
            />
          </Field>
          <Field label="Desde" className="w-[150px]">
            <Input type="date" value={dateFrom} max={dateTo || undefined} invalid={Boolean(dateError)} onChange={(e) => update({ date_from: e.target.value })} />
          </Field>
          <Field label="Hasta" className="w-[150px]">
            <Input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => update({ date_to: e.target.value })} />
          </Field>
          <Field label="Estado" className="w-[190px]">
            <Select value={status} placeholder="Todos" options={STATUS_OPTIONS} onChange={(e) => update({ status: e.target.value })} />
          </Field>
          <Checkbox
            className="h-9 items-center"
            label="Solo con saldo pendiente"
            checked={pending}
            onChange={(e) => update({ pending: e.target.checked ? '1' : null })}
          />
          {hasFilters && (
            <Button
              variant="ghost"
              leftIcon={<FilterX />}
              onClick={() => {
                setText('');
                setParams(new URLSearchParams(), { replace: true });
              }}
            >
              Limpiar filtros
            </Button>
          )}
        </div>
        {dateError && (
          <p role="alert" className="border-b border-junta bg-danger-soft px-4 py-2 text-[13px] font-medium text-danger">
            {dateError}
          </p>
        )}
        <div className="flex h-9 items-center justify-between gap-3 border-b border-junta px-4 text-[12.5px] text-ink-2">
          <span aria-live="polite">
            {list.data ? (
              <>
                <span className="num font-semibold text-ink">{list.data.total}</span> {list.data.total === 1 ? 'factura' : 'facturas'}
                {hasFilters ? ' con los filtros aplicados' : ''}
              </>
            ) : (
              'Cargando…'
            )}
          </span>
          <span className="hidden items-center gap-3 sm:flex" aria-hidden="true">
            {LEGEND.map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <StatusGlyph shape={INVOICE_STATUS_SHAPE[s]} className={GLYPH_TONE[s]} />
                {INVOICE_STATUS_LABEL[s]}
              </span>
            ))}
          </span>
        </div>

        {list.isError ? (
          <EmptyState
            compact
            title="No se pudieron cargar los recibos"
            description={errorMessage(list.error)}
            action={<Button onClick={() => void list.refetch()}>Reintentar</Button>}
          />
        ) : (
          <DataTable
            caption="Facturas y recibos"
            columns={columns}
            rows={list.data?.items}
            rowKey={(r) => r.id}
            loading={list.isFetching}
            density="compact"
            onRowClick={(r) => navigate(`/recibos/${r.id}`)}
            rowActions={(r) => (
              <Link
                to={`/recibos/${r.id}`}
                aria-label={`Ver detalle de ${r.number}`}
                className="pressable inline-flex h-7 items-center gap-1 rounded-[var(--radius-sm)] px-2 text-[13px] font-semibold text-slate hover:bg-slate-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
              >
                Ver
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </Link>
            )}
            empty={
              <EmptyState
                compact
                icon={<Search />}
                title={hasFilters ? 'Sin resultados' : 'Aún no hay facturas'}
                description={
                  hasFilters ? 'No hay facturas que coincidan con los filtros.' : 'Las operaciones emitidas en Cobrar aparecerán aquí.'
                }
              />
            }
            pagination={
              list.data
                ? { page: list.data.page, perPage: list.data.per_page, total: list.data.total, onPageChange: (p) => update({ page: String(p) }) }
                : undefined
            }
          />
        )}
      </section>
    </>
  );
}
