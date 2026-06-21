import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Button } from './button';
import { type PaginatedMeta } from '../../lib/api';
import { cn } from '../../lib/utils';

type PaginationControlsProps = {
  className?: string;
  loading?: boolean;
  meta: PaginatedMeta;
  onPageChange: (page: number) => void;
};

export function PaginationControls({ className, loading = false, meta, onPageChange }: PaginationControlsProps) {
  const lastPage = Math.max(1, Math.ceil(meta.total / meta.per_page));
  const currentPage = Math.min(Math.max(1, meta.current_page), lastPage);
  const pages = getPaginationItems(currentPage, lastPage);

  return (
    <nav data-slot="pagination" className={cn('pagination-row flex flex-wrap items-center gap-2', className)} aria-label="Paginacion">
      <Button
        type="button"
        variant="secondary"
        disabled={loading || currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="Ir a la pagina anterior"
      >
        <ChevronLeft data-icon aria-hidden="true" />
        Anterior
      </Button>

      <ol className="flex flex-wrap items-center gap-1">
        {pages.map((page, index) => (
          <li key={`${page}-${index}`}>
            {page === 'ellipsis' ? (
              <span className="flex size-9 items-center justify-center text-muted-foreground" aria-hidden="true">
                <MoreHorizontal data-icon />
              </span>
            ) : (
              <Button
                type="button"
                variant={page === currentPage ? 'default' : 'ghost'}
                size="icon"
                disabled={loading}
                aria-label={`Ir a la pagina ${page}`}
                aria-current={page === currentPage ? 'page' : undefined}
                onClick={() => onPageChange(page)}
              >
                {page}
              </Button>
            )}
          </li>
        ))}
      </ol>

      <span className="muted text-sm text-muted-foreground" aria-live="polite">
        Pagina {currentPage} de {lastPage}
      </span>

      <Button
        type="button"
        variant="secondary"
        disabled={loading || currentPage >= lastPage}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="Ir a la pagina siguiente"
      >
        Siguiente
        <ChevronRight data-icon aria-hidden="true" />
      </Button>
    </nav>
  );
}

function getPaginationItems(currentPage: number, lastPage: number): Array<number | 'ellipsis'> {
  if (lastPage <= 7) {
    return Array.from({ length: lastPage }, (_, index) => index + 1);
  }

  const pages = new Set([1, lastPage, currentPage, currentPage - 1, currentPage + 1]);
  const sorted = Array.from(pages)
    .filter((page) => page >= 1 && page <= lastPage)
    .sort((left, right) => left - right);

  return sorted.flatMap((page, index) => {
    const previous = sorted[index - 1];
    if (previous && page - previous > 1) {
      return ['ellipsis' as const, page];
    }
    return [page];
  });
}
