import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ColumnDef } from '@tanstack/react-table';
import { describe, expect, it } from 'vitest';
import { DataTable, Table, TableHead, TableHeader, TableRow } from './data-table';

describe('DataTable', () => {
  it('renders column headers with table header scope', () => {
    render(
      <DataTable
        rows={[{ id: 1, patient: 'Maria Lopez' }]}
        getRowKey={(row) => row.id}
        columns={[
          { key: 'patient', header: 'Paciente', render: (row) => row.patient },
        ]}
      />,
    );

    expect(screen.getByRole('columnheader', { name: 'Paciente' })).toHaveAttribute('scope', 'col');
    expect(screen.queryByRole('button', { name: /ordenar/i })).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Maria Lopez' })).toBeInTheDocument();
  });

  it('renders TanStack column definitions with metadata', () => {
    type Row = { amount: string; id: string; patient: string };
    const columns: Array<ColumnDef<Row, unknown>> = [
      {
        accessorKey: 'patient',
        header: 'Paciente',
      },
      {
        accessorKey: 'amount',
        header: 'Total',
        cell: ({ row }) => `L. ${row.original.amount}`,
        meta: {
          numeric: true,
          cellClassName: 'font-semibold',
        },
      },
    ];

    render(
      <DataTable
        data={[{ id: '1', patient: 'Maria Lopez', amount: '125.00' }]}
        getRowId={(row) => row.id}
        columns={columns}
        getRowClassName={() => 'bg-muted/20'}
      />,
    );

    expect(screen.getByRole('columnheader', { name: 'Total' })).toHaveAttribute('data-numeric', 'true');
    expect(screen.getByRole('cell', { name: 'L. 125.00' })).toHaveClass('font-semibold');
    expect(screen.getByRole('row', { name: /Maria Lopez/ })).toHaveClass('bg-muted/20');
  });

  it('shows shared empty, loading, and error states', () => {
    const columns: Array<ColumnDef<{ id: string }, unknown>> = [{ accessorKey: 'id', header: 'ID' }];
    const { rerender } = render(
      <DataTable data={[]} getRowId={(row) => row.id} columns={columns} loading loadingLabel="Cargando tabla..." />,
    );

    expect(screen.getByText('Cargando tabla...')).toBeInTheDocument();

    rerender(<DataTable data={[]} getRowId={(row) => row.id} columns={columns} emptyTitle="Sin facturas" />);
    expect(screen.getByText('Sin facturas')).toBeInTheDocument();

    rerender(<DataTable data={[]} getRowId={(row) => row.id} columns={columns} error errorDescription="Servidor local no disponible" />);
    expect(screen.getByText('Servidor local no disponible')).toBeInTheDocument();
  });

  it('sorts rows only when sorting is enabled', () => {
    render(
      <DataTable
        sortable
        rows={[
          { id: 1, patient: 'Zulema Rivera' },
          { id: 2, patient: 'Ana Garcia' },
        ]}
        getRowKey={(row) => row.id}
        columns={[
          {
            key: 'patient',
            header: 'Paciente',
            render: (row) => row.patient,
            sortValue: (row) => row.patient,
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ordenar columna patient' }));
    expect(screen.getByRole('columnheader', { name: /Paciente/ })).toHaveAttribute('aria-sort', 'ascending');
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Ana Garcia');
    expect(rows[1]).toHaveTextContent('Zulema Rivera');
  });

  it('paginates rows with active next and previous controls', () => {
    render(
      <DataTable
        showPagination
        initialPageSize={1}
        rows={[
          { id: 1, patient: 'Ana Garcia' },
          { id: 2, patient: 'Zulema Rivera' },
        ]}
        getRowKey={(row) => row.id}
        columns={[
          { key: 'patient', header: 'Paciente', render: (row) => row.patient },
        ]}
      />,
    );

    expect(screen.getByText('2 filas - pagina 1 de 2')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Ana Garcia' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Zulema Rivera' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    expect(screen.getByText('2 filas - pagina 2 de 2')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Zulema Rivera' })).toBeInTheDocument();
  });

  it('toggles optional column visibility while preserving locked columns', async () => {
    render(
      <DataTable
        showColumnVisibility
        rows={[{ id: 1, patient: 'Ana Garcia', total: '125.00' }]}
        getRowKey={(row) => row.id}
        columns={[
          { key: 'patient', header: 'Paciente', render: (row) => row.patient, hideable: false },
          { key: 'total', header: 'Total', numeric: true, render: (row) => row.total },
        ]}
      />,
    );

    const trigger = screen.getByRole('button', { name: /columnas/i });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.queryByRole('menuitem', { name: /Paciente/i })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('menuitem', { name: /Total/i }));
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('columnheader', { name: 'Total' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Paciente' })).toBeInTheDocument();
  });

  it('makes horizontally scrollable tables reachable by keyboard', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Factura</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );

    const tableRegion = screen.getByRole('region', { name: 'Tabla de datos' });
    expect(tableRegion).toHaveClass('table-wrap');
    expect(tableRegion).toHaveAttribute('tabindex', '0');
    expect(within(tableRegion).getByRole('table')).toBeInTheDocument();
  });

  it('allows overriding header scope when a table needs row headers', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="row">Resumen</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );

    expect(within(screen.getByRole('table')).getByText('Resumen')).toHaveAttribute('scope', 'row');
  });
});
