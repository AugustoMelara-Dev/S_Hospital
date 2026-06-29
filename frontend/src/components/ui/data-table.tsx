import { useMemo, useState, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type SortingState,
  type Table as TanStackTable,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronLeft, ChevronRight, Columns3, Search } from 'lucide-react';
import { ErrorState, EmptyState, LoadingState } from './states';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Input } from './input';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from './table';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    cellClassName?: string;
    headerLabel?: string;
    headerClassName?: string;
    numeric?: boolean;
  }
}

export type DataTableColumn<T> = {
  cellClassName?: string;
  header: ReactNode;
  headerClassName?: string;
  hideable?: boolean;
  key: string;
  numeric?: boolean;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => number | string;
};

type DataTableCommonProps<T> = {
  caption?: ReactNode;
  containerLabel?: string;
  emptyDescription?: string;
  emptyTitle?: string;
  error?: boolean;
  errorDescription?: string;
  errorTitle?: string;
  filterPlaceholder?: string;
  getRowClassName?: (row: T) => string | undefined;
  initialPageSize?: number;
  loading?: boolean;
  loadingLabel?: string;
  searchable?: boolean;
  showColumnVisibility?: boolean;
  showPagination?: boolean;
  sortable?: boolean;
  tableClassName?: string;
};

type DataTableModernProps<T> = DataTableCommonProps<T> & {
  columns: Array<ColumnDef<T, unknown>>;
  data: T[];
  getRowId?: (row: T, index: number) => string;
  getRowKey?: never;
  rows?: never;
};

type DataTableLegacyProps<T> = DataTableCommonProps<T> & {
  columns: Array<DataTableColumn<T>>;
  data?: never;
  getRowId?: never;
  getRowKey: (row: T) => string | number;
  rows: T[];
};

export type DataTableProps<T> = DataTableModernProps<T> | DataTableLegacyProps<T>;

