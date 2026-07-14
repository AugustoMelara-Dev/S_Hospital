import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient, type CashSession, type Invoice } from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';
import { DashboardView } from './DashboardView';

function makeCashSession(overrides: Partial<CashSession> = {}): CashSession {
  return {
    id: 7,
    user_id: 1,
    opening_amount: '500.00',
    closing_amount: null,
    expected_amount: null,
    difference_amount: null,
    status: 'open',
    opening_notes: null,
    closing_notes: null,
    opened_at: '2026-05-30T08:00:00Z',
    closed_at: null,
    ...overrides,
  };
}

function makeBaseProps(overrides: Partial<React.ComponentProps<typeof DashboardView>> = {}) {
  return {
    canCreateInvoices: true,
    canEditFiscalSettings: true,
    canManageCatalog: true,
    canOpenCash: true,
    canViewBackups: true,
    canViewCatalog: true,
    canViewFiscalSettings: true,
    canViewInvoices: true,
    canViewManagerialReports: true,
    canViewReports: true,
    cashSession: null,
    onStatus: vi.fn(),
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1,
    invoice_number: 'A-00000001',
    patient_name: 'Paciente Demo',
    status: 'paid',
    issued_at: '2026-06-30T15:00:00.000Z',
    subtotal: '100.00',
    tax_amount: '15.00',
    discount_amount: '0.00',
    total: '115.00',
    paid_amount: '115.00',
    balance_due: '0.00',
    items: [],
    ...overrides,
  };
}

