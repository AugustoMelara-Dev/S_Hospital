import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cash, type CashSession, userSafeErrorMessage } from '@/lib/api';
import type { CashSessionHistoryFilters } from '@/lib/api/cash';
import { useCashSessionOptions } from '@/hooks/useCashSessionOptions';
import { CashOptionsSearch } from './CashOptionsSearch';
import { queryKeys } from '@/lib/queryKeys';
import { parseCents } from '@/lib/moneyCents';
import { formatDateTimeEs } from '@/lib/format/formatDate';
import {
  AdminCallout,
  AdminEmpty,
  AdminField,
  AdminPanel,
  AdminPanelHeader,
  AdminTable,
  MoneyText,
  type AdminColumn,
} from '@/design-system/admin/components';
import { INPUT_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../cashUi';

type CashSessionHistoryProps = {
  visible: boolean;
  canViewInvoices: boolean;
};

const PAGE_SIZE = 10;

function operatorName(session: CashSession): string {
  return session.user?.name ?? session.user?.username ?? 'Usuario sin nombre registrado';
}

function cashRegisterName(session: CashSession): string {
  if (!session.cash_register) return 'No disponible';
  return session.cash_register.name;
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
  const [draft, setDraft] = useState<CashSessionHistoryFilters>({});
  const [applied, setApplied] = useState<CashSessionHistoryFilters>({});
  const [filterError, setFilterError] = useState('');
  const registerOptions = useCashSessionOptions('registers', { enabled: visible, selectedId: draft.cash_register_id });
  const operatorOptions = useCashSessionOptions('cashiers', { enabled: visible, selectedId: draft.user_id });
  const hasFilters = Object.values(applied).some((value) => value !== undefined && value !== '');
  function applyHistoryFilters() {
    if (draft.date_from && draft.date_to && draft.date_from > draft.date_to) {
      setFilterError('La fecha inicial no puede ser posterior a la final.');
      return;
    }
    setFilterError('');
    setPage(1);
    setApplied(Object.fromEntries(Object.entries(draft).filter(([, value]) => value !== undefined && value !== '' && value !== 'all')));
  }
  const historyQuery = useQuery({
    queryKey: [...queryKeys.cashSessions.all, 'history', page, applied],
    queryFn: () => cash.getCashSessions({ page, perPage: PAGE_SIZE, ...applied }),
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
      header: 'Turno abierto',
      mobilePrimary: true,
      cell: (session) => (
        <time dateTime={session.opened_at} className="font-semibold tabular-nums">
          {formatDateTimeEs(session.opened_at)}
        </time>
      ),
    },
    {
      key: 'cash_register',
      header: 'Caja física',
      cell: (session) => <span className="break-words">{cashRegisterName(session)}</span>,
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
          to={`/recibos?cash_session_id=${session.id}`}
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

      <form aria-label="Filtros del histórico de caja" className="grid items-start gap-3 border-b border-[var(--ui-line)] bg-[var(--ui-surface-alt)] p-4 sm:grid-cols-2 xl:grid-cols-5" onSubmit={(event) => { event.preventDefault(); applyHistoryFilters(); }}>
        <AdminField label="Desde apertura" htmlFor="history-from">
          <input id="history-from" type="date" value={draft.date_from ?? ''} className={INPUT_CLASS} onChange={(event) => setDraft((current) => ({ ...current, date_from: event.target.value }))} />
        </AdminField>
        <AdminField label="Hasta apertura" htmlFor="history-to">
          <input id="history-to" type="date" value={draft.date_to ?? ''} className={INPUT_CLASS} onChange={(event) => setDraft((current) => ({ ...current, date_to: event.target.value }))} />
        </AdminField>
        <AdminField label="Caja física del histórico" htmlFor="history-register">
          <select id="history-register" value={draft.cash_register_id ?? ''} className={INPUT_CLASS} disabled={registerOptions.isPending} onChange={(event) => setDraft((current) => ({ ...current, cash_register_id: event.target.value ? Number(event.target.value) : undefined }))}>
            <option value="">Todas las cajas autorizadas</option>
            {registerOptions.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            {draft.cash_register_id && !registerOptions.options.some((option) => option.value === String(draft.cash_register_id)) ? <option value={draft.cash_register_id}>Caja seleccionada</option> : null}
          </select>
          <CashOptionsSearch picker={registerOptions} label="Buscar cajas del histórico" />
        </AdminField>
        <AdminField label="Operador del histórico" htmlFor="history-operator">
          <select id="history-operator" value={draft.user_id ?? ''} className={INPUT_CLASS} disabled={operatorOptions.isPending} onChange={(event) => setDraft((current) => ({ ...current, user_id: event.target.value ? Number(event.target.value) : undefined }))}>
            <option value="">Todos los operadores autorizados</option>
            {operatorOptions.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            {draft.user_id && !operatorOptions.options.some((option) => option.value === String(draft.user_id)) ? <option value={draft.user_id}>Operador seleccionado</option> : null}
          </select>
          <CashOptionsSearch picker={operatorOptions} label="Buscar operadores del histórico" />
        </AdminField>
        <AdminField label="Diferencia del cierre" htmlFor="history-difference">
          <select id="history-difference" className={INPUT_CLASS} value={draft.difference ?? 'all'} onChange={(event) => setDraft((current) => ({ ...current, difference: event.target.value as CashSessionHistoryFilters['difference'] }))}>
            <option value="all">Todos los turnos</option>
            <option value="balanced">Cerrados sin diferencia</option>
            <option value="shortage">Cerrados con faltante</option>
            <option value="overage">Cerrados con sobrante</option>
          </select>
        </AdminField>
        <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-5">
          <button type="submit" className={PRIMARY_BUTTON} disabled={historyQuery.isFetching}>Aplicar al histórico</button>
          <button type="button" className={SECONDARY_BUTTON} onClick={() => { setDraft({}); setApplied({}); setPage(1); setFilterError(''); }}>Limpiar histórico</button>
          <p className="self-center text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">El período corresponde a la fecha de apertura. Solo se muestran turnos autorizados.</p>
        </div>
        {filterError ? <p role="alert" className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-danger)] sm:col-span-2 xl:col-span-5">{filterError}</p> : null}
      </form>

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
            title={hasFilters ? 'Sin turnos para estos filtros' : 'Sin turnos registrados'}
            description={hasFilters ? 'Cambie el período o limpie los filtros para consultar otros turnos autorizados.' : 'Las aperturas y cierres aparecerán aquí después de completar el primer turno.'}
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
