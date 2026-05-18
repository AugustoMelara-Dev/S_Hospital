import { type HTMLAttributes, type ReactNode, type TdHTMLAttributes, type ThHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
import { EmptyState, LoadingState } from './states';

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
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Table({ children, className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="table-wrap">
      <table className={cn('data-table', className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />;
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TableRow(props: HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props} />;
}

export function TableHead(props: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th {...props} />;
}

export function TableCell(props: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...props} />;
}
