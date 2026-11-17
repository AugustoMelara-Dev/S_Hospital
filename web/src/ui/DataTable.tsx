import type { KeyboardEvent, ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Inbox } from 'lucide-react';
import { cn } from '@/lib/cn';
import { EmptyState } from './EmptyState';
import { IconButton } from './IconButton';
import { Skeleton } from './Skeleton';

export type SortDir = 'asc' | 'desc';
export type SortState = { key: string; dir: SortDir };

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  align?: 'left' | 'right' | 'center';
  /** CSS width (e.g. "120px", "30%"). */
  width?: string;
  sortable?: boolean;
  /** Mono tabular figures (amounts, numbers, document ids). */
  numeric?: boolean;
  className?: string;
};

export type Pagination = {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (page: number) => void;
};

export type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string | number;
  /** Accessible table name (rendered as sr-only caption). */
  caption: string;
  loading?: boolean;
  /** Custom empty state; defaults to "Sin resultados". */
  empty?: ReactNode;
  pagination?: Pagination;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  /** Right-most actions cell per row. */
  rowActions?: (row: T) => ReactNode;
  /** Makes rows clickable and Enter-activatable. */
  onRowClick?: (row: T) => void;
  /** Highlight a row (e.g. selected). */
  isRowSelected?: (row: T) => boolean;
  density?: 'compact' | 'normal';
  className?: string;
  skeletonRows?: number;
};

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  loading,
  empty,
  pagination,
  sort,
  onSortChange,
  rowActions,
  onRowClick,
  isRowSelected,
  density = 'normal',
  className,
  skeletonRows = 6,
}: DataTableProps<T>) {
  const cellPad = density === 'compact' ? 'px-3 py-1.5' : 'px-3 py-2.5';
  const colCount = columns.length + (rowActions ? 1 : 0);
  const showSkeleton = loading && (!rows || rows.length === 0);

  function toggleSort(key: string) {
    if (!onSortChange) return;
    const dir: SortDir = sort?.key === key && sort.dir === 'asc' ? 'desc' : 'asc';
    onSortChange({ key, dir });
  }

  function rowKeyDown(e: KeyboardEvent<HTMLTableRowElement>, row: T) {
    if (!onRowClick || e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRowClick(row);
    }
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px]" aria-busy={loading || undefined}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-line bg-surface-2/60">
              {columns.map((c) => {
                const sorted = sort?.key === c.key ? sort.dir : undefined;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    style={c.width ? { width: c.width } : undefined}
                    aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                    className={cn(
                      'h-9 px-3 text-[12px] font-medium tracking-[0.02em] whitespace-nowrap text-ink-2',
                      ALIGN[c.align ?? (c.numeric ? 'right' : 'left')],
                    )}
                  >
                    {c.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-[4px] hover:text-ink',
                          (c.align ?? (c.numeric ? 'right' : 'left')) === 'right' && 'flex-row-reverse',
                        )}
                      >
                        {c.header}
                        {sorted === 'asc' ? (
                          <ArrowUp className="size-3" aria-hidden="true" />
                        ) : sorted === 'desc' ? (
                          <ArrowDown className="size-3" aria-hidden="true" />
                        ) : (
                          <ChevronsUpDown className="size-3 opacity-50" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
              {rowActions && (
                <th scope="col" className="w-px px-3 text-right text-[12px] font-medium text-ink-2">
                  <span className="sr-only">Acciones</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {showSkeleton &&
              Array.from({ length: skeletonRows }, (_, i) => (
                <tr key={`sk-${i}`} className="border-b border-line last:border-0">
                  {Array.from({ length: colCount }, (__, j) => (
                    <td key={j} className={cellPad}>
                      <Skeleton className={cn('h-3.5', j === 0 ? 'w-24' : 'w-full max-w-[160px]')} />
                    </td>
                  ))}
                </tr>
              ))}
            {!showSkeleton && rows && rows.length === 0 && (
              <tr>
                <td colSpan={colCount}>
                  {empty ?? (
                    <EmptyState
                      compact
                      icon={<Inbox />}
                      title="Sin resultados"
                      description="No hay registros que coincidan con los filtros."
                    />
                  )}
                </td>
              </tr>
            )}
            {!showSkeleton &&
              rows?.map((row, i) => (
                <tr
                  key={rowKey(row)}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (e) => rowKeyDown(e, row) : undefined}
                  aria-selected={isRowSelected ? isRowSelected(row) : undefined}
                  className={cn(
                    'border-b border-line transition-colors duration-[100ms] last:border-0',
                    onRowClick && 'cursor-pointer hover:bg-surface-2/70 focus-visible:bg-surface-2 focus-visible:outline-offset-[-2px]',
                    isRowSelected?.(row) && 'bg-brand-soft/50',
                    loading && 'opacity-60',
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        cellPad,
                        'align-middle',
                        ALIGN[c.align ?? (c.numeric ? 'right' : 'left')],
                        c.numeric && 'num',
                        c.className,
                      )}
                    >
                      {c.cell(row, i)}
                    </td>
                  ))}
                  {rowActions && (
                    <td className={cn(cellPad, 'text-right whitespace-nowrap')} onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">{rowActions(row)}</div>
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {pagination && <PaginationBar {...pagination} />}
    </div>
  );
}

export function PaginationBar({ page, perPage, total, onPageChange }: Pagination) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);
  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-3 border-t border-line px-3 py-2 text-[12.5px] text-ink-2">
      <span className="tabular">
        {from}–{to} de {total}
      </span>
      <div className="flex items-center gap-1">
        <IconButton
          label="Página anterior"
          icon={<ChevronLeft />}
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        />
        <span className="tabular px-1.5">
          Página {page} de {pages}
        </span>
        <IconButton
          label="Página siguiente"
          icon={<ChevronRight />}
          size="sm"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        />
      </div>
    </nav>
  );
}
