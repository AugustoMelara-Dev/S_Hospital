import { type ReactNode } from 'react';
import { ErrorState, EmptyState, LoadingState } from './states';
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

export type DataTableColumn<T> = {
  cellClassName?: string;
  header: ReactNode;
  headerClassName?: string;
  key: string;
  numeric?: boolean;
  render: (row: T) => ReactNode;
};

export function DataTable<T>({
  caption,
  columns,
  emptyDescription = 'No hay datos para mostrar.',
  emptyTitle = 'Sin datos',
  error,
  errorDescription,
  errorTitle = 'No se pudo cargar',
  getRowKey,
  loading = false,
  loadingLabel = 'Cargando...',
  rows,
  tableClassName,
}: {
  caption?: ReactNode;
  columns: Array<DataTableColumn<T>>;
  emptyDescription?: string;
  emptyTitle?: string;
  error?: boolean;
  errorDescription?: string;
  errorTitle?: string;
  getRowKey: (row: T) => string | number;
  loading?: boolean;
  loadingLabel?: string;
  rows: T[];
  tableClassName?: string;
}) {
  if (loading) {
    return <LoadingState label={loadingLabel} />;
  }

  if (error) {
    return <ErrorState title={errorTitle} description={errorDescription} />;
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <Table className={tableClassName}>
      {caption ? <TableCaption>{caption}</TableCaption> : null}
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.key} data-numeric={column.numeric ? 'true' : undefined} className={column.headerClassName}>
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={getRowKey(row)}>
            {columns.map((column) => (
              <TableCell key={column.key} data-numeric={column.numeric ? 'true' : undefined} className={column.cellClassName}>
                {column.render(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
