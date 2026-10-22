import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogView, ConfirmDialog, serviceStatusPayload } from './CatalogView';
import { apiClient, ApiError, type AuthUser, type Service } from '../../lib/api';

function renderWithQueryClient(node: ReactNode, initialEntries?: string[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

function LocationSearchProbe() {
  return <output data-testid="location-search">{useLocation().search}</output>;
}

function setupBasicMocks() {
  vi.spyOn(apiClient, 'getCategories').mockResolvedValue([]);
  vi.spyOn(apiClient, 'getAreas').mockResolvedValue([]);
  vi.spyOn(apiClient, 'getOperationalSettings').mockResolvedValue(null);
  vi.spyOn(apiClient, 'getTaxRatesWithStatus').mockResolvedValue({ data: [], meta: null });
  vi.spyOn(apiClient, 'getFiscalSettings').mockResolvedValue(null);
}

describe('CatalogView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders malformed service prices as "No disponible", never as L. 0.00', async () => {
    setupBasicMocks();
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [serviceFixture({ price: 'monto-danado' })],
      meta: { current_page: 1, per_page: 15, total: 1 },
    });

    renderWithQueryClient(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Glucosa')).toBeInTheDocument());

    expect(document.body.textContent).toContain('No disponible');
    expect(document.body.textContent).not.toContain('L. 0.00');
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

  it('keeps the initial service count pending until the catalog responds', async () => {
    setupBasicMocks();
    let resolveServices: (value: Awaited<ReturnType<typeof apiClient.getServicesPage>>) => void = () => undefined;
    vi.spyOn(apiClient, 'getServicesPage').mockImplementation(() => new Promise((resolve) => {
      resolveServices = resolve;
    }));

    renderWithQueryClient(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    expect(await screen.findByText('Cargando catálogo…')).toBeInTheDocument();
    expect(screen.getByText('Conteo de conceptos pendiente')).toBeInTheDocument();
    expect(screen.queryByText(/^0 conceptos$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mostrando 0 de 0 servicios/i)).not.toBeInTheDocument();

    await act(async () => {
      resolveServices({ data: [], meta: { current_page: 1, per_page: 15, total: 0 } });
    });

    expect(await screen.findByText('0 conceptos')).toBeInTheDocument();
    expect(screen.getByText(/no hay productos ni servicios/i)).toBeInTheDocument();
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

    await waitFor(() => expect(screen.getByText('Glucosa')).toBeInTheDocument());
    expect(screen.getByText('Buscar producto o servicio')).toBeInTheDocument();
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

  it('renders a specific h1 for the catalog route', async () => {
    setupBasicMocks();
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [],
      meta: { current_page: 1, per_page: 15, total: 0 },
    });

    renderWithQueryClient(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    expect(await screen.findByRole('heading', { level: 1, name: /productos y servicios/i })).toBeInTheDocument();
    expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('keeps the catalog wrapper non-landmark under its single page heading', async () => {
    setupBasicMocks();
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [],
      meta: { current_page: 1, per_page: 15, total: 0 },
    });

    renderWithQueryClient(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    await screen.findByRole('heading', { level: 1, name: /productos y servicios/i });
    expect(screen.queryByRole('region', { name: /^cat[aá]logo de productos y servicios$/i })).not.toBeInTheDocument();
    const surface = document.getElementById('catalogo');
    expect(surface?.tagName).toBe('DIV');
    expect(surface).not.toHaveAttribute('role');
    expect(surface).not.toHaveAttribute('aria-label');
  });

  it('shows the singular total without repeating the page title', async () => {
    setupBasicMocks();
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [serviceFixture()],
      meta: { current_page: 1, per_page: 15, total: 1 },
    });

    renderWithQueryClient(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    expect(await screen.findByText('1 concepto')).toBeInTheDocument();
  });

  it('shows the plural summary when the total is not 1', async () => {
    setupBasicMocks();
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [serviceFixture({ id: 1 }), serviceFixture({ id: 2, name: 'Hemograma' })],
      meta: { current_page: 1, per_page: 15, total: 2 },
    });

    renderWithQueryClient(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    expect(await screen.findByText('2 conceptos')).toBeInTheDocument();
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
    const results = screen.getByRole('heading', { name: /productos y servicios disponibles/i });
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

    const search = await screen.findByLabelText(/buscar producto o servicio/i);
    expect(search).toHaveAttribute('placeholder', 'Buscar por nombre, categoría o área…');
    expect(search).not.toHaveAttribute('placeholder', expect.stringMatching(/c[oó]digo/i));
  });

  it('reflects what is typed in the input and URL immediately, without a second local debounce', async () => {
    setupBasicMocks();
    const getServicesPage = vi
      .spyOn(apiClient, 'getServicesPage')
      .mockResolvedValue({ data: [], meta: { current_page: 1, per_page: 15, total: 0 } });

    renderWithQueryClient(
      <>
        <CatalogView user={catalogUser()} onStatus={vi.fn()} />
        <LocationSearchProbe />
      </>,
    );

    const search = await screen.findByLabelText(/buscar producto o servicio/i);

    // Ráfaga con espacio intermedio: el input y la URL no se retrasan ni se
    // recortan por el debounce de la consulta (que sólo vive en useServices).
    fireEvent.change(search, { target: { value: 'glucosa' } });
    fireEvent.change(search, { target: { value: 'glucosa ' } });
    fireEvent.change(search, { target: { value: 'glucosa basal' } });

    expect(search).toHaveValue('glucosa basal');
    const params = new URLSearchParams(screen.getByTestId('location-search').textContent ?? '');
    expect(params.get('q')).toBe('glucosa basal');
    expect(params.has('page')).toBe(false);

    // El único temporizador es el de useServices: la consulta sale con el
    // término asentado y no se dispara una por pulsación intermedia.
    await waitFor(() => {
      expect(getServicesPage.mock.calls.some((call) => call[0]?.search === 'glucosa basal')).toBe(true);
    });
    expect(getServicesPage.mock.calls.some((call) => call[0]?.search === 'glucosa ')).toBe(false);
  });

  it('clears the search input and resets the filter state via the clear button', async () => {
    setupBasicMocks();
    const getServicesPage = vi
      .spyOn(apiClient, 'getServicesPage')
      .mockResolvedValue({ data: [], meta: { current_page: 1, per_page: 15, total: 0 } });

    renderWithQueryClient(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    const search = await screen.findByLabelText(/buscar producto o servicio/i);
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

  it('preserves a category selected while the search debounce is pending', async () => {
    const user = userEvent.setup();
    setupBasicMocks();
    vi.spyOn(apiClient, 'getCategories').mockResolvedValue([
      { id: 7, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 },
    ]);
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [],
      meta: { current_page: 1, per_page: 15, total: 0 },
    });

    renderWithQueryClient(
      <>
        <CatalogView user={catalogUser()} onStatus={vi.fn()} />
        <LocationSearchProbe />
      </>,
    );

    const search = await screen.findByLabelText(/buscar producto o servicio/i);
    const categorySelect = screen.getByLabelText(/categor/i);

    fireEvent.change(search, { target: { value: 'glucosa' } });
    await user.selectOptions(categorySelect, '7');

    await waitFor(() => {
      const params = new URLSearchParams(screen.getByTestId('location-search').textContent ?? '');
      expect(params.get('category')).toBe('7');
    });

    await waitFor(() => {
      const params = new URLSearchParams(screen.getByTestId('location-search').textContent ?? '');
      expect(params.get('q')).toBe('glucosa');
      expect(params.get('category')).toBe('7');
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

    await waitFor(() => expect(screen.getByText('Glucosa basal')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/buscar producto o servicio/i), { target: { value: 'hemo' } });

    await waitFor(() => {
      expect(getServicesPage.mock.calls.some((call) => call[0]?.search === 'hemo')).toBe(true);
    });

    expect(screen.getByText('Glucosa basal')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: /cargando productos y servicios/i })).not.toBeInTheDocument();

    await act(async () => {
      resolveSecondPage({
        data: [serviceFixture({ id: 2, name: 'Hemograma' })],
        meta: { current_page: 1, per_page: 15, total: 1 },
      });
    });
  });

  it('hides create actions for users without catalog.manage permission', async () => {
    const user = userEvent.setup();
    setupBasicMocks();
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [serviceFixture()],
      meta: { current_page: 1, per_page: 15, total: 1 },
    });

    renderWithQueryClient(<CatalogView user={catalogUser(['catalog.view'])} onStatus={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Glucosa')).toBeInTheDocument());
    expect(
      screen.queryByRole('button', { name: /crear nuevo producto o servicio/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /crear nueva categor[ií]a/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /acciones de servicio glucosa/i }));
    expect(screen.getByRole('menuitem', { name: /ver historial/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /^editar$/i })).not.toBeInTheDocument();
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
      await screen.findByRole('button', { name: /crear nuevo producto o servicio/i }),
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
      await screen.findByText(/no se pudo cargar el catálogo.*conexión local/i),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/SQLSTATE|stack trace|storage\/logs/i);
    expect(document.body.textContent).not.toMatch(/si estaba cobrando|revise recibos/i);

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

    expect(await screen.findByText(/no hay productos ni servicios/i)).toBeInTheDocument();
    expect(screen.getByText('0 conceptos')).toBeInTheDocument();
    expect(
      screen.getByText(/agregando el primer concepto/i),
    ).toBeInTheDocument();
  });

  it('preserves the table caption label for accessibility', async () => {
    setupBasicMocks();
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [serviceFixture({ name: 'Consulta General Larga Para Validar Caption' })],
      meta: { current_page: 1, per_page: 15, total: 1 },
    });

    renderWithQueryClient(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Consulta General Larga Para Validar Caption')).toBeInTheDocument());
    expect(
      screen.getByRole('region', { name: /listado de productos y servicios del cat[aá]logo/i }),
    ).toBeInTheDocument();
  });

  it('renders the service name and price with the existing monetary format and tabular-nums', async () => {
    setupBasicMocks();
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [serviceFixture({ price: '1234.50' })],
      meta: { current_page: 1, per_page: 15, total: 1 },
    });

    renderWithQueryClient(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('L. 1,234.50')).toBeInTheDocument());
    const priceCell = screen.getByText('L. 1,234.50');
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

    const zeroLabels = await screen.findAllByText('L. 0.00');
    expect(zeroLabels.length).toBeGreaterThan(0);
  });

  it('opens a service from a deep link even when it is outside the current page', async () => {
    setupBasicMocks();
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [serviceFixture({ id: 1, name: 'Glucosa' })],
      meta: { current_page: 1, per_page: 15, total: 30 },
    });
    vi.spyOn(apiClient, 'getService').mockResolvedValue(
      serviceFixture({ id: 37, name: 'Hemograma completo', price: '120.00' }),
    );

    renderWithQueryClient(
      <CatalogView user={catalogUser(['catalog.manage'])} onStatus={vi.fn()} />,
      ['/?service=37'],
    );

    expect(await screen.findByRole('dialog', { name: /editar producto o servicio/i })).toBeInTheDocument();
    expect(apiClient.getService).toHaveBeenCalledWith(37);
    expect(screen.getByRole('textbox', { name: /nombre/i })).toHaveValue('Hemograma completo');
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

