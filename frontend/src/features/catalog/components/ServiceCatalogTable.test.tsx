import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Service } from '@/lib/api';
import type { InstitutionalColumn } from '@/design-system/ag-grid';

const mediaState = vi.hoisted(() => ({ isMobile: false }));
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => mediaState.isMobile }));

vi.mock('@/design-system/ag-grid', () => ({
  InstitutionalDataGrid: ({ ariaLabel, rows, columns, state, errorMessage, emptyMessage, actions }: { ariaLabel: string; rows: Service[]; columns: InstitutionalColumn<Service>[]; state: string; errorMessage?: string; emptyMessage?: string; actions?: React.ReactNode }) => {
    if (state !== 'ready') return <section aria-label={ariaLabel}><div role={state === 'error' ? 'alert' : 'status'}>{state === 'loading' ? 'Cargando servicios del catálogo...' : state === 'error' ? errorMessage : emptyMessage}</div>{actions}</section>;
    return <section aria-label={ariaLabel}><table><thead><tr>{columns.map((column) => <th key={column.colId ?? String(column.field)}>{column.headerName}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}>{columns.map((column) => { const value = column.field ? row[column.field as keyof Service] : undefined; const params = { data: row, value }; const renderer = column.cellRenderer as ((input: typeof params) => React.ReactNode) | undefined; const formatter = column.valueFormatter as ((input: typeof params) => string) | undefined; const getter = column.valueGetter as ((input: { data: Service }) => unknown) | undefined; return <td key={column.colId ?? String(column.field)}>{renderer ? renderer(params) : formatter ? formatter(params) : String(getter ? getter({ data: row }) : value ?? '')}</td>; })}</tr>)}</tbody></table>{actions}</section>;
  },
}));
import { ServiceCatalogTable } from './ServiceCatalogTable';

describe('ServiceCatalogTable', () => {
  beforeEach(() => { mediaState.isMobile = false; });
  it('renders institutional loading, empty and error actions', () => {
    const clear = vi.fn(); const retry = vi.fn();
    const { rerender } = render(<ServiceCatalogTable {...baseProps()} isLoading />);
    expect(screen.getByRole('status')).toHaveTextContent(/cargando servicios/i);
    rerender(<ServiceCatalogTable {...baseProps()} isEmpty hasActiveFilters onClearFilters={clear} />);
    fireEvent.click(screen.getByRole('button', { name: /limpiar filtros/i }));
    rerender(<ServiceCatalogTable {...baseProps()} loadError="Servidor no disponible" onRetry={retry} />);
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(clear).toHaveBeenCalledOnce(); expect(retry).toHaveBeenCalledOnce();
  });

  it('renders prioritized operational columns and a visible distinguishing code', () => {
    render(<ServiceCatalogTable {...baseProps()} scannerEnabled services={[serviceFixture({ scan_code: 'LAB-1', barcode: '123', qr_code: 'QR-1' })]} />);
    ['Servicio', 'Categoría', 'Área', 'Precio', 'Estado', 'Acciones'].forEach((name) => expect(screen.getByRole('columnheader', { name })).toBeInTheDocument());
    expect(screen.getAllByText(/código LAB-1/i).length).toBeGreaterThan(0);
  });

  it('uses a mobile list that distinguishes same-name services by category, area and code', () => {
    mediaState.isMobile = true;
    render(<ServiceCatalogTable {...baseProps()} services={[
      serviceFixture({ id: 1, name: 'Consulta', scan_code: 'CON-EXT' }),
      serviceFixture({
        id: 2,
        name: 'Consulta',
        scan_code: 'CON-EME',
        category: { id: 2, name: 'Emergencia', slug: 'emergencia', active: true, sort_order: 2 },
        area: { id: 2, name: 'Urgencias', slug: 'urgencias', active: true },
      }),
    ]} />);

    const mobileList = screen.getByRole('list', { name: /servicios del catálogo en móvil/i });
    const items = within(mobileList).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(/Consulta.*Laboratorio.*Código CON-EXT/i);
    expect(items[1]).toHaveTextContent(/Consulta.*Emergencia.*Urgencias.*Código CON-EME/i);
  });

  it('renders billing summaries and HNL prices through column renderers', () => {
    render(<ServiceCatalogTable {...baseProps()} services={[serviceFixture({ name: 'Eritropoyetina', price: '25.00', special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION' })]} />);
    expect(screen.getByText('Eritropoyetina')).toBeInTheDocument();
    expect(screen.getByText('L 25.00')).toBeInTheDocument();
    expect(screen.getAllByText(/receta/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /acciones de servicio eritropoyetina/i })).toBeInTheDocument();
  });
});

function baseProps() { return { areas: [], canManage: true, categories: [], hasActiveFilters: false, isEmpty: false, isLoading: false, loadError: '', onClearFilters: vi.fn(), onRetry: vi.fn(), onRowActions: { canManage: true, onEdit: vi.fn(), onToggleActive: vi.fn() }, scannerEnabled: false, services: [serviceFixture()] }; }
function serviceFixture(overrides: Partial<Service> = {}): Service { return { id: 1, category_id: 1, area_id: 1, name: 'Glucosa', aliases: null, slug: 'glucosa', scan_code: null, barcode: null, qr_code: null, price: '15.00', taxable: true, active: true, visible_in_billing: true, is_billable: true, special_rule_code: null, category: { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 }, area: { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true }, ...overrides }; }
