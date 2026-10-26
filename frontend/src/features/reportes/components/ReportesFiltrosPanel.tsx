import { useState, type ReactNode } from 'react';
import { ChevronDownIcon, RefreshCwIcon } from 'lucide-react';
import { AdminCallout, AdminChip, AdminField, AdminPanel } from '@/design-system/admin/components';
import { cn } from '@/lib/utils';
import { PRESET_LABELS, computePresetRange, type PresetKey } from '@/features/reports/components/reportDateRanges';
import {
  FILTERS_TOGGLE_OPEN,
  INPUT_CLASS,
  PRIMARY_BUTTON,
  SEGMENT_BUTTON,
  SEGMENT_BUTTON_ACTIVE,
  SEGMENT_GROUP,
  SECONDARY_BUTTON,
  SELECT_CLASS,
} from '../reportesUi';
import type { ReportesFiltros } from '../types';

export type FiltroOpcion = { value: string; label: string };
export type OpcionesAuxiliaresEstado = 'pending' | 'error' | 'empty' | 'ready';

type Props = {
  filters: ReportesFiltros;
  preset: PresetKey;
  onPresetChange: (preset: PresetKey) => void;
  onChange: (filters: ReportesFiltros) => void;
  onApply: () => void;
  canFilterScope: boolean;
  loading: boolean;
  rangeError: string | null;
  hasUnappliedChanges: boolean;
  cajeros: FiltroOpcion[];
  cajas: FiltroOpcion[];
  categorias: FiltroOpcion[];
  cashOptionsStatus: OpcionesAuxiliaresEstado;
  categoryOptionsStatus: OpcionesAuxiliaresEstado;
  onRetryCashOptions: () => void;
  onRetryCategoryOptions: () => void;
  cajerosSearch?: ReactNode;
  cajasSearch?: ReactNode;
};

/** Presets visibles como segmentos; `custom` sólo se anuncia como chip. */
const PRESET_ORDER: PresetKey[] = ['today', 'yesterday', 'last7', 'thisMonth', 'lastMonth'];

export const METHOD_OPTIONS: FiltroOpcion[] = [
  { value: 'todos', label: 'Todos los métodos' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'other', label: 'Otro' },
];

export const STATUS_OPTIONS: FiltroOpcion[] = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'issued', label: 'Pendiente de cobro' },
  { value: 'partial', label: 'Parcial' },
  { value: 'paid', label: 'Pagada' },
  { value: 'void', label: 'Anulada' },
];

function setOptionalNumber(
  filters: ReportesFiltros,
  key: 'user_id' | 'cash_session_id' | 'category_id',
  raw: string,
): ReportesFiltros {
  const next = { ...filters };
  if (raw === '' || raw === 'todos') {
    delete next[key];
  } else {
    next[key] = Number(raw);
  }
  return next;
}

/** Filtros secundarios activos: cuentan para el distintivo del plegado. */
function countSecondaryFilters(filters: ReportesFiltros, canFilterScope: boolean): number {
  let count = 0;
  if (filters.method) count += 1;
  if (filters.status) count += 1;
  if (canFilterScope) {
    if (filters.user_id !== undefined) count += 1;
    if (filters.cash_session_id !== undefined) count += 1;
    if (filters.category_id !== undefined) count += 1;
  }
  return count;
}

function unavailableOptionLabel(status: OpcionesAuxiliaresEstado, emptyLabel: string): string {
  if (status === 'pending') return 'Cargando lista…';
  if (status === 'empty') return emptyLabel;
  return 'No se pudo cargar la lista';
}

/**
 * Barra de filtros del reporte. La decisión principal —el período de emisión—
 * vive siempre visible como control segmentado + rango; método, estado, cajero,
 * caja y categoría se pliegan bajo «Filtros» con el número de activos. Los
 * ocho controles no deben abrir la pantalla antes de la primera cifra.
 */
