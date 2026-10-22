import { fireEvent, render, screen, within } from '@testing-library/react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { describe, expect, it, vi } from 'vitest';
import {
  FreeMedicationBadge,
  AdminCallout,
  AdminDialog,
  AdminEmpty,
  AdminField,
  AdminStep,
  AdminTable,
  AdminTabs,
  MoneyText,
  QuantityText,
  StatusStamp,
  type AdminColumn,
} from './components';

describe('admin components', () => {
  it('mantiene visible un envío pendiente y permite cerrar al terminar', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <AdminDialog open closeDisabled onOpenChange={onOpenChange} title="Confirmar operación" description="Revise el resultado.">
        Guardando…
      </AdminDialog>,
    );
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onOpenChange).not.toHaveBeenCalled();
    rerender(
      <AdminDialog open onOpenChange={onOpenChange} title="Confirmar operación" description="Revise el resultado.">
        Operación guardada
      </AdminDialog>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('MoneyText formatea centavos y nunca convierte un dato ausente en L 0.00', () => {
    render(<MoneyText cents={123450} />);
    expect(screen.getByText('L. 1,234.50')).toBeInTheDocument();

    render(<MoneyText cents={null} />);
    expect(screen.getAllByText('No disponible').length).toBeGreaterThan(0);
  });

  it('QuantityText formatea centésimas de unidad y usa guion cuando falta', () => {
    render(<QuantityText units={250} />);
    expect(screen.getByText('2.50')).toBeInTheDocument();

    render(<QuantityText units={null} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('StatusStamp etiqueta el estado de gratuidad como emisión sin cobro', () => {
    render(<StatusStamp status="gratuito" />);
    expect(screen.getByText('Emitida sin cobro')).toBeInTheDocument();
  });

  it('FreeMedicationBadge aclara que la gratuidad es solo del medicamento', () => {
    render(<FreeMedicationBadge />);
    expect(screen.getByText(/solo el medicamento/i)).toBeInTheDocument();
  });

  it('AdminField asocia el label con el control', () => {
    render(
      <AdminField label="Nombre del paciente" htmlFor="paciente" required>
        <input id="paciente" />
      </AdminField>,
    );

    expect(screen.getByLabelText(/nombre del paciente/i)).toBeInTheDocument();
  });

  it('AdminCallout expone el tono de error como alerta', () => {
    render(
      <AdminCallout tone="error" title="No se pudo cobrar">
        Intente nuevamente.
      </AdminCallout>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo cobrar/i);
  });

  it('AdminTable renderiza filas, celdas y un vacío explícito', () => {
    type Row = { id: number; name: string; total: number };
    const columns: AdminColumn<Row>[] = [
      { key: 'name', header: 'Paciente', cell: (row) => row.name },
      { key: 'total', header: 'Total', align: 'right', cell: (row) => <MoneyText cents={row.total} /> },
    ];

    render(
      <AdminTable
        caption="Operaciones recientes"
        columns={columns}
        rows={[{ id: 1, name: 'Ana López', total: 2500 }]}
        getRowKey={(row) => String(row.id)}
      />,
    );

    expect(screen.getByRole('table', { name: /operaciones recientes/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /paciente/i })).toBeInTheDocument();
    expect(screen.getByText('Ana López')).toBeInTheDocument();
    expect(screen.getByText('L. 25.00')).toBeInTheDocument();
  });

  it('AdminTable muestra el estado vacío cuando no hay filas', () => {
    render(
      <AdminTable
        columns={[{ key: 'name', header: 'Paciente', cell: () => null }]}
        rows={[]}
        getRowKey={() => 'x'}
        empty={<AdminEmpty title="Sin operaciones" />}
      />,
    );

    expect(screen.getByText('Sin operaciones')).toBeInTheDocument();
  });

  it('AdminTable sin empty usa un vacío contextual, nunca "Sin registros."', () => {
    render(
      <AdminTable
        caption="Pacientes internados"
        columns={[{ key: 'name', header: 'Paciente', cell: () => null }]}
        rows={[]}
        getRowKey={() => 'x'}
      />,
    );

    expect(screen.getByText('Sin pacientes internados')).toBeInTheDocument();
    expect(screen.queryByText(/sin registros/i)).toBeNull();
    expect(screen.getByText(/ajuste la búsqueda o los filtros/i)).toBeInTheDocument();
  });

  it('AdminTable hace enfocable el contenedor desplazable y lo nombra con el caption', () => {
    render(
      <AdminTable
        caption="Operaciones recientes"
        columns={[{ key: 'name', header: 'Paciente', cell: () => null }]}
        rows={[]}
        getRowKey={() => 'x'}
      />,
    );

    const scrollGroup = screen.getByRole('group', { name: /operaciones recientes/i });
    expect(scrollGroup).toHaveAttribute('tabindex', '0');
    // La semántica de tabla y su nombre siguen intactos.
    expect(screen.getByRole('table', { name: /operaciones recientes/i })).toBeInTheDocument();
  });

  it('AdminTable sin caption no declara un grupo sin nombre', () => {
    render(
      <AdminTable
        columns={[{ key: 'name', header: 'Paciente', cell: () => null }]}
        rows={[]}
        getRowKey={() => 'x'}
      />,
    );

    expect(screen.queryByRole('group')).toBeNull();
  });

  it('AdminTabs expone tablist con nombre, selección y roving tabIndex sin aria-controls colgante', () => {
    render(
      <AdminTabs
        ariaLabel="Vistas de caja"
        items={[
          { id: 'uno', label: 'Uno' },
          { id: 'dos', label: 'Dos' },
          { id: 'tres', label: 'Tres' },
        ]}
        value="dos"
        onValueChange={() => {}}
      />,
    );

    const tablist = screen.getByRole('tablist', { name: /vistas de caja/i });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('tabindex', '0');
    expect(tabs[0]).toHaveAttribute('tabindex', '-1');
    expect(tabs[2]).toHaveAttribute('tabindex', '-1');
    // Sin panel no debe quedar ningún aria-controls apuntando a un id inexistente.
    for (const tab of tabs) expect(tab).not.toHaveAttribute('aria-controls');
  });

  it('AdminTabs navega con flechas, Home y End', () => {
    const onValueChange = vi.fn();
    render(
      <AdminTabs
        ariaLabel="Vistas de caja"
        items={[
          { id: 'uno', label: 'Uno' },
          { id: 'dos', label: 'Dos' },
          { id: 'tres', label: 'Tres' },
        ]}
        value="uno"
        onValueChange={onValueChange}
      />,
    );

    const [uno, , tres] = screen.getAllByRole('tab');
    fireEvent.keyDown(uno, { key: 'ArrowRight' });
    expect(onValueChange).toHaveBeenLastCalledWith('dos');
    fireEvent.keyDown(uno, { key: 'ArrowLeft' });
    expect(onValueChange).toHaveBeenLastCalledWith('tres');
    fireEvent.keyDown(uno, { key: 'End' });
    expect(onValueChange).toHaveBeenLastCalledWith('tres');
    fireEvent.keyDown(tres, { key: 'Home' });
    expect(onValueChange).toHaveBeenLastCalledWith('uno');
  });

  it('AdminTabs activa en mousedown y con Enter/Espacio sin duplicar el clic de ratón', () => {
    const onValueChange = vi.fn();
    render(
      <AdminTabs
        ariaLabel="Vistas de caja"
        items={[
          { id: 'uno', label: 'Uno' },
          { id: 'dos', label: 'Dos' },
        ]}
        value="uno"
        onValueChange={onValueChange}
      />,
    );

    const [, dos] = screen.getAllByRole('tab');

    // Paridad con Radix `Tabs.Trigger`: activación al presionar.
    fireEvent.mouseDown(dos);
    expect(onValueChange).toHaveBeenLastCalledWith('dos');

    // Clic sintético (teclado/lector): detail 0 activa.
    onValueChange.mockClear();
    fireEvent.click(dos, { detail: 0 });
    expect(onValueChange).toHaveBeenLastCalledWith('dos');

    // Clic de ratón real (detail 1): no duplica lo ya resuelto en mousedown.
    onValueChange.mockClear();
    fireEvent.mouseDown(dos);
    fireEvent.click(dos, { detail: 1 });
    expect(onValueChange).toHaveBeenCalledTimes(1);

    onValueChange.mockClear();
    fireEvent.keyDown(dos, { key: 'Enter' });
    fireEvent.keyDown(dos, { key: ' ' });
    expect(onValueChange).toHaveBeenCalledTimes(2);
  });

  it('AdminTabs conserva el cableado de Radix cuando el consumidor aporta Tabs.Content', () => {
    render(
      <AdminTabs
        ariaLabel="Secciones"
        items={[
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ]}
        value="a"
        onValueChange={() => {}}
      >
        <TabsPrimitive.Content value="a">Panel A</TabsPrimitive.Content>
        <TabsPrimitive.Content value="b">Panel B</TabsPrimitive.Content>
      </AdminTabs>,
    );

    const tabA = screen.getByRole('tab', { name: 'A' });
    const controls = tabA.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    // El id referenciado existe realmente (axe `aria-valid-attr-value`).
    expect(document.getElementById(controls as string)).not.toBeNull();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel A');
  });

  it('AdminTabs envuelve children no-Radix en un tabpanel etiquetado por la pestaña activa', () => {
    render(
      <AdminTabs
        ariaLabel="Secciones"
        items={[
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ]}
        value="a"
        onValueChange={() => {}}
      >
        <p>Contenido propio</p>
      </AdminTabs>,
    );

    const tabA = screen.getByRole('tab', { name: 'A' });
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', tabA.id);
    expect(tabA).toHaveAttribute('aria-controls', panel.id);
    expect(document.getElementById(tabA.getAttribute('aria-controls') as string)).toBe(panel);
  });

  it('AdminEmpty acepta una acción (CTA) contextual', () => {
    render(
      <AdminEmpty
        title="Sin movimientos de caja"
        description="Registre una entrada o salida para verla aquí."
        action={<button type="button">Registrar movimiento</button>}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(/sin movimientos de caja/i);
    expect(screen.getByRole('button', { name: /registrar movimiento/i })).toBeInTheDocument();
  });

  it('AdminStep marca el paso actual con aria-current', () => {
    render(
      <AdminStep
        ariaLabel="Cuenta, revisión y resultado"
        current={1}
        steps={[
          { id: 'cuenta', label: 'Cuenta' },
          { id: 'revision', label: 'Revisión' },
          { id: 'resultado', label: 'Resultado' },
        ]}
      />,
    );

    expect(screen.getByText('Revisión').closest('li')).toHaveAttribute('aria-current', 'step');
  });
});

describe('AdminTable: ordenación accesible opcional', () => {
  type Row = { id: number; name: string; total: number };

  const rows: Row[] = [
    { id: 1, name: 'Beatriz', total: 300 },
    { id: 2, name: 'ana', total: 100 },
    { id: 3, name: 'Carlos', total: 200 },
  ];

  const columns: AdminColumn<Row>[] = [
    { key: 'name', header: 'Paciente', sortable: true, sortValue: (row) => row.name, cell: (row) => row.name },
    { key: 'total', header: 'Total', align: 'right', sortable: true, sortValue: (row) => row.total, cell: (row) => row.total },
    { key: 'plain', header: 'Nota', cell: () => '—' },
  ];

  function renderedNames() {
    return screen
      .getAllByRole('cell')
      .filter((cell) => ['Beatriz', 'ana', 'Carlos'].includes(cell.textContent ?? ''))
      .map((cell) => cell.textContent);
  }

  it('expone aria-sort solo en columnas ordenables y alterna asc → desc → sin orden', () => {
    render(
      <AdminTable caption="Pacientes" columns={columns} rows={rows} getRowKey={(row) => String(row.id)} />,
    );

    const nameHeader = screen.getByRole('columnheader', { name: /paciente/i });
    const noteHeader = screen.getByRole('columnheader', { name: /nota/i });
    expect(nameHeader).toHaveAttribute('aria-sort', 'none');
    expect(noteHeader).not.toHaveAttribute('aria-sort');

    const sortButton = within(nameHeader).getByRole('button', { name: /paciente/i });

    fireEvent.click(sortButton);
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(renderedNames()).toEqual(['ana', 'Beatriz', 'Carlos']);

    fireEvent.click(sortButton);
    expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
    expect(renderedNames()).toEqual(['Carlos', 'Beatriz', 'ana']);

    fireEvent.click(sortButton);
    expect(nameHeader).toHaveAttribute('aria-sort', 'none');
    expect(renderedNames()).toEqual(['Beatriz', 'ana', 'Carlos']);
  });

  it('ordena números como números y no reordena cuando el consumidor controla el estado', () => {
    const onSortChange = vi.fn();
    const { rerender } = render(
      <AdminTable
        caption="Pacientes"
        columns={columns}
        rows={rows}
        getRowKey={(row) => String(row.id)}
        sort={null}
        onSortChange={onSortChange}
      />,
    );

    const totalHeader = screen.getByRole('columnheader', { name: /total/i });
    fireEvent.click(within(totalHeader).getByRole('button', { name: /total/i }));

    // Controlado: la tabla notifica, pero respeta el orden del consumidor.
    expect(onSortChange).toHaveBeenCalledWith({ key: 'total', direction: 'asc' });
    expect(renderedNames()).toEqual(['Beatriz', 'ana', 'Carlos']);

    rerender(
      <AdminTable
        caption="Pacientes"
        columns={columns}
        rows={[...rows].sort((a, b) => a.total - b.total)}
        getRowKey={(row) => String(row.id)}
        sort={{ key: 'total', direction: 'asc' }}
        onSortChange={onSortChange}
      />,
    );
    expect(totalHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(renderedNames()).toEqual(['ana', 'Carlos', 'Beatriz']);
  });

  it('sin onSortChange en modo controlado, el encabezado deja de ser un control', () => {
    render(
      <AdminTable
        caption="Pacientes"
        columns={columns}
        rows={rows}
        getRowKey={(row) => String(row.id)}
        sort={null}
      />,
    );

    const nameHeader = screen.getByRole('columnheader', { name: /paciente/i });
    expect(nameHeader).not.toHaveAttribute('aria-sort');
    expect(within(nameHeader).queryByRole('button')).toBeNull();
  });
});
