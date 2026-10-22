import { type MouseEvent } from 'react';
import type { PaginatedMeta } from '../../../lib/api';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from './adminOverlayUi';

/**
 * Paginación del historial de Recibos con los controles de la identidad
 * "Panel administrativo": borde hairline (`--ui-line`), superficie (`--ui-surface`),
 * página activa en cobalto (`--ui-action`) y foco `--ui-focus`. Conserva el
 * comportamiento (avance/retroceso con guardas de límite) y la accesibilidad
 * (`aria-current`, `aria-disabled`, `tabIndex` fuera del orden cuando no aplica).
 */
export function InvoicePagination({ disabled, meta, onChange }: { disabled: boolean; meta: PaginatedMeta; onChange: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.per_page));
  const pages = Array.from(new Set([1, meta.current_page - 1, meta.current_page, meta.current_page + 1, totalPages]))
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((first, second) => first - second);
  const goTo = (event: MouseEvent<HTMLAnchorElement>, page: number) => {
    event.preventDefault();
    if (!disabled && page !== meta.current_page && page >= 1 && page <= totalPages) onChange(page);
  };

  const controlClass = (isActive: boolean, isDisabled: boolean) =>
    cn(
      'inline-flex h-[var(--ui-control-h)] min-w-[var(--ui-control-h)] items-center justify-center rounded-[var(--ui-radius-control)] border px-2 text-[length:var(--ui-text-sm)] font-medium tabular-nums',
      'transition-[background-color,border-color,color] duration-[var(--ui-duration-state)] ease-[var(--ui-ease-out)]',
      isActive
        ? 'border-[var(--ui-action)] bg-[var(--ui-action)] font-semibold text-[color:var(--ui-action-foreground)]'
        : 'border-[var(--ui-line)] bg-[var(--ui-surface)] text-[color:var(--ui-ink)] hover:bg-[var(--ui-surface-alt)]',
      isDisabled && 'pointer-events-none opacity-40',
      FOCUS_RING,
    );

  const previousDisabled = disabled || meta.current_page === 1;
  const nextDisabled = disabled || meta.current_page === totalPages;

  return (
    <nav aria-label="Paginación de facturas">
      <ul className="flex flex-wrap items-center gap-1">
        <li>
          <a
            href="#"
            className={controlClass(false, previousDisabled)}
            aria-label="Página anterior"
            aria-disabled={previousDisabled || undefined}
            tabIndex={previousDisabled ? -1 : undefined}
            onClick={(event) => goTo(event, meta.current_page - 1)}
          >
            Anterior
          </a>
        </li>
        {pages.map((page) => {
          const isActive = page === meta.current_page;

          return (
            <li key={page}>
              <a
                href="#"
                className={controlClass(isActive, disabled)}
                aria-label={`Página ${page}`}
                aria-current={isActive ? 'page' : undefined}
                aria-disabled={disabled || undefined}
                tabIndex={disabled ? -1 : undefined}
                onClick={(event) => goTo(event, page)}
              >
                {page}
              </a>
            </li>
          );
        })}
        <li>
          <a
            href="#"
            className={controlClass(false, nextDisabled)}
            aria-label="Página siguiente"
            aria-disabled={nextDisabled || undefined}
            tabIndex={nextDisabled ? -1 : undefined}
            onClick={(event) => goTo(event, meta.current_page + 1)}
          >
            Siguiente
          </a>
        </li>
      </ul>
    </nav>
  );
}
