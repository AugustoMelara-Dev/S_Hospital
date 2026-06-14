import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataTable, Table, TableHead, TableHeader, TableRow } from './data-table';

describe('DataTable', () => {
  it('renders column headers with table header scope', () => {
    render(
      <DataTable
        rows={[{ id: 1, patient: 'María López' }]}
        getRowKey={(row) => row.id}
        columns={[
          { key: 'patient', header: 'Paciente', render: (row) => row.patient },
        ]}
      />,
    );

    expect(screen.getByRole('columnheader', { name: 'Paciente' })).toHaveAttribute('scope', 'col');
    expect(screen.getByRole('cell', { name: 'María López' })).toBeInTheDocument();
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
