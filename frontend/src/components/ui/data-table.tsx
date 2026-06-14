import { type ReactNode } from 'react';
import { EmptyState, LoadingState } from './states';
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
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
};

export function DataTable<T>({
  columns,
  emptyDescription = 'No hay datos para mostrar.',
  emptyTitle = 'Sin datos',
  getRowKey,
  loading = false,
  loadingLabel = 'Cargando...',
  rows,
}: {
  columns: Array<DataTableColumn<T>>;
  emptyDescription?: string;
  emptyTitle?: string;
  getRowKey: (row: T) => string | number;
  loading?: boolean;
  loadingLabel?: string;
  rows: T[];
}) {
  if (loading) {
    return <LoadingState label={loadingLabel} />;
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.key}>{column.header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={getRowKey(row)}>
            {columns.map((column) => (
              <TableCell key={column.key}>{column.render(row)}</TableCell>
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
