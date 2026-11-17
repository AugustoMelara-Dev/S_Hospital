import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Printer } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/dates';
import type { CashSession, Paginated, User } from '@/api/types';
import { useAuth, usePermissions } from '@/auth/hooks';
import { Badge, Card, DataTable, Dialog, Field, IconButton, Input, Money, Select, Skeleton, type Column } from '@/ui';
import { DifferenceValue } from './ArqueoTab';
import { CierreResumen, printSummary } from './CierreResumen';
import { invalidateCash, useCashRegisters, useSessionDetail, useSessionList } from './queries';
import { MovimientosTab } from './SessionTabs';
import { SessionView } from './SessionView';
import { operatorName, registerName, type CashSessionsQuery } from './types';

const DIFF_OPTIONS = [
  { value: 'all', label: 'Todas' },
  { value: 'balanced', label: 'Cuadradas' },
  { value: 'shortage', label: 'Faltante' },
  { value: 'overage', label: 'Sobrante' },
];

/** "Histórico de caja": filters + paginated sessions table + detail dialog. */
export function Historico() {
  const { can } = usePermissions();
  const [params, setParams] = useState<CashSessionsQuery>({ difference: 'all', page: 1 });
  const [detailId, setDetailId] = useState<number | null>(null);
  const list = useSessionList(params);
  const registers = useCashRegisters();
  const canUsers = can('users.view');
  const users = useQuery({
    queryKey: ['users', 'list', { per_page: 200 }],
    queryFn: () => api.get<Paginated<User>>('/users', { per_page: 200 }),
    enabled: canUsers,
    staleTime: 5 * 60_000,
  });

  const set = (patch: Partial<CashSessionsQuery>) => setParams((p) => ({ ...p, ...patch, page: 1 }));
  const rangeError = params.date_from && params.date_to && params.date_from > params.date_to ? '“Desde” no puede ser posterior a “Hasta”.' : null;

  const columns: Column<CashSession>[] = [
    { key: 'opened', header: 'Turno abierto', cell: (s) => <span className="num">{formatDateTime(s.opened_at)}</span> },
    { key: 'register', header: 'Caja', cell: (s) => registerName(s) },
    { key: 'user', header: 'Operador', cell: (s) => operatorName(s) },
    {
      key: 'status',
      header: 'Estado',
      cell: (s) =>
        s.status === 'open' ? (
          <Badge tone="ok" shape="filled">
            Abierta
          </Badge>
        ) : (
          <Badge tone="neutral" shape="struck">
            Cerrada
          </Badge>
        ),
    },
    { key: 'opening', header: 'Apertura', numeric: true, cell: (s) => <Money cents={s.opening_cents} /> },
    {
      key: 'expected',
      header: 'Esperado',
      numeric: true,
      cell: (s) => {
        const cents = s.expected_cash_cents ?? s.reconciliation?.expected_cash_cents ?? null;
        // Open sessions in the list carry no reconciliation: the figure is shown in the detail.
        return cents === null ? <span className="text-ink-3">—</span> : <Money cents={cents} />;
      },
    },
    {
      key: 'counted',
      header: 'Contado',
      numeric: true,
      cell: (s) => (s.counted_cents === null ? <span className="text-ink-3">—</span> : <Money cents={s.counted_cents} />),
    },
    {
      key: 'diff',
      header: 'Diferencia',
      numeric: true,
      cell: (s) => {
        if (s.difference_cents === null || s.difference_cents === undefined) return <span className="text-ink-3">—</span>;
        return <DifferenceValue cents={s.difference_cents} className="justify-end" />;
      },
    },
  ];

  return (
    <Card title="Histórico de caja" description="Turnos anteriores y abiertos que puede consultar." flush>
      <div className="flex flex-wrap items-end gap-3 border-b border-junta bg-surface-2 px-4 py-2.5">
        <Field label="Desde" className="w-[160px]" error={rangeError}>
          <Input type="date" value={params.date_from ?? ''} onChange={(e) => set({ date_from: e.target.value || undefined })} />
        </Field>
        <Field label="Hasta" className="w-[160px]">
          <Input type="date" value={params.date_to ?? ''} onChange={(e) => set({ date_to: e.target.value || undefined })} />
        </Field>
        <Field label="Caja" className="w-[180px]">
          <Select
            value={params.cash_register_id ?? ''}
            onChange={(e) => set({ cash_register_id: e.target.value || undefined })}
            placeholder="Todas"
            options={(registers.data ?? []).map((r) => ({ value: String(r.id), label: r.name }))}
          />
        </Field>
        {canUsers && (
          <Field label="Operador" className="w-[200px]">
            <Select
              value={params.user_id ?? ''}
              onChange={(e) => set({ user_id: e.target.value || undefined })}
              placeholder="Todos"
              options={(users.data?.items ?? []).map((u) => ({ value: String(u.id), label: u.name }))}
            />
          </Field>
        )}
        <Field label="Diferencia" className="w-[160px]">
          <Select
            value={params.difference ?? 'all'}
            onChange={(e) => set({ difference: e.target.value as CashSessionsQuery['difference'] })}
            options={DIFF_OPTIONS}
          />
        </Field>
      </div>
      <DataTable
        caption="Histórico de caja"
        columns={columns}
        rows={rangeError ? [] : list.data?.items}
        rowKey={(s) => s.id}
        loading={list.isFetching}
        density="compact"
        onRowClick={(s) => setDetailId(s.id)}
        rowActions={(s) => (
          <>
            <IconButton label="Ver detalle" icon={<Eye />} size="sm" onClick={() => setDetailId(s.id)} />
            {s.status === 'closed' && (
              <IconButton label="Imprimir resumen" icon={<Printer />} size="sm" onClick={() => void printSummary(s.id)} />
            )}
          </>
        )}
        pagination={
          list.data
            ? {
                page: list.data.page,
                perPage: list.data.per_page,
                total: list.data.total,
                onPageChange: (page) => setParams((p) => ({ ...p, page })),
              }
            : undefined
        }
      />
      <SessionDetailDialog id={detailId} onClose={() => setDetailId(null)} />
    </Card>
  );
}

function SessionDetailDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { me } = useAuth();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const detail = useSessionDetail(id);
  const [closed, setClosed] = useState<CashSession | null>(null);
  const s = closed ?? detail.data;

  const own = s && me ? s.user.id === me.id : false;
  const canClose = s ? (own && can('cash.close')) || can('cash.close_any') : false;

  return (
    <Dialog
      open={id !== null}
      onClose={() => {
        setClosed(null);
        onClose();
      }}
      size="xl"
      title={s ? `Turno de ${operatorName(s)}` : 'Detalle del turno'}
      description={s ? `${registerName(s)} · abierto el ${formatDateTime(s.opened_at)}` : undefined}
    >
      {!s ? (
        <div className="flex flex-col gap-3 py-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton lines={4} />
        </div>
      ) : s.status === 'open' ? (
        <SessionView
          session={s}
          canClose={canClose}
          movementsPreloaded
          onClosed={(c) => {
            setClosed(c);
            void invalidateCash(qc);
          }}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <CierreResumen session={s} justClosed={closed !== null} />
          {s.movements && <MovimientosTab movements={s.movements} loading={false} />}
        </div>
      )}
    </Dialog>
  );
}
