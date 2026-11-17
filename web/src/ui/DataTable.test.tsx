import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable, type Column } from './DataTable';
import { Money } from './Money';
import { StatusStamp } from './Badge';

type Row = { id: number; number: string; total: number; status: 'issued' | 'paid' };

const columns: Column<Row>[] = [
  { key: 'number', header: 'Documento', cell: (r) => r.number },
  { key: 'total', header: 'Total', numeric: true, cell: (r) => <Money cents={r.total} /> },
  { key: 'status', header: 'Estado', cell: (r) => <StatusStamp status={{ status: r.status, settlement: r.status === 'paid' ? 'paid' : 'pending' }} /> },
];

describe('DataTable', () => {
  it('renders rows, statuses and money', () => {
    render(
      <DataTable
        caption="Recibos"
        columns={columns}
        rowKey={(r) => r.id}
        rows={[
          { id: 1, number: '000-001-01-00000001', total: 123400, status: 'paid' },
          { id: 2, number: '000-001-01-00000002', total: 5000, status: 'issued' },
        ]}
      />,
    );
    const table = screen.getByRole('table', { name: 'Recibos' });
    expect(within(table).getByText('L 1,234.00')).toBeInTheDocument();
    expect(within(table).getByText('Pagada')).toBeInTheDocument();
    expect(within(table).getByText('Pendiente de cobro')).toBeInTheDocument();
  });

  it('shows the empty state and paginates', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const { rerender } = render(<DataTable caption="Recibos" columns={columns} rowKey={(r) => r.id} rows={[]} />);
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();

    rerender(
      <DataTable
        caption="Recibos"
        columns={columns}
        rowKey={(r) => r.id}
        rows={[{ id: 1, number: 'A', total: 100, status: 'paid' }]}
        pagination={{ page: 1, perPage: 25, total: 60, onPageChange }}
      />,
    );
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('activates rows with the keyboard', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataTable
        caption="Recibos"
        columns={columns}
        rowKey={(r) => r.id}
        rows={[{ id: 7, number: 'A', total: 100, status: 'paid' as const }]}
        onRowClick={onRowClick}
      />,
    );
    await user.tab();
    await user.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
  });
});
