import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogView, ConfirmDialog, serviceStatusPayload } from './CatalogView';
import { apiClient, ApiError, type AuthUser, type Service } from '../../lib/api';

function renderWithQueryClient(node: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

function setupBasicMocks() {
  vi.spyOn(apiClient, 'getCategories').mockResolvedValue([]);
  vi.spyOn(apiClient, 'getAreas').mockResolvedValue([]);
  vi.spyOn(apiClient, 'getOperationalSettings').mockResolvedValue(null);
}

describe('CatalogView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders malformed service prices as safe financial values', async () => {
    setupBasicMocks();
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [serviceFixture({ price: 'monto-danado' })],
      meta: { current_page: 1, per_page: 15, total: 1 },
    });

    renderWithQueryClient(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Glucosa')).toBeInTheDocument());

    expect(document.body.textContent).toContain('L 0.00');
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|undefined/);
  });

  it('renders inside a QueryClientProvider without crashing', async () => {
    setupBasicMocks();
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [],
      meta: { current_page: 1, per_page: 15, total: 0 },
    });

    renderWithQueryClient(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    await waitFor(() => expect(apiClient.getServicesPage).toHaveBeenCalled());
  });

  it('shows billing visibility, billable state and tariff warnings', async () => {
    setupBasicMocks();
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [
        serviceFixture({
          visible_in_billing: false,
          is_billable: false,
          price: '0.00',
        }),
      ],
      meta: { current_page: 1, per_page: 15, total: 1 },
    });

    renderWithQueryClient(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    expect(await screen.findByText('Glucosa')).toBeInTheDocument();
    expect(screen.getByText('Buscar servicio')).toBeInTheDocument();
    expect(screen.getByLabelText('Categoría')).toBeInTheDocument();
    expect(screen.getByLabelText('Estado')).toBeInTheDocument();
    expect(screen.getByText('Oculto en facturación')).toBeInTheDocument();
    expect(screen.getByText('No facturable')).toBeInTheDocument();
    expect(screen.getByText('Sin tarifa')).toBeInTheDocument();
  });
});

