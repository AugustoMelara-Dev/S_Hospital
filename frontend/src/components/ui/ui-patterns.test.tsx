import { fireEvent, render, screen, within } from '@testing-library/react';
import { FileText } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { ActionBar } from './action-bar';
import { Button } from './button';
import { DataTable, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './data-table';
import { DateRangePicker } from './date-range-picker';
import { FilterBar } from './filter-bar';
import { FieldGroup, FormSection } from './form-section';
import { FormField } from './form-field';
import { Input } from './input';
import { MetricCard } from './metric-card';
import { MoneyText } from './money-text';
import { PageHeader } from './page-header';
import { PaginationControls } from './pagination';
import { EmptyState, ErrorState, LoadingState, Skeleton } from './states';
import { StatusBadge } from './status-badge';

describe('shared UI patterns', () => {
  it('PageHeader renders a semantic title and keeps actions', () => {
    render(
      <PageHeader
        title="Reportes"
        description="Resumen operativo"
        headingLevel={2}
        actions={<Button>Exportar</Button>}
        secondary={<div>Filtros activos</div>}
        className="custom-header"
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Reportes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeInTheDocument();
    expect(screen.getByText('Filtros activos')).toBeInTheDocument();
    expect(screen.getByText('Reportes').closest('[data-slot="page-header"]')).toHaveClass('custom-header');
  });

  it('ActionBar accepts primary and secondary action groups', () => {
    render(
      <ActionBar
        secondary={<Button variant="outline">Cancelar</Button>}
        primary={<Button>Guardar</Button>}
        fullWidthOnMobile
      />,
    );

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' }).closest('[data-slot="action-bar-primary"]')).toBeInTheDocument();
  });

  it('FilterBar keeps controlled values and callbacks under consumer control', () => {
    const onSearch = vi.fn((event) => event.preventDefault());
    const onClear = vi.fn();

    render(
      <FilterBar onSearch={onSearch} onClear={onClear} hasActiveFilters>
        <label htmlFor="patient-filter">Paciente</label>
        <Input id="patient-filter" value="Maria" onChange={() => undefined} />
      </FilterBar>,
    );

    expect(screen.getByLabelText('Paciente')).toHaveValue('Maria');
    fireEvent.click(screen.getByRole('button', { name: /buscar/i }));
    fireEvent.click(screen.getByRole('button', { name: /limpiar/i }));

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Paciente')).toHaveValue('Maria');
  });

  it('FilterBar advanced content is opt-in and exposes expansion semantics', () => {
    render(
      <FilterBar
        onSearch={(event) => event.preventDefault()}
        onClear={() => undefined}
        advanced={<Input aria-label="Codigo interno" />}
        collapsibleAdvanced
      >
        <Input aria-label="Paciente" />
      </FilterBar>,
    );

    const trigger = screen.getByRole('button', { name: /filtros avanzados/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Codigo interno')).toBeInTheDocument();
  });

  it('FormField connects error through aria-describedby', () => {
    render(
      <FormField id="service-name" label="Servicio" hint="Nombre visible" error="Campo requerido" required>
        {({ describedBy, id, invalid }) => (
          <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} />
        )}
      </FormField>,
    );

    const input = screen.getByLabelText('Servicio');
    expect(input).toHaveAttribute('aria-describedby', 'service-name-hint service-name-error');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Campo requerido');
  });

  it('FormSection and FieldGroup accept arbitrary content and className', () => {
    render(
      <FormSection title="Datos fiscales" description="Configuracion local" className="custom-section">
        <FieldGroup columns={3}>
          <Input aria-label="CAI" />
          <Input aria-label="Rango" />
        </FieldGroup>
      </FormSection>,
    );

    expect(screen.getByText('Datos fiscales').closest('[data-slot="form-section"]')).toHaveClass('custom-section');
    expect(screen.getByLabelText('CAI')).toBeInTheDocument();
    expect(screen.getByLabelText('Rango')).toBeInTheDocument();
  });

  it('DataTable uses semantic table markup and numeric columns', () => {
    render(
      <DataTable
        rows={[{ id: 1, total: 'L 10.00' }]}
        getRowKey={(row) => row.id}
        caption="Facturas recientes"
        columns={[
          { key: 'total', header: 'Total', numeric: true, render: (row) => row.total },
        ]}
      />,
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Facturas recientes')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Total' })).toHaveAttribute('data-numeric', 'true');
    expect(screen.getByRole('cell', { name: 'L 10.00' })).toHaveAttribute('data-numeric', 'true');
  });

  it('DataTable renders loading, empty and error states', () => {
    const { rerender } = render(
      <DataTable rows={[]} getRowKey={() => 1} columns={[]} loading loadingLabel="Cargando tabla..." />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Cargando tabla...');

    rerender(<DataTable rows={[]} getRowKey={() => 1} columns={[]} emptyTitle="Sin facturas" />);
    expect(screen.getByText('Sin facturas')).toBeInTheDocument();

    rerender(<DataTable rows={[]} getRowKey={() => 1} columns={[]} error errorDescription="Servidor local no disponible" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Servidor local no disponible');
  });

  it('Table remains keyboard reachable and className-friendly', () => {
    render(
      <Table className="custom-table" containerClassName="custom-region">
        <TableHeader>
          <TableRow>
            <TableHead>Factura</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>001</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const region = screen.getByRole('region', { name: 'Tabla de datos' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toHaveClass('custom-region');
    expect(within(region).getByRole('table')).toHaveClass('custom-table');
  });

  it('Pagination marks the current page and disables boundaries', () => {
    const onPageChange = vi.fn();

    render(
      <PaginationControls
        meta={{ current_page: 1, per_page: 10, total: 30 }}
        onPageChange={onPageChange}
      />,
    );

    expect(screen.getByRole('button', { name: /anterior/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ir a la pagina 1' })).toHaveAttribute('aria-current', 'page');

    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('DateRangePicker preserves string values and callbacks', () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();

    render(
      <DateRangePicker
        idPrefix="issued"
        startDate="2026-06-01"
        endDate="2026-06-20"
        onStartDateChange={onStart}
        onEndDateChange={onEnd}
        showShortcuts={false}
      />,
    );

    expect(screen.getByLabelText('Desde')).toHaveValue('2026-06-01');
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-06-21' } });
    expect(onEnd).toHaveBeenCalledWith('2026-06-21');
  });

  it('MetricCard communicates trend with text and icon, not color alone', () => {
    render(
      <MetricCard
        icon={<FileText />}
        label="Facturas"
        value="12"
        helper="Emitidas hoy"
        trend={{ label: 'Subio 2 respecto a ayer', tone: 'positive' }}
      />,
    );

    expect(screen.getByText('Subio 2 respecto a ayer')).toBeInTheDocument();
    expect(screen.getByText('12')).toHaveClass('tabular-nums');
  });

  it('MoneyText preserves Lempira formatting and supports emphasis', () => {
    render(<MoneyText amountCents={250050} emphasis="strong" ariaLabel="Total L 2,500.50" />);

    const amount = screen.getByText('L 2,500.50');
    expect(amount).toHaveClass('tabular-nums', 'font-semibold');
    expect(amount).toHaveAttribute('aria-label', 'Total L 2,500.50');
  });

  it('StatusBadge has a safe fallback for unknown states', () => {
    render(<StatusBadge status="archived" className="custom-status" />);

    expect(screen.getByText('Estado desconocido')).toHaveClass('custom-status');
  });

  it('UI states keep accessible roles and optional retry behavior', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<LoadingState label="Cargando servicios..." className="custom-loading" />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando servicios...');
    expect(screen.getByRole('status')).toHaveClass('custom-loading');

    rerender(<EmptyState title="Sin servicios" action={<Button>Crear</Button>} />);
    expect(screen.getByText('Sin servicios')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear' })).toBeInTheDocument();

    rerender(<ErrorState message="No se pudo consultar" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo consultar');
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(<Skeleton data-testid="skeleton" aria-hidden={false} />);
    expect(screen.getByTestId('skeleton')).toHaveAttribute('aria-hidden', 'false');
  });
});