function mockSetupStatus(needsSetup = false, stepOverrides: Partial<{
  fiscal_settings: boolean;
  admin_exists: boolean;
  catalog_has_services: boolean;
  fiscal_sequence_exists: boolean;
}> = {}) {
  vi.spyOn(apiClient, 'request').mockResolvedValue({
    needs_setup: needsSetup,
    steps: {
      fiscal_settings: !needsSetup,
      admin_exists: !needsSetup,
      catalog_has_services: !needsSetup,
      fiscal_sequence_exists: !needsSetup,
      ...stepOverrides,
    },
  });
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderDashboard(props: React.ComponentProps<typeof DashboardView>, queryClient = makeQueryClient()) {
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardView {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { ...result, queryClient };
}

function makeDashboardReport() {
  return {
    current_month: {
      total_billed: '125.00',
      total_collected: '100.00',
      total_pending: '25.00',
      invoice_count: 2,
      payment_count: 2,
    },
    last_7_days: [
      {
        date: '2026-06-30',
        total_billed: '125.00',
        total_collected: '100.00',
        invoice_count: 2,
        payment_count: 2,
      },
    ],
    payments_by_method: { cash: '100.00', transfer: '0.00', card: '0.00', other: '0.00' },
    top_services: [],
    cashiers_summary: [],
  };
}

describe('DashboardView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockSetupStatus(false);
    vi.spyOn(apiClient, 'getDashboardReport').mockResolvedValue(makeDashboardReport());
    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [makeInvoice()],
      meta: { current_page: 1, per_page: 5, total: 1 },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a single accessible h1 and the four operational metrics', async () => {
    renderDashboard(makeBaseProps());

    const headings = await screen.findAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(/^continuar operación$/i);

    expect(await screen.findByText(/^caja$/i)).toBeInTheDocument();
    expect(screen.getByText(/^facturado$/i)).toBeInTheDocument();
    expect(screen.getByText(/^cobrado$/i)).toBeInTheDocument();
    expect(screen.getByText(/^pendiente$/i)).toBeInTheDocument();
  });

  it('shows open cash session label when there is one', async () => {
    renderDashboard(makeBaseProps({ cashSession: makeCashSession({ id: 12 }) }));

    expect((await screen.findAllByText(/caja #12/i)).length).toBeGreaterThan(0);
  });

  it('shows closed cash session label when there is no session', async () => {
    renderDashboard(makeBaseProps({ cashSession: null }));

    expect((await screen.findAllByText(/cerrada/i)).length).toBeGreaterThan(0);
  });

  it('links the open-cash primary action to the canonical cashbox route when there is no cash session', async () => {
    renderDashboard(makeBaseProps({ cashSession: null }));

    const openCash = await screen.findByRole('link', { name: /abrir caja/i });
    expect(openCash).toHaveAttribute('href', '/cashbox');
    expect(screen.queryByRole('link', { name: /nueva factura/i })).not.toBeInTheDocument();
  });

  it('hides the open-cash quick action when cash access is read only', async () => {
    renderDashboard(makeBaseProps({ canOpenCash: false, cashSession: null }));

    expect(await screen.findByText(/^caja$/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /abrir caja/i })).not.toBeInTheDocument();
  });

  it('links the new-invoice primary action to the canonical billing route when there is a cash session', async () => {
    renderDashboard(makeBaseProps({ cashSession: makeCashSession({ id: 3 }) }));

    const newInvoice = await screen.findByRole('link', { name: /nueva factura/i });
    expect(newInvoice).toHaveAttribute('href', '/billing/new');
    expect(screen.queryByRole('link', { name: /abrir caja/i })).not.toBeInTheDocument();
  });

  it('hides both quick actions when the user cannot open cash or invoice', async () => {
    renderDashboard(
      makeBaseProps({
        canCreateInvoices: false,
        canOpenCash: false,
        cashSession: null,
      }),
    );

    expect(await screen.findByText(/^caja$/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /abrir caja/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /nueva factura/i })).not.toBeInTheDocument();
  });

  it('does not announce a fake primary action when no dashboard action is available', async () => {
    renderDashboard(
      makeBaseProps({
        canCreateInvoices: false,
        canOpenCash: false,
        cashSession: null,
      }),
    );

    expect(await screen.findByText(/^caja$/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Una acci[oó]n clara:\s*Espere/i);
  });

  it('renders a sanitized error and never exposes technical detail', async () => {
    vi.spyOn(apiClient, 'getDashboardReport').mockRejectedValue(
      new ApiError('SQLSTATE[HY000]: stack trace in storage/logs/laravel.log', 500),
    );
    const onStatus = vi.fn();

    renderDashboard(makeBaseProps({ onStatus }));

    expect(await screen.findByRole('heading', { level: 2, name: /resumen no disponible/i })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/SQLSTATE|stack trace|storage\/logs/i);
    expect(screen.queryByText(/^0 facturas registradas hoy$/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('Actividad no disponible').length).toBeGreaterThan(0);
    expect(onStatus).not.toHaveBeenCalled();
  });

  it('distingue las notas del ledger mientras el resumen está cargando', () => {
    vi.spyOn(apiClient, 'getDashboardReport').mockReturnValue(new Promise(() => undefined));

    renderDashboard(makeBaseProps());

    expect(screen.getByText('Cargando facturación de hoy')).toBeVisible();
    expect(screen.getByText('Cargando pagos de hoy')).toBeVisible();
    expect(screen.getByText('Cargando saldos del mes')).toBeVisible();
    expect(screen.queryByText(/^0 facturas registradas hoy$/i)).not.toBeInTheDocument();
  });

  it('marca las cifras cacheadas como último dato conocido cuando falla la actualización', async () => {
    const queryClient = makeQueryClient();
    queryClient.setQueryData(queryKeys.reports.dashboard(), makeDashboardReport(), { updatedAt: 1 });
    vi.spyOn(apiClient, 'getDashboardReport').mockRejectedValue(new ApiError('Servidor local no disponible', 500));

    renderDashboard(makeBaseProps(), queryClient);

    expect(await screen.findByRole('heading', { level: 2, name: 'Resumen no disponible' })).toBeVisible();
    expect(screen.getByText('L 125.00')).toBeVisible();
    expect(screen.getAllByText(/^Último dato conocido/).length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText('2 facturas registradas hoy')).not.toBeInTheDocument();
    expect(screen.queryByText('Cobros pendientes')).not.toBeInTheDocument();
  });

  it('presenta el error de facturas recientes sin convertirlo en estado vacío y permite reintentar', async () => {
    const getInvoices = vi
      .spyOn(apiClient, 'getInvoices')
      .mockRejectedValueOnce(new ApiError('SQLSTATE recent invoices', 500))
      .mockResolvedValueOnce({
        data: [makeInvoice()],
        meta: { current_page: 1, per_page: 5, total: 1 },
      });

    renderDashboard(makeBaseProps());

    expect(await screen.findByRole('heading', { level: 2, name: 'Facturas recientes no disponibles' })).toBeVisible();
    expect(screen.queryByText('Sin facturas recientes')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/SQLSTATE recent invoices/i);

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar facturas recientes' }));

    expect(await screen.findByText('Paciente Demo')).toBeVisible();
    expect(getInvoices).toHaveBeenCalledTimes(2);
  });

  it('does not request the dashboard report when the user lacks managerial reports permission', async () => {
    const getDashboardReport = vi.spyOn(apiClient, 'getDashboardReport');

    renderDashboard(makeBaseProps({ canViewManagerialReports: false }));

    await waitFor(() => {
      expect(getDashboardReport).not.toHaveBeenCalled();
    });
  });

  it('hides recent invoices when the user cannot view invoice history', async () => {
    const getInvoices = vi.spyOn(apiClient, 'getInvoices');

    renderDashboard(
      makeBaseProps({
        canViewInvoices: false,
        cashSession: makeCashSession({ id: 9 }),
      }),
    );

    expect(await screen.findByText(/^caja$/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /facturas recientes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /ver historial/i })).not.toBeInTheDocument();
    expect(getInvoices).not.toHaveBeenCalled();
  });

  it('prioritizes setup in the operational queue only when needs_setup is true', async () => {
    mockSetupStatus(true);

    renderDashboard(makeBaseProps());

    expect((await screen.findAllByText(/configuración pendiente/i)).length).toBeGreaterThan(0);
  });

  it('bloquea acciones operativas mientras verifica setup-status', () => {
    vi.mocked(apiClient.request).mockReturnValue(new Promise(() => undefined));

    renderDashboard(makeBaseProps({ cashSession: makeCashSession() }));

    expect(screen.getByRole('heading', { level: 2, name: 'Verificando configuración operativa' })).toBeVisible();
    expect(screen.queryByRole('link', { name: /nueva factura|abrir caja/i })).not.toBeInTheDocument();
  });

  it('presenta el error de setup-status, bloquea la operación y permite reintentar', async () => {
    vi.mocked(apiClient.request)
      .mockRejectedValueOnce(new ApiError('SQLSTATE setup-status', 500))
      .mockResolvedValueOnce({
        needs_setup: false,
        steps: {
          fiscal_settings: true,
          admin_exists: true,
          catalog_has_services: true,
          fiscal_sequence_exists: true,
        },
      });

    renderDashboard(makeBaseProps({ cashSession: makeCashSession() }));

    expect(await screen.findByRole('heading', { level: 2, name: 'No se pudo verificar la configuración' })).toBeVisible();
    expect(document.body.textContent).not.toMatch(/SQLSTATE setup-status/i);
    expect(screen.queryByRole('link', { name: /nueva factura|abrir caja/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar configuración' }));

    expect(await screen.findByRole('link', { name: 'Nueva factura' })).toHaveAttribute('href', '/billing/new');
  });

  it('consulta setup-status también para un cajero sin permisos fiscales ni gerenciales', async () => {
    mockSetupStatus(true, { admin_exists: true });
    const request = vi.mocked(apiClient.request);

    renderDashboard(makeBaseProps({
      canEditFiscalSettings: false,
      canManageCatalog: false,
      canViewFiscalSettings: false,
      canViewManagerialReports: false,
    }));

    expect(await screen.findByText(/solicite a un administrador/i)).toBeVisible();
    expect(request).toHaveBeenCalledWith('/api/system/setup-status');
  });

  it('hace que setup domine la CTA y abre el wizard completo con permiso fiscal', async () => {
    mockSetupStatus(true, { admin_exists: true });

    renderDashboard(makeBaseProps({
      canEditFiscalSettings: true,
      canManageCatalog: true,
      canViewCatalog: true,
      canViewFiscalSettings: true,
      cashSession: makeCashSession(),
    }));

    const setupAction = await screen.findByRole('button', { name: 'Completar configuración' });
    expect(screen.queryByRole('link', { name: /nueva factura|abrir caja/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /revisar configuración/i })).not.toBeInTheDocument();

    fireEvent.click(setupAction);

    expect(await screen.findByRole('dialog', { name: 'Preparar caja' })).toBeInTheDocument();
    expect(screen.getByText('Hospital')).toBeInTheDocument();
    expect(screen.getByText('Numeración')).toBeInTheDocument();
    expect(screen.getByText('Catálogo')).toBeInTheDocument();
  });

  it('explica setup sin ofrecer edición cuando falta permiso fiscal', async () => {
    mockSetupStatus(true, { admin_exists: true });

    renderDashboard(makeBaseProps({
      canEditFiscalSettings: false,
      canManageCatalog: false,
      canViewCatalog: true,
      canViewFiscalSettings: true,
    }));

    expect(await screen.findByText(/solicite a un administrador/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Completar configuración' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /nueva factura|abrir caja|revisar configuración/i })).not.toBeInTheDocument();
  });

  it('dirige al editor fiscal cuando solo falta configuración fiscal', async () => {
    mockSetupStatus(true, { admin_exists: true, catalog_has_services: true });

    renderDashboard(makeBaseProps({ canEditFiscalSettings: true, canManageCatalog: false }));

    expect(await screen.findByRole('link', { name: 'Completar configuración fiscal' })).toHaveAttribute('href', '/settings/fiscal');
    expect(screen.queryByRole('button', { name: 'Completar configuración' })).not.toBeInTheDocument();
  });

  it('dirige al catálogo cuando solo faltan servicios y puede gestionarlos', async () => {
    mockSetupStatus(true, {
      admin_exists: true,
      fiscal_settings: true,
      fiscal_sequence_exists: true,
    });

    renderDashboard(makeBaseProps({
      canEditFiscalSettings: false,
      canManageCatalog: true,
      canViewFiscalSettings: false,
    }));

    expect(await screen.findByRole('link', { name: 'Completar catálogo' })).toHaveAttribute('href', '/catalog');
    expect(screen.queryByRole('button', { name: 'Completar configuración' })).not.toBeInTheDocument();
  });

  it('no ofrece el editor fiscal con escritura sin lectura efectiva', async () => {
    mockSetupStatus(true, { admin_exists: true, catalog_has_services: true });

    renderDashboard(makeBaseProps({
      canEditFiscalSettings: true,
      canViewFiscalSettings: false,
    }));

    expect(await screen.findByText(/solicite a un administrador/i)).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Completar configuración fiscal' })).not.toBeInTheDocument();
  });

  it('no ofrece el catálogo con gestión sin lectura efectiva', async () => {
    mockSetupStatus(true, {
      admin_exists: true,
      fiscal_settings: true,
      fiscal_sequence_exists: true,
    });

    renderDashboard(makeBaseProps({
      canManageCatalog: true,
      canViewCatalog: false,
    }));

    expect(await screen.findByText(/solicite a un administrador/i)).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Completar catálogo' })).not.toBeInTheDocument();
  });

  it('requiere lectura y escritura de ambos módulos para abrir el wizard', async () => {
    mockSetupStatus(true, { admin_exists: true });

    renderDashboard(makeBaseProps({
      canEditFiscalSettings: true,
      canManageCatalog: true,
      canViewCatalog: false,
      canViewFiscalSettings: true,
    }));

    expect(await screen.findByText(/solicite a un administrador/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Completar configuración' })).not.toBeInTheDocument();
  });

  it('hace que admin_exists falso domine y deriva la recuperación a un técnico autorizado', async () => {
    mockSetupStatus(true, { admin_exists: false });

    renderDashboard(makeBaseProps({ cashSession: makeCashSession() }));

    expect(await screen.findByText(/técnico autorizado.*crear o restaurar.*administrador/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Completar configuración' })).not.toBeInTheDocument();
    expect(screen.queryByText('Configuración lista')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /nueva factura|abrir caja/i })).not.toBeInTheDocument();
  });

  it('no agrega Facturación disponible a la queue mientras setup está incompleto', async () => {
    mockSetupStatus(true);

    renderDashboard(makeBaseProps({ cashSession: makeCashSession() }));

    expect(await screen.findByText('Configuración pendiente')).toBeVisible();
    expect(screen.queryByText('Facturación disponible')).not.toBeInTheDocument();
  });

  it('hides setup from the operational queue when needs_setup is false', async () => {
    mockSetupStatus(false);

    renderDashboard(makeBaseProps());

    await screen.findByText(/^caja$/i);
    expect(screen.queryByText(/configuración pendiente/i)).not.toBeInTheDocument();
  });

  it('prioriza la próxima acción del cajero y recompone módulos sin permiso', async () => {
    renderDashboard(
      makeBaseProps({
        canCreateInvoices: true,
        canViewManagerialReports: false,
      }),
    );

    expect(screen.getByRole('heading', { name: 'Continuar operación' })).toBeVisible();
    expect(screen.queryByText('Ingresos del mes')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Resumen financiero de hoy' })).not.toBeInTheDocument();
    expect(await screen.findByText('Paciente Demo')).toBeVisible();
    expect(screen.queryByRole('columnheader', { name: 'Total' })).not.toBeInTheDocument();
    expect(screen.queryByText('L 115.00')).not.toBeInTheDocument();
  });

  it('presenta cifras como ledger y no como stat cards', async () => {
    renderDashboard(makeBaseProps());

    expect(await screen.findByRole('region', { name: 'Resumen financiero de hoy' })).toBeVisible();
    expect(document.querySelector('[data-slot="stat-grid"]')).not.toBeInTheDocument();
  });

  it('renderiza Ver historial completo como control Ant Design dentro del enlace', async () => {
    renderDashboard(makeBaseProps());

    const link = await screen.findByRole('link', { name: 'Ver historial completo' });
    expect(link).toHaveAttribute('href', '/invoices');
    expect(link.querySelector('.ant-btn')).toBeInTheDocument();
  });
});