describe('CatalogView modernized structure', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a single accessible h1 from the page header', async () => {
    setupBasicMocks();
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [],
      meta: { current_page: 1, per_page: 15, total: 0 },
    });

    renderWithQueryClient(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    const headings = await screen.findAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(/cat[aá]logo institucional/i);
  });

  it('shows the total services summary with the existing wording', async () => {
    setupBasicMocks();
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [serviceFixture()],
      meta: { current_page: 1, per_page: 15, total: 1 },
    });

    renderWithQueryClient(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    expect(await screen.findByText('1 servicio en el catálogo')).toBeInTheDocument();
  });

  it('shows the plural summary when the total is not 1', async () => {
    setupBasicMocks();
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [serviceFixture({ id: 1 }), serviceFixture({ id: 2, name: 'Hemograma' })],
      meta: { current_page: 1, per_page: 15, total: 2 },
    });

    renderWithQueryClient(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    expect(await screen.findByText('2 servicios en el catálogo')).toBeInTheDocument();
  });

  it('puts filters and results before category maintenance without decorative metric cards', async () => {
    setupBasicMocks();
    vi.spyOn(apiClient, 'getCategories').mockResolvedValue([
      { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 },
    ]);
    vi.spyOn(apiClient, 'getAreas').mockResolvedValue([
      { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true },
    ]);
    vi.spyOn(apiClient, 'getOperationalSettings').mockResolvedValue({
      scanner_enabled: true,
    } as Awaited<ReturnType<typeof apiClient.getOperationalSettings>>);
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [serviceFixture()],
      meta: { current_page: 1, per_page: 15, total: 1 },
    });

    renderWithQueryClient(<CatalogView user={catalogUser(['catalog.view', 'catalog.manage'])} onStatus={vi.fn()} />);

    const filters = await screen.findByRole('heading', { name: /filtros del cat[aá]logo/i });
    const results = screen.getByRole('heading', { name: /servicios disponibles/i });
    const categories = await screen.findByRole('button', { name: /categorías del catálogo/i });
    expect(screen.queryByText(/total cat[aá]logo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^categor[ií]as$/i)).not.toBeInTheDocument();
    expect(filters.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(results.compareDocumentPosition(categories) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps editable categories in a compact collapsed section until requested', async () => {
    setupBasicMocks();
    vi.spyOn(apiClient, 'getCategories').mockResolvedValue([
      { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 },
    ]);
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [serviceFixture()],
      meta: { current_page: 1, per_page: 15, total: 1 },
    });

    renderWithQueryClient(
      <CatalogView user={catalogUser(['catalog.view', 'catalog.manage'])} onStatus={vi.fn()} />,
    );

    const categorySection = await screen.findByRole('button', { name: /categorías del catálogo/i });
    expect(categorySection).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /editar categoría laboratorio/i })).not.toBeInTheDocument();

    fireEvent.click(categorySection);
    expect(await screen.findByRole('button', { name: /editar categoría laboratorio/i })).toBeInTheDocument();
  });

  it('exposes the search input with an accessible name', async () => {
    setupBasicMocks();
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [],
      meta: { current_page: 1, per_page: 15, total: 0 },
    });

    renderWithQueryClient(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    const search = await screen.findByLabelText(/buscar servicio/i);
    expect(search).toHaveAttribute('placeholder', 'Buscar por nombre, categoria o area...');
    expect(search).not.toHaveAttribute('placeholder', expect.stringMatching(/c[oó]digo/i));
  });

  it('clears the search input and resets the filter state via the clear button', async () => {
    setupBasicMocks();
    const getServicesPage = vi
      .spyOn(apiClient, 'getServicesPage')
      .mockResolvedValue({ data: [], meta: { current_page: 1, per_page: 15, total: 0 } });

    renderWithQueryClient(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    const search = await screen.findByLabelText(/buscar servicio/i);
    fireEvent.change(search, { target: { value: 'glucosa' } });

    await waitFor(() => {
      expect(getServicesPage.mock.calls.some((call) => call[0]?.search === 'glucosa')).toBe(true);
    });

    const clear = await screen.findByRole('button', { name: /limpiar filtros de cat[aá]logo/i });
    await act(async () => {
      fireEvent.click(clear);
    });

    await waitFor(() => {
      expect(search).toHaveValue('');
    });
  });

  it('keeps the current service table visible during background search refetches', async () => {
    setupBasicMocks();
    let resolveSecondPage: (value: Awaited<ReturnType<typeof apiClient.getServicesPage>>) => void = () => undefined;
    const getServicesPage = vi
      .spyOn(apiClient, 'getServicesPage')
      .mockImplementation((filters) => {
        if (filters?.search === 'hemo') {
          return new Promise((resolve) => {
            resolveSecondPage = resolve;
          });
        }

        return Promise.resolve({
          data: [serviceFixture({ id: 1, name: 'Glucosa basal' })],
          meta: { current_page: 1, per_page: 15, total: 1 },
        });
      });

    renderWithQueryClient(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    expect(await screen.findByText('Glucosa basal')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/buscar servicio/i), { target: { value: 'hemo' } });

    await waitFor(() => {
      expect(getServicesPage.mock.calls.some((call) => call[0]?.search === 'hemo')).toBe(true);
    });

    expect(screen.getByText('Glucosa basal')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: /cargando servicios/i })).not.toBeInTheDocument();

    await act(async () => {
      resolveSecondPage({
        data: [serviceFixture({ id: 2, name: 'Hemograma' })],
        meta: { current_page: 1, per_page: 15, total: 1 },
      });
    });
  });

  it('hides create actions for users without catalog.manage permission', async () => {
    setupBasicMocks();
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [serviceFixture()],
      meta: { current_page: 1, per_page: 15, total: 1 },
    });

    renderWithQueryClient(<CatalogView user={catalogUser(['catalog.view'])} onStatus={vi.fn()} />);

    expect(await screen.findByText('Glucosa')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /crear nuevo servicio/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /crear nueva categor[ií]a/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /acciones de servicio glucosa/i }),
    ).not.toBeInTheDocument();
  });

  it('shows create actions for users with catalog.manage permission', async () => {
    setupBasicMocks();
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [serviceFixture()],
      meta: { current_page: 1, per_page: 15, total: 1 },
    });

    renderWithQueryClient(
      <CatalogView user={catalogUser(['catalog.view', 'catalog.manage'])} onStatus={vi.fn()} />,
    );

    expect(
      await screen.findByRole('button', { name: /crear nuevo servicio/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: /crear nueva categor[ií]a/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: /acciones de servicio glucosa/i }),
    ).toBeInTheDocument();
  });

  it('requires confirmation before deactivating an active service without deleting it', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Desactivar servicio"
        confirmLabel="Desactivar servicio"
        danger
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        reasonHelpText="Mínimo 5 caracteres"
        requireReasonMinLength={5}
      >
        El servicio Glucosa quedará oculto para nuevos cobros.
      </ConfirmDialog>,
    );

    expect(await screen.findByRole('dialog', { name: /desactivar servicio/i })).toBeInTheDocument();
    expect(screen.getByText(/el servicio glucosa quedará oculto/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /desactivar servicio/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/motivo/i), {
      target: { value: 'Servicio retirado temporalmente de caja' },
    });
    fireEvent.click(screen.getByRole('button', { name: /desactivar servicio/i }));

    expect(onConfirm).toHaveBeenCalledWith('Servicio retirado temporalmente de caja');
    expect(serviceStatusPayload(
      serviceFixture({ aliases: 'azucar, laboratorio rapido' }),
      false,
      ' Servicio retirado temporalmente de caja ',
    )).toEqual(expect.objectContaining({
      active: false,
      aliases: 'azucar, laboratorio rapido',
      availability_change_reason: 'Servicio retirado temporalmente de caja',
    }));
  });

  it('builds the audited payload when activating an inactive service', () => {
    expect(serviceStatusPayload(
      serviceFixture({ active: false, aliases: 'azucar, laboratorio rapido' }),
      true,
      'Servicio reactivado por administracion',
    )).toEqual(expect.objectContaining({
      active: true,
      aliases: 'azucar, laboratorio rapido',
      availability_change_reason: 'Servicio reactivado por administracion',
    }));
  });

  it('renders error sanitized message and exposes a retry callback on the table', async () => {
    setupBasicMocks();
    const getServicesPage = vi
      .spyOn(apiClient, 'getServicesPage')
      .mockRejectedValueOnce(
        new ApiError('SQLSTATE[HY000]: stack trace in storage/logs/laravel.log', 500),
      )
      .mockResolvedValueOnce({
        data: [serviceFixture()],
        meta: { current_page: 1, per_page: 15, total: 1 },
      });

    renderWithQueryClient(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    expect(
      await screen.findByText(/el servidor local no pudo completar la operaci[oó]n/i),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/SQLSTATE|stack trace|storage\/logs/i);

    const retry = await screen.findByRole('button', { name: /reintentar/i });
    await act(async () => {
      fireEvent.click(retry);
    });

    await waitFor(() => {
      expect(getServicesPage).toHaveBeenCalledTimes(2);
    });
  });

  it('renders a safe empty state when no services exist and no filters are active', async () => {
    setupBasicMocks();
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [],
      meta: { current_page: 1, per_page: 15, total: 0 },
    });

    renderWithQueryClient(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    expect(await screen.findByText(/no hay servicios/i)).toBeInTheDocument();
    expect(
      screen.getByText(/comience agregando su primer servicio al cat[aá]logo/i),
    ).toBeInTheDocument();
  });

  it('preserves the table caption label for accessibility', async () => {
    setupBasicMocks();
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [serviceFixture({ name: 'Consulta General Larga Para Validar Caption' })],
      meta: { current_page: 1, per_page: 15, total: 1 },
    });

    renderWithQueryClient(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    expect(
      await screen.findByText('Consulta General Larga Para Validar Caption'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: /listado de servicios del cat[aá]logo/i }),
    ).toBeInTheDocument();
  });

  it('renders the service name and price with the existing monetary format and tabular-nums', async () => {
    setupBasicMocks();
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [serviceFixture({ price: '1234.50' })],
      meta: { current_page: 1, per_page: 15, total: 1 },
    });

    renderWithQueryClient(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    const priceCell = await screen.findByText('L 1,234.50');
    expect(priceCell).toBeInTheDocument();
    expect(priceCell.className).toMatch(/tabular-nums/);
  });

  it('treats zero as a valid monetary value for the service price', async () => {
    setupBasicMocks();
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [serviceFixture({ price: '0.00' })],
      meta: { current_page: 1, per_page: 15, total: 1 },
    });

    renderWithQueryClient(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    const zeroLabels = await screen.findAllByText('L 0.00');
    expect(zeroLabels.length).toBeGreaterThan(0);
  });

  it('does not call the dashboard or system endpoints while rendering the catalog', async () => {
    setupBasicMocks();
    const getDashboardReport = vi.spyOn(apiClient, 'getDashboardReport');
    const getSystemStatusSummary = vi.spyOn(apiClient, 'getSystemStatusSummary');

    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [],
      meta: { current_page: 1, per_page: 15, total: 0 },
    });

    renderWithQueryClient(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    await waitFor(() => expect(apiClient.getServicesPage).toHaveBeenCalled());

    expect(getDashboardReport).not.toHaveBeenCalled();
    expect(getSystemStatusSummary).not.toHaveBeenCalled();
  });
});

function catalogUser(permissions: string[] = ['catalog.view']): AuthUser {
  return {
    id: 1,
    name: 'Catalogo Hospital',
    email: 'catalogo@hospital-san-isidro.local',
    username: 'catalogo',
    active: true,
    roles: permissions.includes('catalog.manage') ? ['admin'] : ['cajero'],
    permissions,
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