export function DataTable<T>(props: DataTableProps<T>) {
  const {
    caption,
    emptyDescription = 'No hay datos para mostrar.',
    emptyTitle = 'Sin datos',
    error,
    errorDescription,
    errorTitle = 'No se pudo cargar',
    filterPlaceholder = 'Filtrar tabla...',
    getRowClassName,
    initialPageSize = 10,
    loading = false,
    loadingLabel = 'Cargando...',
    searchable = false,
    showColumnVisibility = false,
    showPagination = false,
    sortable = false,
    containerLabel = 'Tabla de datos',
    tableClassName,
  } = props;
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: initialPageSize });
  const isLegacy = isLegacyProps(props);
  const data = isLegacy ? props.rows : props.data;
  const columns = useMemo(() => (isLegacy ? toColumnDefs(props.columns) : props.columns), [isLegacy, props.columns]);
  const table = useReactTable({
    data,
    columns,
    state: {
      columnFilters,
      columnVisibility,
      pagination,
      sorting,
    },
    enableHiding: true,
    enableSorting: sortable,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: isLegacy ? (row) => String(props.getRowKey(row)) : props.getRowId,
  });
  const firstFilterableColumn = table.getAllLeafColumns().find((column) => column.getCanFilter());
  const visibleRows = showPagination ? table.getPaginationRowModel().rows : table.getRowModel().rows;

  if (loading) {
    return <LoadingState label={loadingLabel} />;
  }

  if (error) {
    return <ErrorState title={errorTitle} description={errorDescription} />;
  }

  if (data.length === 0) {
    return <DataTableEmpty title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div data-slot="data-table-shell" className="min-w-0">
      {(searchable || showColumnVisibility) ? (
        <DataTableToolbar actions={showColumnVisibility ? <DataTableColumnVisibility table={table} /> : null}>
          {searchable && firstFilterableColumn ? (
            <label className="relative block max-w-sm">
              <span className="sr-only">{filterPlaceholder}</span>
              <Search data-icon aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={(firstFilterableColumn.getFilterValue() as string | undefined) ?? ''}
                onChange={(event) => firstFilterableColumn.setFilterValue(event.target.value)}
                placeholder={filterPlaceholder}
                className="pl-9"
              />
            </label>
          ) : null}
        </DataTableToolbar>
      ) : null}
      <Table containerLabel={containerLabel} className={tableClassName}>
        {caption ? <TableCaption>{caption}</TableCaption> : null}
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  aria-sort={toAriaSort(header.column.getIsSorted())}
                  data-numeric={header.column.columnDef.meta?.numeric ? 'true' : undefined}
                  className={header.column.columnDef.meta?.headerClassName}
                >
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <button
                      type="button"
                      className="inline-flex min-h-8 items-center gap-1 rounded-sm text-left font-semibold hover:text-hospital-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      onClick={header.column.getToggleSortingHandler()}
                      aria-label={`Ordenar columna ${header.column.id}`}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <SortIcon direction={header.column.getIsSorted()} />
                    </button>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {visibleRows.map((row) => (
            <TableRow key={row.id} className={getRowClassName?.(row.original)}>
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  data-numeric={cell.column.columnDef.meta?.numeric ? 'true' : undefined}
                  className={cell.column.columnDef.meta?.cellClassName}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {showPagination ? <DataTablePagination table={table} /> : null}
    </div>
  );
}

function isLegacyProps<T>(props: DataTableProps<T>): props is DataTableLegacyProps<T> {
  return 'rows' in props;
}

function toColumnDefs<T>(columns: Array<DataTableColumn<T>>): Array<ColumnDef<T, unknown>> {
  return columns.map((column) => ({
    id: column.key,
    accessorFn: column.sortValue ?? ((row) => String(column.render(row) ?? '')),
    enableHiding: column.hideable ?? true,
    filterFn: 'includesString',
    header: () => column.header,
    cell: ({ row }) => column.render(row.original),
    meta: {
      cellClassName: column.cellClassName,
      headerLabel: typeof column.header === 'string' ? column.header : column.key,
      headerClassName: column.headerClassName,
      numeric: column.numeric,
    },
  }));
}

export function DataTableEmpty({
  description = 'No hay datos para mostrar.',
  title = 'Sin datos',
}: {
  description?: string;
  title?: string;
}) {
  return <EmptyState title={title} description={description} />;
}

export function DataTableToolbar({
  actions,
  children,
}: {
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div data-slot="data-table-toolbar" className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">{children}</div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function DataTablePagination<T>({
  table,
}: {
  table: TanStackTable<T>;
}) {
  const rowCount = table.getFilteredRowModel().rows.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();

  return (
    <div data-slot="data-table-pagination" className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <span aria-live="polite">
        {rowCount} fila{rowCount === 1 ? '' : 's'} - pagina {pageIndex + 1} de {Math.max(pageCount, 1)}
      </span>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          <ChevronLeft data-icon aria-hidden="true" />
          Anterior
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          Siguiente
          <ChevronRight data-icon aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function DataTableColumnVisibility<T>({ table }: { table: TanStackTable<T> }) {
  const hideableColumns = table.getAllLeafColumns().filter((column) => column.getCanHide());

  if (hideableColumns.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="secondary" size="sm">
          <Columns3 data-icon aria-hidden="true" />
          Columnas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {hideableColumns.map((column) => (
          <DropdownMenuItem
            key={column.id}
            onSelect={(event) => {
              event.preventDefault();
              column.toggleVisibility(!column.getIsVisible());
            }}
          >
            <span className="flex size-4 items-center justify-center">
              {column.getIsVisible() ? <Check data-icon aria-hidden="true" className="size-3" /> : null}
            </span>
            {column.columnDef.meta?.headerLabel ?? readableColumnLabel(column.columnDef.header, column.id)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SortIcon({ direction }: { direction: false | 'asc' | 'desc' }) {
  if (direction === 'asc') return <ArrowUp data-icon aria-hidden="true" className="size-3.5" />;
  if (direction === 'desc') return <ArrowDown data-icon aria-hidden="true" className="size-3.5" />;
  return <ArrowUpDown data-icon aria-hidden="true" className="size-3.5 opacity-55" />;
}

function toAriaSort(direction: false | 'asc' | 'desc') {
  if (direction === 'asc') return 'ascending' as const;
  if (direction === 'desc') return 'descending' as const;
  return 'none' as const;
}

function readableColumnLabel(header: unknown, fallback: string) {
  return typeof header === 'string' ? header : fallback;
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
};
