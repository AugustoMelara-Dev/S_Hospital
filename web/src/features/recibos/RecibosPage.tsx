import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronRight, FilterX, Search } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/dates';
import { qk } from '@/api/queryClient';
import { INVOICE_STATUS_LABEL, type InvoiceDisplayStatus, type Paginated } from '@/api/types';
import { Button, Card, Checkbox, DataTable, EmptyState, Field, Input, Money, PageHeader, Select, StatusStamp, type Column } from '@/ui';
import { useDebouncedValue } from '@/features/cobrar/hooks';
import { STATUS_FILTER_TO_API, type InvoiceListItem } from './types';

const PER_PAGE = 25;
const STATUS_OPTIONS = (Object.keys(INVOICE_STATUS_LABEL) as InvoiceDisplayStatus[]).map((s) => ({
  value: s,
  label: INVOICE_STATUS_LABEL[s],
}));

function isDisplayStatus(v: string): v is InvoiceDisplayStatus {
  return v in INVOICE_STATUS_LABEL;
}

const columns: Column<InvoiceListItem>[] = [
  {
    key: 'number',
    header: 'Documento',
    cell: (r) => <span className="num font-medium text-ink">{r.number}</span>,
  },
  { key: 'issued_at', header: 'Fecha', cell: (r) => <span className="tabular text-ink-2">{formatDateTime(r.issued_at)}</span> },
  { key: 'patient', header: 'Paciente', cell: (r) => <span className="text-ink">{r.patient_name}</span> },
  { key: 'total', header: 'Total', numeric: true, cell: (r) => <Money cents={r.total_cents} /> },
  {
    key: 'balance',
    header: 'Saldo',
    numeric: true,
    cell: (r) => <Money cents={r.balance_cents} className={r.balance_cents > 0 && r.status !== 'void' ? 'font-medium text-warn' : 'text-ink-3'} />,
  },
  { key: 'status', header: 'Estado', cell: (r) => <StatusStamp status={r} /> },
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
    status: status ? STATUS_FILTER_TO_API[status] : '',
    pending: pending ? 1 : undefined,
    page,
    per_page: PER_PAGE,
  };
  const list = useQuery({
    queryKey: qk.invoices(query),
    queryFn: ({ signal }) => api.get<Paginated<InvoiceListItem>>('/invoices', query, { signal }),
    placeholderData: keepPreviousData,
  });

  const hasFilters = Boolean(urlSearch || dateFrom || dateTo || status || pending);
  const dateError = dateFrom && dateTo && dateFrom > dateTo ? '“Desde” no puede ser posterior a “Hasta”.' : null;

  return (
    <>
      <PageHeader title="Recibos" description="Facturas emitidas, cobros pendientes y reimpresiones." />

      <Card className="mb-4">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_150px_150px_200px] md:items-end">
          <Field label="Paciente o número">
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
          <Field label="Desde" error={dateError}>
            <Input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => update({ date_from: e.target.value })} />
          </Field>
          <Field label="Hasta">
            <Input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => update({ date_to: e.target.value })} />
          </Field>
          <Field label="Estado">
            <Select value={status} placeholder="Todos" options={STATUS_OPTIONS} onChange={(e) => update({ status: e.target.value })} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Checkbox
            label="Solo con saldo pendiente"
            checked={pending}
            onChange={(e) => update({ pending: e.target.checked ? '1' : null })}
          />
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
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
      </Card>

      <Card flush>
        {list.isError ? (
          <EmptyState
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
            onRowClick={(r) => navigate(`/recibos/${r.id}`)}
            rowActions={(r) => (
              <Link
                to={`/recibos/${r.id}`}
                aria-label={`Ver detalle de ${r.number}`}
                className="pressable inline-flex h-7 items-center gap-1 rounded-[var(--radius-sm)] px-2 text-[12.5px] font-medium text-brand hover:bg-brand-soft/60"
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
      </Card>
    </>
  );
}