describe('CatalogView impuestos', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra el aviso de revisión cuando el servidor lo indica', async () => {
    setupBasicMocks();
    vi.mocked(apiClient.getTaxRatesWithStatus).mockResolvedValue({
      data: [{ id: 1, name: 'ISV 15 %', percentage: '15.00', active: true, is_default: true }],
      meta: { catalog_tax_review_required: true },
    });
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [serviceFixture()],
      meta: { current_page: 1, per_page: 15, total: 1 },
    });

    renderWithQueryClient(
      <CatalogView user={catalogUser(['catalog.view', 'catalog.manage', 'settings.fiscal.view'])} onStatus={vi.fn()} />,
    );

    expect(await screen.findByText(/revise impuestos del catálogo antes de cobrar/i)).toBeInTheDocument();
    expect(screen.getByText(/las facturas ya emitidas conservan su impuesto/i)).toBeInTheDocument();
  });

  it('no muestra el aviso cuando el servidor confirma que no hace falta revisar', async () => {
    setupBasicMocks();
    vi.mocked(apiClient.getTaxRatesWithStatus).mockResolvedValue({
      data: [{ id: 1, name: 'ISV 15 %', percentage: '15.00', active: true, is_default: true }],
      meta: { catalog_tax_review_required: false },
    });
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [serviceFixture()],
      meta: { current_page: 1, per_page: 15, total: 1 },
    });

    renderWithQueryClient(
      <CatalogView user={catalogUser(['catalog.view', 'settings.fiscal.view'])} onStatus={vi.fn()} />,
    );

    await waitFor(() => expect(apiClient.getTaxRatesWithStatus).toHaveBeenCalled());
    expect(screen.queryByText(/revise impuestos del catálogo antes de cobrar/i)).not.toBeInTheDocument();
  });

  it('deduce el aviso si hay tasas gravables pero la página visible sigue exenta', async () => {
    setupBasicMocks();
    vi.mocked(apiClient.getTaxRatesWithStatus).mockResolvedValue({
      data: [
        { id: 1, name: 'ISV 15 %', percentage: '15.00', active: true, is_default: true },
      ],
      meta: null,
    });
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [{ ...serviceFixture(), tax_rate_id: null } as Service],
      meta: { current_page: 1, per_page: 15, total: 1 },
    });

    renderWithQueryClient(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    expect(await screen.findByText(/revise impuestos del catálogo antes de cobrar/i)).toBeInTheDocument();
  });

  it('muestra la tasa o «Exento» por concepto en la columna Impuesto', async () => {
    setupBasicMocks();
    vi.mocked(apiClient.getTaxRatesWithStatus).mockResolvedValue({
      data: [
        { id: 2, name: 'Exento', percentage: '0.00', active: true, is_default: false },
      ],
      meta: null,
    });
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [{ ...serviceFixture(), tax_rate_id: null } as Service],
      meta: { current_page: 1, per_page: 15, total: 1 },
    });

    renderWithQueryClient(<CatalogView user={catalogUser()} onStatus={vi.fn()} />);

    const table = await screen.findByRole('table', { name: /listado de productos y servicios/i });
    expect(within(table).getByText('Impuesto')).toBeInTheDocument();
    expect(within(table).getByText('Exento')).toBeInTheDocument();
  });

  it('ofrece importar/exportar y editar impuestos en lote al administrador del catálogo', async () => {
    setupBasicMocks();
    vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
      data: [],
      meta: { current_page: 1, per_page: 15, total: 0 },
    });

    renderWithQueryClient(
      <CatalogView user={catalogUser(['catalog.view', 'catalog.manage'])} onStatus={vi.fn()} />,
    );

    expect(await screen.findByRole('button', { name: /importar o exportar catálogo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /editar impuestos en lote/i })).toBeInTheDocument();
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
