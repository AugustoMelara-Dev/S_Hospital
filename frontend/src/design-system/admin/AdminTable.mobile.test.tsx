import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { AdminEmpty, AdminTable, MoneyText, type AdminColumn } from './components';

/**
 * Modo tarjeta móvil de `AdminTable` (T-FE-16).
 *
 * `useMediaQuery` se mockea para forzar el corte `< md` / `md+` sin depender de
 * `matchMedia` de jsdom. Todo es sintético y desechable.
 */
const mediaState = vi.hoisted(() => ({ isMobile: false }));
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => mediaState.isMobile }));

type Row = { id: number; document: string; patient: string; total: number; internal: string };

const rows: Row[] = [
  { id: 1, document: 'A-0001', patient: 'Maria Lopez', total: 25000, internal: 'INT-1' },
  { id: 2, document: 'A-0002', patient: 'Carlos Rivera', total: 18000, internal: 'INT-2' },
];

const columns: AdminColumn<Row>[] = [
  { key: 'document', header: 'Documento', mobilePrimary: true, cell: (row) => row.document },
  { key: 'patient', header: 'Paciente', cell: (row) => row.patient },
  {
    key: 'total',
    header: 'Total',
    align: 'right',
    mobilePrimary: true,
    cell: (row) => <MoneyText cents={row.total} />,
  },
  { key: 'internal', header: 'Código interno', mobileHidden: true, cell: (row) => row.internal },
];

function renderTable(props: Partial<Parameters<typeof AdminTable<Row>>[0]> = {}) {
  return render(
    <AdminTable<Row>
      caption="Operaciones"
      columns={columns}
      rows={rows}
      getRowKey={(row) => String(row.id)}
      {...props}
    />,
  );
}

describe('AdminTable — modo tarjeta móvil (< md)', () => {
  beforeEach(() => {
    mediaState.isMobile = true;
  });

  it('renderiza una tarjeta por fila con pares etiqueta/valor y sin tabla', () => {
    renderTable();

    expect(screen.queryByRole('table')).toBeNull();
    const list = screen.getByRole('list', { name: /operaciones/i });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('A-0001');
    expect(items[0]).toHaveTextContent('Maria Lopez');
    expect(items[0]).toHaveTextContent('L. 250.00');
    for (const label of ['Documento', 'Paciente', 'Total']) {
      expect(items[0]).toHaveTextContent(label);
    }
    expect(items[1]).toHaveTextContent('A-0002');
  });

  it('omite las columnas mobileHidden de la tarjeta', () => {
    renderTable();

    expect(screen.queryByText('Código interno')).toBeNull();
    expect(screen.queryByText('INT-1')).toBeNull();
    expect(screen.queryByText('INT-2')).toBeNull();
  });

  it('comparte el mismo vacío que la tabla', () => {
    renderTable({ rows: [], empty: <AdminEmpty title="Sin operaciones" /> });

    expect(screen.getByText('Sin operaciones')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('activa la tarjeta con Enter y Espacio cuando la tabla declara onRowClick', () => {
    const onRowClick = vi.fn();
    renderTable({ onRowClick, rowAriaLabel: (row) => `Abrir ${row.document}` });

    const card = screen.getByRole('button', { name: /abrir a-0001/i });
    expect(card).toHaveAttribute('tabindex', '0');

    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);

    fireEvent.keyDown(card, { key: ' ' });
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });

  it('no presenta violaciones axe (definition-list) en las tarjetas', async () => {
    const { container } = renderTable({
      onRowClick: () => {},
      rowAriaLabel: (row) => `Abrir ${row.document}`,
    });

    expect(await axe(container)).toHaveNoViolations();
  });

  it('mobileCards={false} conserva la tabla aun en móvil', () => {
    renderTable({ mobileCards: false });

    expect(screen.getByRole('table', { name: /operaciones/i })).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });
});

describe('AdminTable — md+ conserva la tabla actual', () => {
  beforeEach(() => {
    mediaState.isMobile = false;
  });

  it('renderiza la tabla con encabezados y celdas', () => {
    renderTable();

    expect(screen.getByRole('table', { name: /operaciones/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /documento/i })).toBeInTheDocument();
    expect(screen.getByText('Maria Lopez')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });
});
