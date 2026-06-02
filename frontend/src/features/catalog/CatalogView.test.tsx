import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CatalogView } from './CatalogView';
import { apiClient, type AuthUser, type Service } from '../../lib/api';

describe('CatalogView', () => {
  it('renders malformed service prices as safe financial values', async () => {
    vi.spyOn(apiClient, 'getCategories').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getAreas').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getFiscalSettings').mockResolvedValue(null);
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [serviceFixture({ price: 'monto-danado' })],
      meta: { current_page: 1, per_page: 15, total: 1 },
    });

    render(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Glucosa')).toBeInTheDocument());

    expect(document.body.textContent).toContain('L. 0.00');
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|undefined/);
  });
});

function catalogUser(): AuthUser {
  return {
    id: 1,
    name: 'Catalogo Hospital',
    email: 'catalogo@hospital-san-isidro.local',
    username: 'catalogo',
    active: true,
    roles: ['admin'],
    permissions: ['catalog.view'],
    must_change_password: false,
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
