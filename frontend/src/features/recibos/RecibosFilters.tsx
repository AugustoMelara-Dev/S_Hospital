import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { SearchIcon } from 'lucide-react';
import type { CashSession, InvoiceFilters } from '@/lib/api';
import { formatDateTimeEs } from '@/lib/format/formatDate';
import { STATUS_FILTER_OPTIONS } from './recibosModel';
import {
  COMPACT_SELECT_CLASS,
  MICRO_LABEL,
  RANGE_FRAME_CLASS,
  RANGE_INPUT_CLASS,
  TOOLBAR_PRIMARY_BUTTON,
  TOOLBAR_SECONDARY_BUTTON,
} from './recibosUi';

type RecibosFiltersProps = {
  filters: InvoiceFilters;
  hasActiveFilters: boolean;
  loading: boolean;
  canFilterByCash: boolean;
  cashSessions: CashSession[];
  cashSessionsLoading: boolean;
  cashOptions?: { value: string; label: string }[];
  cashSearch?: ReactNode;
  onCashSelectionChange?: (id: number | undefined) => void;
  onApply: (filters: InvoiceFilters) => void;
  onClear: () => void;
};

function looksLikeDocumentNumber(value: string): boolean {
  return /^[0-9][0-9-]*$/.test(value);
}

/**
 * Barra de filtros integrada de Recibos: una busqueda dominante (paciente o
 * numero), el periodo en un unico control y los criterios secundarios
 * (estado/caja) agrupados en la misma fila. No aplica nada mientras el cajero
 * escribe: la busqueda se confirma con Buscar o Enter, y Limpiar restaura la
 * lista. Es la cabecera del espacio de trabajo, no una tarjeta aparte.
 */
export function RecibosFilters({
  filters,
  hasActiveFilters,
  loading,
  canFilterByCash,
  cashSessions,
  cashSessionsLoading,
  cashOptions,
  cashSearch,
  onCashSelectionChange,
  onApply,
  onClear,
}: RecibosFiltersProps) {
  const [draft, setDraft] = useState<InvoiceFilters>(filters);
  const [rangeError, setRangeError] = useState('');

  useEffect(() => {
    setDraft(filters);
    setRangeError('');
  }, [filters]);

  const hasDraftChanges = JSON.stringify(draft) !== JSON.stringify(filters);

  function update(patch: Partial<InvoiceFilters>) {
    setRangeError('');
    setDraft((current) => ({ ...current, ...patch, page: 1 }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (draft.date_from && draft.date_to && draft.date_from > draft.date_to) {
      setRangeError('La fecha "Desde" no puede ser posterior a "Hasta". Corrija el rango para buscar.');
      return;
    }

    setRangeError('');
    const raw = (draft.patient ?? '').trim();
    const isNumber = raw.length > 0 && looksLikeDocumentNumber(raw);

    onApply({
      ...draft,
      patient: isNumber ? '' : raw,
      invoice_number: isNumber ? raw : '',
      page: 1,
    });
  }

  const queryValue = draft.patient || draft.invoice_number || '';

  return (
    <form
      role="search"
      aria-label="Búsqueda de operaciones"
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 border-b border-[var(--ui-line)] bg-[var(--ui-surface-alt)] px-4 py-3"
    >
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <div className="flex min-w-[15rem] flex-1 flex-col gap-1.5">
          <label htmlFor="recibos-query" className={MICRO_LABEL}>
            Paciente o número
          </label>
          <div
            data-ui-focus-frame
            className="flex min-w-0 items-center gap-2 rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-2.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--ui-focus)]"
          >
            <SearchIcon aria-hidden="true" className="size-4 shrink-0 text-[color:var(--ui-ink-soft)]" />
            <input
              id="recibos-query"
              type="search"
              value={queryValue}
              placeholder="Nombre del paciente o número de documento"
              onChange={(event) => update({ patient: event.target.value, invoice_number: '' })}
              className="h-[var(--ui-control-h)] min-w-0 flex-1 bg-transparent text-[length:var(--ui-text-base)] text-[color:var(--ui-ink)] outline-none placeholder:text-[color:var(--ui-ink-soft)]"
            />
          </div>
        </div>

        <span aria-hidden="true" className="hidden h-9 w-px self-end bg-[var(--ui-line)] lg:block" />

        <div className="flex flex-col gap-1.5">
          <span id="recibos-periodo" className={MICRO_LABEL}>
            Período
          </span>
          <div
            role="group"
            aria-labelledby="recibos-periodo"
            data-ui-focus-frame
            className={RANGE_FRAME_CLASS}
          >
            <input
              id="recibos-desde"
              type="date"
              aria-label="Desde"
              value={draft.date_from ?? ''}
              onChange={(event) => update({ date_from: event.target.value })}
              className={`${RANGE_INPUT_CLASS} w-[8.25rem]`}
            />
            <span aria-hidden="true" className="text-[color:var(--ui-ink-faint)]">
              →
            </span>
            <input
              id="recibos-hasta"
              type="date"
              aria-label="Hasta"
              value={draft.date_to ?? ''}
              onChange={(event) => update({ date_to: event.target.value })}
              className={`${RANGE_INPUT_CLASS} w-[8.25rem]`}
            />
          </div>
        </div>

        <div className="flex w-48 flex-col gap-1.5">
          <label htmlFor="recibos-estado" className={MICRO_LABEL}>
            Estado
          </label>
          <select
            id="recibos-estado"
            value={draft.status ?? ''}
            onChange={(event) => update({ status: event.target.value as InvoiceFilters['status'] })}
            className={COMPACT_SELECT_CLASS}
          >
            {STATUS_FILTER_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {canFilterByCash ? (
          <div className="flex w-56 flex-col gap-1.5">
            <label htmlFor="recibos-caja" className={MICRO_LABEL}>
              Caja autorizada
            </label>
            <select
              id="recibos-caja"
              value={draft.cash_session_id ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                update({ cash_session_id: value });
                onCashSelectionChange?.(value ? Number(value) : undefined);
              }}
              className={COMPACT_SELECT_CLASS}
              disabled={cashSessionsLoading}
            >
              <option value="">Todas las cajas autorizadas</option>
              {cashOptions ? cashOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>) : cashSessions.map((session) => (
                <option key={session.id} value={String(session.id)}>
                  {session.cash_register
                    ? session.cash_register.name
                    : 'Turno de caja'}{' '}
                  · {session.user?.name ?? session.user?.username ?? 'Operador no disponible'} ·{' '}
                  {session.status === 'open' ? 'abierta' : `cerrada ${formatDateTimeEs(session.closed_at)}`}
                </option>
              ))}
              {draft.cash_session_id && cashOptions && !cashOptions.some((option) => option.value === String(draft.cash_session_id)) ? <option value={draft.cash_session_id}>Turno seleccionado · selección conservada</option> : null}
            </select>
            {cashSearch}
            {cashSessionsLoading ? (
              <span className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Consultando cajas…</span>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          <button type="submit" data-ui-press className={TOOLBAR_PRIMARY_BUTTON} disabled={loading}>
            {loading ? 'Buscando…' : 'Buscar'}
          </button>
          <button
            type="button"
            className={TOOLBAR_SECONDARY_BUTTON}
            disabled={(!hasActiveFilters && !hasDraftChanges) || loading}
            onClick={onClear}
          >
            Limpiar
          </button>
        </div>
      </div>

      {rangeError ? (
        <p role="alert" className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-danger)]">
          {rangeError}
        </p>
      ) : null}
    </form>
  );
}
