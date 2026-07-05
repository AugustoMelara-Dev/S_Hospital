import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient, type CashSession, type Invoice } from '../../lib/api';
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
    canViewBackups: true,
    canViewCash: true,
    canViewCatalog: true,
    canViewFiscalSettings: true,
    canViewInvoices: true,
    canViewManagerialReports: true,
    canViewReports: true,
    cashSession: null,
    onQuickCash: vi.fn(),
    onQuickInvoice: vi.fn(),
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

function mockSetupStatus(needsSetup = false) {
  vi.spyOn(apiClient, 'request').mockResolvedValue({
    needs_setup: needsSetup,
    steps: {
      fiscal_settings: !needsSetup,
      admin_exists: !needsSetup,
      catalog_has_services: !needsSetup,
      fiscal_sequence_exists: !needsSetup,
    },
  });
}

function renderDashboard(props: React.ComponentProps<typeof DashboardView>) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardView {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DashboardView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockSetupStatus(false);
    vi.spyOn(apiClient, 'getDashboardReport').mockResolvedValue({
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
    });
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
    expect(headings[0]).toHaveTextContent(/^centro de mando$/i);

    expect(await screen.findByText(/^caja$/i)).toBeInTheDocument();
    expect(screen.getByText(/^facturado hoy$/i)).toBeInTheDocument();
    expect(screen.getByText(/^cobrado hoy$/i)).toBeInTheDocument();
    expect(screen.getByText(/^pendiente del mes$/i)).toBeInTheDocument();
  });

  it('shows open cash session label when there is one', async () => {
    renderDashboard(makeBaseProps({ cashSession: makeCashSession({ id: 12 }) }));

    expect((await screen.findAllByText(/caja #12/i)).length).toBeGreaterThan(0);
  });

  it('shows closed cash session label when there is no session', async () => {
    renderDashboard(makeBaseProps({ cashSession: null }));

    expect((await screen.findAllByText(/cerrada/i)).length).toBeGreaterThan(0);
  });

  it('exposes the open-cash quick action when there is no cash session', async () => {
    renderDashboard(makeBaseProps({ cashSession: null }));

    const openCash = await screen.findByRole('button', { name: /abrir caja desde el centro de mando/i });
    expect(openCash).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crear nueva factura/i })).not.toBeInTheDocument();
  });

  it('exposes the new-invoice quick action when there is a cash session', async () => {
    renderDashboard(makeBaseProps({ cashSession: makeCashSession({ id: 3 }) }));

    const newInvoice = await screen.findByRole('button', { name: /crear nueva factura/i });
    expect(newInvoice).toBeInTheDocument();
  });

  it('invokes the onQuickCash callback from the open-cash quick action', async () => {
    const onQuickCash = vi.fn();

    renderDashboard(makeBaseProps({ onQuickCash, cashSession: null }));

    const openCash = await screen.findByRole('button', { name: /abrir caja desde el centro de mando/i });
    await act(async () => {
      openCash.click();
    });
    expect(onQuickCash).toHaveBeenCalledTimes(1);
  });

  it('invokes the onQuickInvoice callback from the new-invoice quick action', async () => {
    const onQuickInvoice = vi.fn();

    renderDashboard(makeBaseProps({ onQuickInvoice, cashSession: makeCashSession({ id: 1 }) }));

    const newInvoice = await screen.findByRole('button', { name: /crear nueva factura/i });
    await act(async () => {
      newInvoice.click();
    });
    expect(onQuickInvoice).toHaveBeenCalledTimes(1);
  });

  it('hides both quick actions when the user cannot open cash or invoice', async () => {
    renderDashboard(
      makeBaseProps({
        canCreateInvoices: false,
        canViewCash: false,
        cashSession: null,
      }),
    );

    expect(await screen.findByText(/^caja$/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /abrir caja desde el inicio/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crear nueva factura/i })).not.toBeInTheDocument();
  });

  it('does not announce a fake primary action when no dashboard action is available', async () => {
    renderDashboard(
      makeBaseProps({
        canCreateInvoices: false,
        canViewCash: false,
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

    expect(await screen.findByText(/resumen no disponible/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/SQLSTATE|stack trace|storage\/logs/i);
    expect(onStatus).toHaveBeenCalledWith(expect.stringMatching(/servidor lan/i));
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

  it('renders a setup card only when needs_setup is true', async () => {
    mockSetupStatus(true);

    renderDashboard(makeBaseProps());

    expect((await screen.findAllByText(/configuracion pendiente/i)).length).toBeGreaterThan(0);
  });

  it('hides the setup card when needs_setup is false', async () => {
    mockSetupStatus(false);

    renderDashboard(makeBaseProps());

    await screen.findByText(/^caja$/i);
    expect(screen.queryByText(/configuracion pendiente/i)).not.toBeInTheDocument();
  });
});
