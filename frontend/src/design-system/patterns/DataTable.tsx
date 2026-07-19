import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export type InstitutionalColumn<TData> = ColumnDef<TData>;

type DataTableProps<TData> = {
  ariaLabel: string;
  caption?: string;
  columns: Array<ColumnDef<TData>>;
  data: TData[];
  emptyTitle?: string;
  emptyDescription?: string;
  getRowId?: (row: TData) => string;
  loading?: boolean;
  onRowClick?: (row: TData) => void;
  renderMobileRow?: (row: TData) => ReactNode;
};

export function DataTable<TData>({ ariaLabel, caption, columns, data, emptyTitle = 'Sin resultados', emptyDescription = 'No hay registros para los filtros seleccionados.', getRowId, loading = false, onRowClick, renderMobileRow }: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({ data, columns, getRowId, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), onSortingChange: setSorting, state: { sorting } });

  if (loading) return <div role="status" aria-label={`Cargando ${ariaLabel}`} className="grid gap-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>;
  if (data.length === 0) return <div role="status" className="rounded-lg border border-dashed border-border px-4 py-10 text-center"><p className="font-semibold">{emptyTitle}</p><p className="mt-1 text-sm text-muted-foreground">{emptyDescription}</p></div>;

  return <div className="min-w-0" role="region" aria-label={ariaLabel}>
    {renderMobileRow ? <div className="grid gap-2 md:hidden">{table.getRowModel().rows.map((row) => <div key={row.id}>{renderMobileRow(row.original)}</div>)}</div> : null}
    <div className={renderMobileRow ? 'hidden overflow-x-auto rounded-lg border border-border md:block' : 'overflow-x-auto rounded-lg border border-border'}>
      <Table aria-label={ariaLabel}>
        {caption ? <TableCaption>{caption}</TableCaption> : null}
        <TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id} data-numeric={columnIsNumeric(header.column.columnDef.meta) ? 'true' : undefined}>{header.isPlaceholder ? null : header.column.getCanSort() ? <Button type="button" variant="ghost" className="-ml-2" onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}<SortIcon direction={header.column.getIsSorted()} /></Button> : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader>
        <TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.id} data-row-id={row.id} tabIndex={onRowClick ? 0 : undefined} className={onRowClick ? 'cursor-pointer' : undefined} onClick={() => onRowClick?.(row.original)} onKeyDown={(event) => { if (onRowClick && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onRowClick(row.original); } }}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id} data-numeric={columnIsNumeric(cell.column.columnDef.meta) ? 'true' : undefined}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>)}</TableBody>
      </Table>
    </div>
  </div>;
}

function columnIsNumeric(meta: unknown) {
  return Boolean(meta && typeof meta === 'object' && 'numeric' in meta && meta.numeric === true);
}

function SortIcon({ direction }: { direction: false | 'asc' | 'desc' }) {
  if (direction === 'asc') return <ArrowUpIcon aria-label="Orden ascendente" />;
  if (direction === 'desc') return <ArrowDownIcon aria-label="Orden descendente" />;
  return <ArrowUpDownIcon aria-hidden="true" />;
}
