import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cash, type CashSession, userSafeErrorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { parseCents } from '@/lib/moneyCents';
import { formatDateTimeEs } from '@/lib/format/formatDate';
import {
  AdminCallout,
  AdminEmpty,
  AdminPanel,
  AdminPanelHeader,
  AdminTable,
  MoneyText,
  type AdminColumn,
} from '@/design-system/admin/components';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../cashUi';

type CashSessionHistoryProps = {
  visible: boolean;
  canViewInvoices: boolean;
};

const PAGE_SIZE = 10;

function operatorName(session: CashSession): string {
  return session.user?.name ?? session.user?.username ?? `Usuario #${session.user_id}`;
}

function cashRegisterName(session: CashSession): string {
  if (!session.cash_register) return 'No disponible';
  return `${session.cash_register.name} · ${session.cash_register.code}`;
}

function SessionStatus({ session }: { session: CashSession }) {
  const open = session.status === 'open';

  return (
    <span
      className={
        open
          ? 'inline-flex rounded-full border border-[var(--ui-action-subtle-strong)] bg-[var(--ui-action-subtle)] px-2 py-0.5 text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-action)]'
          : 'inline-flex rounded-full border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] px-2 py-0.5 text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-ink-soft)]'
      }
    >
      {open ? 'Abierta' : 'Cerrada'}
    </span>
  );
}

/** Histórico real de turnos. Los importes ausentes permanecen ausentes. */
export function CashSessionHistory({ visible, canViewInvoices }: CashSessionHistoryProps) {
  const [page, setPage] = useState(1);
  const historyQuery = useQuery({
    queryKey: [...queryKeys.cashSessions.all, 'history', page],
    queryFn: () => cash.getCashSessions({ page, perPage: PAGE_SIZE }),
    enabled: visible,
    staleTime: 30_000,
  });

  if (!visible) return null;

  const rows = historyQuery.data?.data ?? [];
  const meta = historyQuery.data?.meta;
  const lastPage = meta ? Math.max(1, Math.ceil(meta.total / meta.per_page)) : 1;
  const columns: AdminColumn<CashSession>[] = [
    {
      key: 'session',
      header: 'Sesión',
      mobilePrimary: true,
      cell: (session) => <span className="font-semibold tabular-nums">#{session.id}</span>,
    },
    {
      key: 'cash_register',
      header: 'Caja física',
      cell: (session) => <span className="break-words">{cashRegisterName(session)}</span>,
    },
    {
      key: 'opened_at',
      header: 'Apertura',
      cell: (session) => <time dateTime={session.opened_at}>{formatDateTimeEs(session.opened_at)}</time>,
    },
    {
      key: 'operator',
      header: 'Operador',
      cell: (session) => <span className="break-words">{operatorName(session)}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (session) => <SessionStatus session={session} />,
    },
    {
      key: 'opening',
      header: 'Apertura',
      align: 'right',
      cell: (session) => <MoneyText cents={parseCents(session.opening_amount)} />,
    },
    {
      key: 'counted',
      header: 'Contado',
      align: 'right',
      cell: (session) => <MoneyText cents={parseCents(session.closing_amount)} fallback="Pendiente" />,
    },
    {
      key: 'difference',
      header: 'Diferencia',
      align: 'right',
      cell: (session) => <MoneyText cents={parseCents(session.difference_amount)} fallback="Pendiente" />,
    },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'right',
      cell: (session) => canViewInvoices ? (
        <Link
          to={`/recibos?reconciliation_cash_session_id=${session.id}`}
          className={SECONDARY_BUTTON}
        >
          Ver operaciones
        </Link>
      ) : <span className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Sin acceso a Recibos</span>,
    },
  ];

  return (
    <AdminPanel as="section" aria-labelledby="cash-history-title" className="overflow-hidden">
      <AdminPanelHeader
        id="cash-history-title"
        title="Histórico de caja"
        description="Aperturas y cierres anteriores, con el conteo y la diferencia de cada turno."
      />

      {historyQuery.isLoading ? (
        <p role="status" className="px-4 py-6 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
          Cargando histórico de caja…
        </p>
      ) : historyQuery.isError ? (
        <div className="p-4">
          <AdminCallout tone="error" title="No se pudo cargar el histórico">
            <div className="flex flex-wrap items-center gap-2">
              <span>{userSafeErrorMessage(historyQuery.error, 'No fue posible consultar los turnos de caja.')}</span>
              <button type="button" className={SECONDARY_BUTTON} onClick={() => void historyQuery.refetch()}>
                Reintentar
              </button>
            </div>
          </AdminCallout>
        </div>
      ) : rows.length === 0 ? (
        <div className="p-4">
          <AdminEmpty
            title="Sin turnos registrados"
            description="Las aperturas y cierres aparecerán aquí después de completar el primer turno."
          />
        </div>
      ) : (
        <AdminTable
          caption="Turnos de caja registrados"
          rows={rows}
          columns={columns}
          getRowKey={(session) => String(session.id)}
          minTableWidth="58rem"
        />
      )}

      {meta && lastPage > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ui-line)] bg-[var(--ui-surface-alt)] px-4 py-2.5">
          <span className="text-[length:var(--ui-text-xs)] tabular-nums text-[color:var(--ui-ink-soft)]">
            Página {meta.current_page} de {lastPage}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON}
              disabled={historyQuery.isFetching || meta.current_page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON}
              disabled={historyQuery.isFetching || meta.current_page >= lastPage}
              onClick={() => setPage((current) => Math.min(lastPage, current + 1))}
            >
              Siguiente
            </button>
          </div>
        </div>
      ) : null}
    </AdminPanel>
  );
}
