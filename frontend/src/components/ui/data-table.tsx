import { type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  type ColumnDef,
  type Table as TanStackTable,
  useReactTable,
} from '@tanstack/react-table';
import { Columns3 } from 'lucide-react';
import { ErrorState, EmptyState, LoadingState } from './states';
import { Button } from './button';
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
    headerClassName?: string;
    numeric?: boolean;
  }
}

export type DataTableColumn<T> = {
  cellClassName?: string;
  header: ReactNode;
  headerClassName?: string;
  key: string;
  numeric?: boolean;
  render: (row: T) => ReactNode;
};

type DataTableCommonProps<T> = {
  caption?: ReactNode;
  containerLabel?: string;
  emptyAction?: ReactNode;
  emptyDescription?: string;
  emptyTitle?: string;
  error?: boolean;
  errorDescription?: string;
  errorTitle?: string;
  getRowClassName?: (row: T) => string | undefined;
  loading?: boolean;
  loadingLabel?: string;
  onRetry?: () => void;
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
    emptyAction,
    emptyDescription = 'No hay datos para mostrar.',
    emptyTitle = 'Sin datos',
    error,
    errorDescription,
    errorTitle = 'No se pudo cargar',
    getRowClassName,
    loading = false,
    loadingLabel = 'Cargando...',
    containerLabel = 'Tabla de datos',
    onRetry,
    tableClassName,
  } = props;
  const isLegacy = isLegacyProps(props);
  const data = isLegacy ? props.rows : props.data;
  const columns = isLegacy ? toColumnDefs(props.columns) : props.columns;
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: isLegacy ? (row) => String(props.getRowKey(row)) : props.getRowId,
  });

  if (loading) {
    return <LoadingState label={loadingLabel} />;
  }

  if (error) {
    return <ErrorState title={errorTitle} description={errorDescription} onRetry={onRetry} />;
  }

  if (data.length === 0) {
    return <DataTableEmpty title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <Table containerLabel={containerLabel} className={tableClassName}>
      {caption ? <TableCaption>{caption}</TableCaption> : null}
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                data-numeric={header.column.columnDef.meta?.numeric ? 'true' : undefined}
                className={header.column.columnDef.meta?.headerClassName}
              >
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
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
  );
}

function isLegacyProps<T>(props: DataTableProps<T>): props is DataTableLegacyProps<T> {
  return 'rows' in props;
}

function toColumnDefs<T>(columns: Array<DataTableColumn<T>>): Array<ColumnDef<T, unknown>> {
  return columns.map((column) => ({
    id: column.key,
    header: () => column.header,
    cell: ({ row }) => column.render(row.original),
    meta: {
      cellClassName: column.cellClassName,
      headerClassName: column.headerClassName,
      numeric: column.numeric,
    },
  }));
}

export function DataTableEmpty({
  action,
  description = 'No hay datos para mostrar.',
  title = 'Sin datos',
}: {
  action?: ReactNode;
  description?: string;
  title?: string;
}) {
  return <EmptyState title={title} description={description} action={action} />;
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
  const rowCount = table.getRowModel().rows.length;

  return (
    <div data-slot="data-table-pagination" className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <span aria-live="polite">
        {rowCount} fila{rowCount === 1 ? '' : 's'}
      </span>
      <Button type="button" variant="secondary" size="sm" disabled>
        <Columns3 data-icon aria-hidden="true" />
        Vista completa
      </Button>
    </div>
  );
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
