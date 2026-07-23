import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Service } from '@/lib/api';

const mediaState = vi.hoisted(() => ({ isMobile: false }));
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => mediaState.isMobile }));

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

  it('renders prioritized operational columns without internal scanner codes', () => {
    render(<ServiceCatalogTable {...baseProps()} services={[serviceFixture({ scan_code: 'LAB-1', barcode: '123', qr_code: 'QR-1' })]} />);
    ['Servicio', 'Categoría', 'Área', 'Precio', 'Estado', 'Acciones'].forEach((name) => expect(screen.getByRole('columnheader', { name })).toBeInTheDocument());
    expect(screen.queryByText(/LAB-1|123|QR-1/i)).not.toBeInTheDocument();
  });

  it('does not expose long internal codes in the operational table', () => {
    const longCode = 'CODIGO-OPERATIVO-EXCEPCIONALMENTE-LARGO-SIN-ESPACIOS-123456789';
    render(<ServiceCatalogTable {...baseProps()} services={[serviceFixture({ scan_code: longCode })]} />);

    expect(screen.queryByText(new RegExp(longCode))).not.toBeInTheDocument();
  });

  it('uses a mobile list that distinguishes same-name services by category and area without codes', () => {
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
    expect(items[0]).toHaveTextContent(/Consulta.*Laboratorio/i);
    expect(items[1]).toHaveTextContent(/Consulta.*Emergencia.*Urgencias/i);
    expect(mobileList).not.toHaveTextContent(/CON-EXT|CON-EME/);
  });

  it('renders billing summaries and HNL prices through column renderers', () => {
    render(<ServiceCatalogTable {...baseProps()} services={[serviceFixture({ name: 'Eritropoyetina', price: '25.00', special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION' })]} />);
    expect(screen.getByText('Eritropoyetina')).toBeInTheDocument();
    expect(screen.getByText('L 25.00')).toBeInTheDocument();
    expect(screen.getAllByText(/receta/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /acciones de servicio eritropoyetina/i })).toBeInTheDocument();
  });
});

function baseProps() { return { areas: [], canManage: true, categories: [], hasActiveFilters: false, isEmpty: false, isLoading: false, loadError: '', onClearFilters: vi.fn(), onRetry: vi.fn(), onRowActions: { canManage: true, onEdit: vi.fn(), onToggleActive: vi.fn() }, services: [serviceFixture()] }; }
function serviceFixture(overrides: Partial<Service> = {}): Service { return { id: 1, category_id: 1, area_id: 1, name: 'Glucosa', aliases: null, slug: 'glucosa', scan_code: null, barcode: null, qr_code: null, price: '15.00', taxable: true, active: true, visible_in_billing: true, is_billable: true, special_rule_code: null, category: { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 }, area: { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true }, ...overrides }; }
