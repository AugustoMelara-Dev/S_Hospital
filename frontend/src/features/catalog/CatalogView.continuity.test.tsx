import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient, type AuthUser, type Service } from '../../lib/api';
import { CatalogView } from './CatalogView';

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Ubicacion actual">{`${location.pathname}${location.search}`}</output>;
}

describe('CatalogView continuity', () => {
  afterEach(() => vi.restoreAllMocks());

  it('conserva la busqueda URL al editar y cerrar un servicio', async () => {
    vi.spyOn(apiClient, 'getCategories').mockResolvedValue([
      { id: 2, name: 'Medicamentos', slug: 'medicamentos', active: true, sort_order: 1 },
    ]);
    vi.spyOn(apiClient, 'getAreas').mockResolvedValue([
      { id: 3, name: 'Farmacia', slug: 'farmacia', active: true },
    ]);
    vi.spyOn(apiClient, 'getOperationalSettings').mockResolvedValue(null);
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [erythropoietinFixture()],
      meta: { current_page: 1, per_page: 15, total: 1 },
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/catalog?q=eritropoyetina']}>
          <CatalogView user={catalogManager()} onStatus={vi.fn()} />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(apiClient.getServicesPage).toHaveBeenCalledWith(expect.objectContaining({ search: 'eritropoyetina' }));
    });
    const actions = await screen.findByRole('button', { name: /acciones de servicio eritropoyetina/i });
    actions.focus();
    fireEvent.keyDown(actions, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: /^editar$/i }));

    expect(await screen.findByRole('dialog', { name: /editar servicio/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Ubicacion actual')).toHaveTextContent('q=eritropoyetina');
    expect(screen.getByLabelText(/buscar servicio/i)).toHaveValue('eritropoyetina');
    expect(screen.getByLabelText(/precio/i)).toHaveValue('25.00');

    fireEvent.click(screen.getByRole('button', { name: /cerrar panel/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Ubicacion actual')).toHaveTextContent('/catalog?q=eritropoyetina');
    expect(screen.getByLabelText(/buscar servicio/i)).toHaveValue('eritropoyetina');

    fireEvent.click(screen.getByRole('button', { name: /editar categor[ií]a medicamentos/i }));
    expect(await screen.findByRole('dialog', { name: /editar categor[ií]a/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Ubicacion actual')).toHaveTextContent('q=eritropoyetina');
    expect(screen.getByLabelText(/nombre/i)).toHaveValue('Medicamentos');

    fireEvent.click(screen.getByRole('button', { name: /cerrar panel/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Ubicacion actual')).toHaveTextContent('/catalog?q=eritropoyetina');
  });
});

function erythropoietinFixture(): Service {
  return {
    id: 4,
    category_id: 2,
    area_id: 3,
    name: 'Eritropoyetina',
    aliases: null,
    slug: 'eritropoyetina',
    scan_code: null,
    barcode: null,
    qr_code: null,
    price: '25.00',
    taxable: false,
    active: true,
    visible_in_billing: true,
    is_billable: true,
    special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
    category: { id: 2, name: 'Medicamentos', slug: 'medicamentos', active: true, sort_order: 1 },
    area: { id: 3, name: 'Farmacia', slug: 'farmacia', active: true },
  };
}

function catalogManager(): AuthUser {
  return {
    id: 1,
    name: 'Administracion',
    email: 'admin@hospital.local',
    username: 'admin',
    active: true,
    roles: ['admin'],
    permissions: ['catalog.view', 'catalog.manage'],
    must_change_password: false,
  };
}
