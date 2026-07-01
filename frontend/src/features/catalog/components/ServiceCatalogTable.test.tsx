import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Service } from '@/lib/api';
import { ServiceCatalogTable } from './ServiceCatalogTable';

describe('ServiceCatalogTable', () => {
  it('uses the shared DataTable loading state instead of a bespoke skeleton table', () => {
    render(<ServiceCatalogTable {...baseProps()} isLoading />);

    expect(screen.getByRole('status')).toHaveTextContent(/cargando servicios/i);
    expect(screen.queryByRole('region', { name: /listado de servicios/i })).not.toBeInTheDocument();
  });

  it('keeps retry and clear-filter actions in the shared table states', () => {
    const onRetry = vi.fn();
    const onClearFilters = vi.fn();
    const { rerender } = render(
      <ServiceCatalogTable
        {...baseProps()}
        isEmpty
        hasActiveFilters
        onClearFilters={onClearFilters}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /limpiar filtros/i }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);

    rerender(
      <ServiceCatalogTable
        {...baseProps()}
        loadError="El servidor LAN no pudo completar la operacion."
        onRetry={onRetry}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('uses the compact Phase 8 catalog table columns', () => {
    render(<ServiceCatalogTable {...baseProps()} />);

    expect(screen.getByRole('columnheader', { name: /^Servicio$/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /categor/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /rea/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^Precio$/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^Estado$/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^Acciones$/ })).toBeInTheDocument();
  });
});

function baseProps() {
  return {
    areas: [],
    canManage: true,
    categories: [],
    hasActiveFilters: false,
    isEmpty: false,
    isLoading: false,
    loadError: '',
    onClearFilters: vi.fn(),
    onRetry: vi.fn(),
    onRowActions: {
      canManage: true,
      onEdit: vi.fn(),
      onToggleActive: vi.fn(),
    },
    scannerEnabled: false,
    services: [serviceFixture()],
  };
}

function serviceFixture(overrides: Partial<Service> = {}): Service {
  return {
    id: 1,
    category_id: 1,
    area_id: 1,
    name: 'Glucosa',
    aliases: null,
    slug: 'glucosa',
    scan_code: null,
    barcode: null,
    qr_code: null,
    price: '15.00',
    taxable: true,
    active: true,
    visible_in_billing: true,
    is_billable: true,
    special_rule_code: null,
    category: { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 },
    area: { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true },
    ...overrides,
  };
}
