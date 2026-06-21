import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ServiceSearch } from './ServiceSearch';
import type { Service } from '../../../lib/api';

describe('ServiceSearch', () => {
  it('renders malformed billing service prices as safe financial values', () => {
    render(
      <ServiceSearch
        categories={[]}
        services={[serviceFixture({ price: 'NaN' })]}
        selectedCategoryId="all"
        onCategoryChange={vi.fn()}
        search="glu"
        onSearchChange={vi.fn()}
        scanCode=""
        onScanCodeChange={vi.fn()}
        onAddService={vi.fn()}
        onAddByScanCode={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /agregar glucosa por l 0\.00/i })).toBeInTheDocument();
    expect(document.body.textContent).toContain('L 0.00');
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|undefined/);
  });

  it('supports keyboard navigation in category radio groups', async () => {
    const onCategoryChange = vi.fn();
    render(
      <ServiceSearch
        categories={[
          { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 },
          { id: 2, name: 'Imagenes', slug: 'imagenes', active: true, sort_order: 2 },
        ]}
        services={[]}
        selectedCategoryId="all"
        onCategoryChange={onCategoryChange}
        search=""
        onSearchChange={vi.fn()}
        scanCode=""
        onScanCodeChange={vi.fn()}
        onAddService={vi.fn()}
        onAddByScanCode={vi.fn()}
      />,
    );

    const categoryGroup = screen.getByRole('radiogroup', { name: /categoria/i });
    fireEvent.keyDown(categoryGroup, { key: 'ArrowRight' });

    expect(onCategoryChange).toHaveBeenCalledWith(1);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Laboratorio' })).toHaveFocus());

    fireEvent.keyDown(categoryGroup, { key: 'End' });

    expect(onCategoryChange).toHaveBeenLastCalledWith(2);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Imagenes' })).toHaveFocus());
  });
});

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
