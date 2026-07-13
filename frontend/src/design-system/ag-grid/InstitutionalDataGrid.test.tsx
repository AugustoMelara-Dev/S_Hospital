import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InstitutionalDataGrid, createInstitutionalGridOptions } from './InstitutionalDataGrid';

vi.mock('ag-grid-react', () => ({
  AgGridProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="ag-provider">{children}</div>,
  AgGridReact: (props: Record<string, unknown>) => <div data-testid="ag-grid" data-props={JSON.stringify({
    columns: (props.columnDefs as Array<{ colId?: string; field?: string }>).map((column) => column.colId ?? column.field),
    pagination: props.pagination,
    rowSelection: props.rowSelection,
  })} />,
}));

type Row = { id: string; patient: string; total: number };

const columns = [
  { field: 'patient' as const, headerName: 'Paciente', priority: 'primary' as const },
  { field: 'total' as const, headerName: 'Total', priority: 'secondary' as const },
];

describe('InstitutionalDataGrid', () => {
  it('creates keyboard-friendly sortable, filterable and paginated defaults', () => {
    const options = createInstitutionalGridOptions<Row>({ mode: 'dark', density: 'compact' });

    expect(options.pagination).toBe(true);
    expect(options.defaultColDef).toMatchObject({ sortable: true, filter: true, resizable: true });
    expect(options.rowSelection).toMatchObject({ mode: 'multiRow', enableClickSelection: true });
    expect(options.suppressColumnVirtualisation).toBe(true);
    expect(options.theme).toBeDefined();
    expect(options.localeText?.page).toBe('Página');
    expect(options.rowHeight).toBeLessThan(40);
  });

  it('renders the modern provider and typed grid contract', () => {
    render(<InstitutionalDataGrid<Row> ariaLabel="Facturas" columns={columns} rows={[{ id: '1', patient: 'Ana', total: 2500 }]} getRowId={(row) => row.id} />);

    expect(screen.getByRole('region', { name: 'Facturas' })).toBeInTheDocument();
    expect(screen.getByTestId('ag-provider')).toBeInTheDocument();
    expect(screen.getByTestId('ag-grid')).toHaveAttribute('data-props', expect.stringContaining('multiRow'));
  });

  it('keeps column visibility in the adapter contract passed to AG Grid', () => {
    render(
      <InstitutionalDataGrid<Row>
        ariaLabel="Facturas"
        columns={columns}
        rows={[{ id: '1', patient: 'Ana', total: 2500 }]}
        getRowId={(row) => row.id}
        columnVisibility={{ visibleColumnIds: ['patient'] }}
      />,
    );

    expect(screen.getByTestId('ag-grid')).toHaveAttribute('data-props', expect.stringContaining('"columns":["patient"]'));
  });

  it.each(['loading', 'empty', 'error'] as const)('exposes an accessible %s state', (state) => {
    render(<InstitutionalDataGrid<Row> ariaLabel="Facturas" columns={columns} rows={[]} getRowId={(row) => row.id} state={state} errorMessage="Servidor no disponible" />);
    expect(screen.getByRole(state === 'error' ? 'alert' : 'status')).toBeInTheDocument();
  });
});
