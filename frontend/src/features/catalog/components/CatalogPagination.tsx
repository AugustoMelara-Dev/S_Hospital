import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { ICON_BUTTON, SELECT_CLASS } from './catalogUi';
import { PER_PAGE_OPTIONS, type CatalogPaginationProps } from './catalogTypes';

const PAGE_BUTTON = 'inline-flex size-9 items-center justify-center rounded-[var(--ui-radius-control)] border border-transparent text-[length:var(--ui-text-base)] font-medium text-[color:var(--ui-ink)] outline-none transition-[color,background-color,border-color,transform] duration-[140ms] ease-[var(--ui-ease-out)] enabled:hover:bg-[var(--ui-surface-alt)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]';

/**
 * Página actual: único acento de acción del panel. La etiqueta sobre relleno
 * usa `--ui-action-foreground` (§1.3 regla 2: blanco rinde 2.20 en dark).
 * `aria-current="page"` da la señal estática para lectores de pantalla; el
 * color no es el único canal.
 */
const PAGE_BUTTON_CURRENT =
  'border-[var(--ui-action)] bg-[var(--ui-action)] font-semibold text-[color:var(--ui-action-foreground)]';

export function CatalogPagination({ isLoading, meta, perPage, servicesCount, onPageChange, onPerPageChange }: CatalogPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(meta.total / perPage));
  const pages = Array.from(new Set([1, meta.current_page - 1, meta.current_page, meta.current_page + 1, totalPages]))
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
  const goTo = (page: number) => {
    if (!isLoading && page !== meta.current_page && page >= 1 && page <= totalPages) onPageChange(page);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ui-line)] p-3">
      <span aria-live="polite" className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
        {isLoading
          ? 'Conteo de conceptos pendiente'
          : `Mostrando ${servicesCount} de ${meta.total} conceptos`}
      </span>
      <label className="flex items-center gap-2 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
        Conceptos por página
        <select
          className={`${SELECT_CLASS} w-auto`}
          value={String(perPage)}
          onChange={(event) => onPerPageChange(Number(event.target.value))}
          aria-label="Conceptos por página"
        >
          {PER_PAGE_OPTIONS.map((option) => <option key={option} value={String(option)}>{option} por pág.</option>)}
        </select>
      </label>
      <nav aria-label="Paginación del catálogo" className="flex items-center gap-1">
        <button
          type="button"
          data-ui-press
          className={ICON_BUTTON}
          aria-label="Página anterior"
          disabled={isLoading || meta.current_page === 1}
          onClick={() => goTo(meta.current_page - 1)}
        >
          <ChevronLeftIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />
        </button>
        {pages.map((page) => (
          <button
            key={page}
            type="button"
            data-ui-press
            aria-label={`Página ${page}`}
            aria-current={page === meta.current_page ? 'page' : undefined}
            disabled={isLoading}
            onClick={() => goTo(page)}
            className={
              page === meta.current_page ? `${PAGE_BUTTON} ${PAGE_BUTTON_CURRENT}` : PAGE_BUTTON
            }
          >
            {page}
          </button>
        ))}
        <button
          type="button"
          data-ui-press
          className={ICON_BUTTON}
          aria-label="Página siguiente"
          disabled={isLoading || meta.current_page === totalPages}
          onClick={() => goTo(meta.current_page + 1)}
        >
          <ChevronRightIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />
        </button>
      </nav>
    </div>
  );
}
