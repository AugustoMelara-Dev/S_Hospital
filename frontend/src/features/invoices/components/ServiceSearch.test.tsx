import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ServiceSearch } from './ServiceSearch';
import type { Area, Service } from '../../../lib/api';

describe('ServiceSearch', () => {
  it('renders malformed billing service prices as safe financial values', () => {
    render(
      <ServiceSearch
        areas={areasFixture}
        categories={[]}
        services={[serviceFixture({ price: 'NaN' })]}
        selectedAreaId="all"
        selectedCategoryId="all"
        onAreaChange={vi.fn()}
        onCategoryChange={vi.fn()}
        search="glu"
        onSearchChange={vi.fn()}
        scanCode=""
        onScanCodeChange={vi.fn()}
        onAddService={vi.fn()}
        onAddByScanCode={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /agregar glucosa por l\. 0\.00/i })).toBeInTheDocument();
    expect(document.body.textContent).toContain('L. 0.00');
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|undefined/);
  });

  it('shows active loaded services in Todos without requiring a search first', () => {
    render(
      <ServiceSearch
        areas={areasFixture}
        categories={[]}
        services={[serviceFixture()]}
        selectedAreaId="all"
        selectedCategoryId="all"
        onAreaChange={vi.fn()}
        onCategoryChange={vi.fn()}
        search=""
        onSearchChange={vi.fn()}
        scanCode=""
        onScanCodeChange={vi.fn()}
        onAddService={vi.fn()}
        onAddByScanCode={vi.fn()}
      />,
    );

    expect(screen.getByText('Servicios (1)')).toBeInTheDocument();
    expect(screen.queryByText(/busque o elija una categoria/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar glucosa por l\. 15\.00/i })).toBeInTheDocument();
  });

  it('keeps scanner wording hidden while scanner support is disabled', () => {
    render(
      <ServiceSearch
        areas={areasFixture}
        categories={[]}
        services={[]}
        selectedAreaId={undefined}
        selectedCategoryId={undefined}
        onAreaChange={vi.fn()}
        onCategoryChange={vi.fn()}
        search=""
        onSearchChange={vi.fn()}
        scanCode=""
        onScanCodeChange={vi.fn()}
        onAddService={vi.fn()}
        onAddByScanCode={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/buscar por nombre o categoria/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/buscar por nombre\.\.\./i)).toBeInTheDocument();
    expect(screen.getByText(/escriba el nombre del servicio o toque una categoria/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/escanee|scanner|codigo/i);
  });

  it('shows backend fuzzy and accent-tolerant search results without stricter local filtering', () => {
    render(
      <ServiceSearch
        areas={areasFixture}
        categories={[]}
        services={[
          serviceFixture({ id: 1, name: 'Eritropoyetina', price: '25.00' }),
          serviceFixture({ id: 2, name: 'Ácido úrico especial', price: '30.00' }),
        ]}
        selectedAreaId="all"
        selectedCategoryId="all"
        onAreaChange={vi.fn()}
        onCategoryChange={vi.fn()}
        search="Eritropoytina acido urico"
        onSearchChange={vi.fn()}
        scanCode=""
        onScanCodeChange={vi.fn()}
        onAddService={vi.fn()}
        onAddByScanCode={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /agregar eritropoyetina por l\. 25\.00/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar ácido úrico especial por l\. 30\.00/i })).toBeInTheDocument();
  });

  it('filters loaded services by selected area and clears area with the reset button', () => {
    const onAreaChange = vi.fn();
    const onCategoryChange = vi.fn();
    const onSearchChange = vi.fn();

    render(
      <ServiceSearch
        areas={areasFixture}
        categories={[]}
        services={[
          serviceFixture({ id: 1, name: 'Glucosa', area_id: 1, area: areasFixture[0] }),
          serviceFixture({ id: 2, name: 'Rayos X torax', area_id: 2, area: areasFixture[1] }),
        ]}
        selectedAreaId={2}
        selectedCategoryId="all"
        onAreaChange={onAreaChange}
        onCategoryChange={onCategoryChange}
        search=""
        onSearchChange={onSearchChange}
        scanCode=""
        onScanCodeChange={vi.fn()}
        onAddService={vi.fn()}
        onAddByScanCode={vi.fn()}
      />,
    );

    expect(screen.getByText('Servicios (1)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar rayos x torax por l\. 15\.00/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /agregar glucosa/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /limpiar/i }));

    expect(onSearchChange).toHaveBeenCalledWith('');
    expect(onAreaChange).toHaveBeenCalledWith('all');
    expect(onCategoryChange).toHaveBeenCalledWith('all');
  });
});

const areasFixture: Area[] = [
  { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true },
  { id: 2, name: 'Rayos X', slug: 'rayos-x', active: true },
];

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
