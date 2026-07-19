import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataTable, type InstitutionalColumn } from './DataTable';

type Row = { id: number; patient: string };
const columns: Array<InstitutionalColumn<Row>> = [{ accessorKey: 'patient', header: 'Paciente' }];

describe('DataTable', () => {
  it('renders semantic rows and sorts with TanStack Table', () => {
    render(<DataTable ariaLabel="Facturas" columns={columns} data={[{ id: 1, patient: 'Zoila' }, { id: 2, patient: 'Ana' }]} getRowId={(row) => String(row.id)} />);
    const table = screen.getByRole('table', { name: 'Facturas' });
    fireEvent.click(within(table).getByRole('button', { name: /paciente/i }));
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Ana');
  });

  it('supports keyboard row activation and empty state', () => {
    const onRowClick = vi.fn();
    const { rerender } = render(<DataTable ariaLabel="Facturas" columns={columns} data={[{ id: 1, patient: 'Ana' }]} onRowClick={onRowClick} />);
    fireEvent.keyDown(screen.getAllByRole('row')[1], { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ patient: 'Ana' }));
    rerender(<DataTable ariaLabel="Facturas" columns={columns} data={[]} />);
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
  });
});
