import { Button } from './button';
import { type PaginatedMeta } from '../../lib/api';

type PaginationControlsProps = {
  loading?: boolean;
  meta: PaginatedMeta;
  onPageChange: (page: number) => void;
};

export function PaginationControls({ loading = false, meta, onPageChange }: PaginationControlsProps) {
  const lastPage = Math.max(1, Math.ceil(meta.total / meta.per_page));

  return (
    <div className="pagination-row" aria-label="Paginación">
      <Button
        type="button"
        variant="secondary"
        disabled={loading || meta.current_page <= 1}
        onClick={() => onPageChange(meta.current_page - 1)}
      >
        Anterior
      </Button>
      <span className="muted">
        Pagina {meta.current_page} de {lastPage}
      </span>
      <Button
        type="button"
        variant="secondary"
        disabled={loading || meta.current_page >= lastPage}
        onClick={() => onPageChange(meta.current_page + 1)}
      >
        Siguiente
      </Button>
    </div>
  );
}
