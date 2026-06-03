import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'vitest-axe';
import type { ReactNode } from 'react';
import { CatalogView } from './CatalogView';
import { apiClient, type AuthUser, type Service } from '../../lib/api';

function withQueryClient(node: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
}

describe('CatalogView accessibility', () => {
  it('has no axe-core violations on the view', async () => {
    vi.spyOn(apiClient, 'getCategories').mockResolvedValue([
      { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 },
    ]);
    vi.spyOn(apiClient, 'getAreas').mockResolvedValue([
      { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true },
    ]);
    vi.spyOn(apiClient, 'getFiscalSettings').mockResolvedValue(null);
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [serviceFixture()],
      meta: { current_page: 1, per_page: 15, total: 1 },
    });

    const { container } = withQueryClient(
      <CatalogView user={catalogUser()} onStatus={vi.fn()} />,
    );

    await waitFor(() => {
      expect(container.textContent).toContain('Glucosa');
    });

    expect(await axe(container)).toHaveNoViolations();
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
    permissions: ['catalog.view', 'catalog.manage'],
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