export function ReportesFiltrosPanel({
  filters,
  preset,
  onPresetChange,
  onChange,
  onApply,
  canFilterScope,
  loading,
  rangeError,
  hasUnappliedChanges,
  cajeros,
  cajas,
  categorias,
  cashOptionsStatus,
  categoryOptionsStatus,
  onRetryCashOptions,
  onRetryCategoryOptions,
  cajerosSearch,
  cajasSearch,
}: Props) {
  const disabled = loading;
  const activeCount = countSecondaryFilters(filters, canFilterScope);
  const [filtersOpen, setFiltersOpen] = useState(activeCount > 0);
  const cashSelectionUnavailable =
    (filters.user_id !== undefined || filters.cash_session_id !== undefined) && cashOptionsStatus !== 'ready';
  const categorySelectionUnavailable = filters.category_id !== undefined && categoryOptionsStatus !== 'ready';
  const invalidScopeSelection = canFilterScope && (cashSelectionUnavailable || categorySelectionUnavailable);

  const changePreset = (next: PresetKey) => {
    onPresetChange(next);
    if (next !== 'custom') {
      const range = computePresetRange(next);
      onChange({ ...filters, date_from: range.from, date_to: range.to });
    }
  };

  const changeDate = (key: 'date_from' | 'date_to', value: string) => {
    if (preset !== 'custom') onPresetChange('custom');
    onChange(key === 'date_from' ? { ...filters, date_from: value } : { ...filters, date_to: value });
  };

  return (
    <AdminPanel as="div">
      <div className="flex flex-col gap-3 px-4 py-3">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]">
              Período del reporte
            </span>
            <div role="group" aria-label="Período del reporte" className={SEGMENT_GROUP}>
              {PRESET_ORDER.map((key) => {
                const active = preset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    data-ui-press
                    aria-pressed={active}
                    disabled={disabled}
                    onClick={() => changePreset(key)}
                    className={cn(SEGMENT_BUTTON, active && SEGMENT_BUTTON_ACTIVE)}
                  >
                    {PRESET_LABELS[key]}
                  </button>
                );
              })}
            </div>
          </div>

          {preset === 'custom' ? <AdminChip className="mb-1.5">Personalizado</AdminChip> : null}

          <AdminField label="Desde" htmlFor="reportes-desde" className="w-36">
            <input
              id="reportes-desde"
              type="date"
              value={filters.date_from}
              disabled={disabled}
              aria-label="Desde"
              onChange={(event) => changeDate('date_from', event.target.value)}
              className={INPUT_CLASS}
            />
          </AdminField>

          <AdminField label="Hasta" htmlFor="reportes-hasta" className="w-36">
            <input
              id="reportes-hasta"
              type="date"
              value={filters.date_to}
              disabled={disabled}
              aria-label="Hasta"
              onChange={(event) => changeDate('date_to', event.target.value)}
              className={INPUT_CLASS}
            />
          </AdminField>

          <button
            type="button"
            data-ui-press
            className={PRIMARY_BUTTON}
            onClick={onApply}
            disabled={disabled || Boolean(rangeError) || invalidScopeSelection}
          >
            <RefreshCwIcon
              aria-hidden="true"
              data-icon="inline-start"
              className={loading ? 'animate-spin' : undefined}
            />
            Aplicar
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-ui-press
            aria-expanded={filtersOpen}
            aria-controls="reportes-filtros-secundarios"
            onClick={() => setFiltersOpen((open) => !open)}
            className={cn(SECONDARY_BUTTON, 'group', filtersOpen && FILTERS_TOGGLE_OPEN)}
          >
            <ChevronDownIcon
              aria-hidden="true"
              data-icon
              className={cn(
                'size-4 transition-transform duration-[var(--ui-duration-state)] ease-[var(--ui-ease-in-out)]',
                filtersOpen && 'rotate-180',
              )}
            />
            Filtros
            {activeCount > 0 ? (
              <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--ui-action-subtle-strong,#70A8FF38)] px-1.5 text-[length:var(--ui-text-xs)] font-semibold text-[color:var(--ui-action,#70A8FF)]">
                {activeCount}
              </span>
            ) : null}
          </button>

          {activeCount > 0 && !filtersOpen ? (
            <span className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
              {activeCount === 1 ? '1 filtro aplicado al período' : `${activeCount} filtros aplicados al período`}
            </span>
          ) : null}
        </div>

        {filtersOpen ? (
          <div
            id="reportes-filtros-secundarios"
            className="grid gap-3 border-t border-[var(--ui-line)] pt-3 md:grid-cols-3 xl:grid-cols-5"
          >
            {canFilterScope && cashOptionsStatus === 'error' ? (
              <AdminCallout tone="error" title="Cajeros y cajas no disponibles" className="md:col-span-3 xl:col-span-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>El reporte actual sigue disponible. Vuelva a intentarlo para usar estos filtros.</span>
                  <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={onRetryCashOptions}>
                    Reintentar
                  </button>
                </div>
              </AdminCallout>
            ) : canFilterScope && cashOptionsStatus === 'pending' ? (
              <p role="status" className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)] md:col-span-3 xl:col-span-5">
                Cargando cajeros y sesiones de caja…
              </p>
            ) : canFilterScope && cashOptionsStatus === 'empty' ? (
              <p role="status" className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)] md:col-span-3 xl:col-span-5">
                No hay sesiones de caja disponibles para filtrar.
              </p>
            ) : null}

            {canFilterScope && categoryOptionsStatus === 'error' ? (
              <AdminCallout tone="error" title="Categorías no disponibles" className="md:col-span-3 xl:col-span-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>El reporte actual sigue disponible. Vuelva a intentarlo para usar este filtro.</span>
                  <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={onRetryCategoryOptions}>
                    Reintentar
                  </button>
                </div>
              </AdminCallout>
            ) : canFilterScope && categoryOptionsStatus === 'pending' ? (
              <p role="status" className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)] md:col-span-3 xl:col-span-5">
                Cargando categorías…
              </p>
            ) : canFilterScope && categoryOptionsStatus === 'empty' ? (
              <p role="status" className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)] md:col-span-3 xl:col-span-5">
                No hay categorías activas disponibles para filtrar.
              </p>
            ) : null}

            <AdminField label="Método de cobro" htmlFor="reportes-metodo">
              <select
                id="reportes-metodo"
                value={filters.method ?? 'todos'}
                disabled={disabled}
                aria-label="Método de cobro"
                onChange={(event) => {
                  const next = { ...filters };
                  if (event.target.value === 'todos') delete next.method;
                  else next.method = event.target.value as ReportesFiltros['method'];
                  onChange(next);
                }}
                className={SELECT_CLASS}
              >
                {METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </AdminField>

            <AdminField label="Estado de operación" htmlFor="reportes-estado">
              <select
                id="reportes-estado"
                value={filters.status ?? 'todos'}
                disabled={disabled}
                aria-label="Estado de operación"
                onChange={(event) => {
                  const next = { ...filters };
                  if (event.target.value === 'todos') delete next.status;
                  else next.status = event.target.value as ReportesFiltros['status'];
                  onChange(next);
                }}
                className={SELECT_CLASS}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </AdminField>

            {canFilterScope ? (
              <>
                <AdminField label="Cajero" htmlFor="reportes-cajero">
                  <select
                    id="reportes-cajero"
                    value={filters.user_id !== undefined ? String(filters.user_id) : 'todos'}
                    disabled={disabled || cashOptionsStatus !== 'ready'}
                    aria-label="Cajero"
                    onChange={(event) => onChange(setOptionalNumber(filters, 'user_id', event.target.value))}
                    className={SELECT_CLASS}
                  >
                    {cashOptionsStatus === 'ready' ? (
                      <option value="todos">Todos los cajeros</option>
                    ) : (
                      <option value={filters.user_id !== undefined ? String(filters.user_id) : 'todos'}>
                        {filters.user_id !== undefined
                          ? 'Cajero seleccionado · selección conservada'
                          : unavailableOptionLabel(cashOptionsStatus, 'Sin cajeros disponibles')}
                      </option>
                    )}
                    {cajeros.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {cajerosSearch}
                </AdminField>

                <AdminField label="Caja o turno" htmlFor="reportes-caja">
                  <select
                    id="reportes-caja"
                    value={filters.cash_session_id !== undefined ? String(filters.cash_session_id) : 'todos'}
                    disabled={disabled || cashOptionsStatus !== 'ready'}
                    aria-label="Caja o turno"
                    onChange={(event) =>
                      onChange(setOptionalNumber(filters, 'cash_session_id', event.target.value))
                    }
                    className={SELECT_CLASS}
                  >
                    {cashOptionsStatus === 'ready' ? (
                      <option value="todos">Todas las cajas</option>
                    ) : (
                      <option value={filters.cash_session_id !== undefined ? String(filters.cash_session_id) : 'todos'}>
                        {filters.cash_session_id !== undefined
                          ? 'Turno seleccionado · selección conservada'
                          : unavailableOptionLabel(cashOptionsStatus, 'Sin turnos disponibles')}
                      </option>
                    )}
                    {cajas.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {cajasSearch}
                </AdminField>

                <AdminField label="Categoría" htmlFor="reportes-categoria">
                  <select
                    id="reportes-categoria"
                    value={filters.category_id !== undefined ? String(filters.category_id) : 'todos'}
                    disabled={disabled || categoryOptionsStatus !== 'ready'}
                    aria-label="Categoría"
                    onChange={(event) =>
                      onChange(setOptionalNumber(filters, 'category_id', event.target.value))
                    }
                    className={SELECT_CLASS}
                  >
                    {categoryOptionsStatus === 'ready' ? (
                      <option value="todos">Todas las categorías</option>
                    ) : (
                      <option value={filters.category_id !== undefined ? String(filters.category_id) : 'todos'}>
                        {filters.category_id !== undefined
                          ? 'Categoría seleccionada · selección conservada'
                          : unavailableOptionLabel(categoryOptionsStatus, 'Sin categorías disponibles')}
                      </option>
                    )}
                    {categorias.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </AdminField>
              </>
            ) : null}
          </div>
        ) : null}

        {invalidScopeSelection ? (
          <AdminCallout tone="error" title="Filtros pendientes">
            Vuelva a cargar los filtros antes de aplicar esta selección o exportar el reporte.
          </AdminCallout>
        ) : rangeError ? (
          <AdminCallout tone="error" title="Rango no válido">
            {rangeError}
          </AdminCallout>
        ) : hasUnappliedChanges ? (
          <p
            role="status"
            className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-warn)]"
          >
            Cambios sin aplicar: pulse «Aplicar» para actualizar el reporte y las exportaciones.
          </p>
        ) : null}
      </div>
    </AdminPanel>
  );
}
