import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient, type CashSession } from '../../lib/api';
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

describe('DashboardView accessibility and behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockSetupStatus(false);
    vi.spyOn(apiClient, 'getDashboardReport').mockResolvedValue({
      current_month: {
        total_billed: '0.00',
        total_collected: '0.00',
        invoice_count: 0,
        payment_count: 0,
      },
      last_7_days: [],
      payments_by_method: { cash: '0.00', transfer: '0.00', card: '0.00', other: '0.00' },
      top_services: [],
      cashiers_summary: [],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a single accessible h1 from the page header', async () => {
    render(<DashboardView {...makeBaseProps()} />);

    const headings = await screen.findAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(/^centro de mando$/i);
  });

  it('renders the four top metric labels with the existing wording', async () => {
    render(<DashboardView {...makeBaseProps()} />);

    expect(await screen.findByText(/^caja$/i)).toBeInTheDocument();
    expect(screen.getByText(/^facturado$/i)).toBeInTheDocument();
    expect(screen.getByText(/^cobrado$/i)).toBeInTheDocument();
    expect(screen.getByText(/^facturas$/i)).toBeInTheDocument();
  });

  it('shows "Cerrada" when there is no cash session and "Caja #N" when there is', async () => {
    const { rerender } = render(<DashboardView {...makeBaseProps()} cashSession={null} />);
    expect((await screen.findAllByText(/cerrada/i)).length).toBeGreaterThan(0);

    rerender(<DashboardView {...makeBaseProps()} cashSession={makeCashSession({ id: 12 })} />);
    await waitFor(() => {
      expect(screen.getAllByText(/caja #12/i).length).toBeGreaterThan(0);
    });
  });

  it('exposes the open-cash quick action when there is no cash session', async () => {
    render(<DashboardView {...makeBaseProps({ cashSession: null })} />);

    const openCash = await screen.findByRole('button', { name: /abrir caja desde el inicio/i });
    expect(openCash).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crear nueva factura/i })).not.toBeInTheDocument();
  });

  it('exposes the new-invoice quick action when there is a cash session and the user can invoice', async () => {
    render(<DashboardView {...makeBaseProps({ cashSession: makeCashSession({ id: 3 }) })} />);

    const newInvoice = await screen.findByRole('button', { name: /crear nueva factura/i });
    expect(newInvoice).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /abrir caja desde el inicio/i })).not.toBeInTheDocument();
  });

  it('invokes the same onQuickCash callback when the open-cash button is pressed', async () => {
    const onQuickCash = vi.fn();

    render(<DashboardView {...makeBaseProps({ onQuickCash, cashSession: null })} />);

    const openCash = await screen.findByRole('button', { name: /abrir caja desde el inicio/i });
    openCash.click();
    expect(onQuickCash).toHaveBeenCalledTimes(1);
  });

  it('invokes the same onQuickInvoice callback when the new-invoice button is pressed', async () => {
    const onQuickInvoice = vi.fn();

    render(
      <DashboardView
        {...makeBaseProps({ onQuickInvoice, cashSession: makeCashSession({ id: 1 }) })}
      />,
    );

    const newInvoice = await screen.findByRole('button', { name: /crear nueva factura/i });
    newInvoice.click();
    expect(onQuickInvoice).toHaveBeenCalledTimes(1);
  });

  it('renders a safe empty quick-action message when the user cannot invoice or open cash', async () => {
    render(
      <DashboardView
        {...makeBaseProps({
          canCreateInvoices: false,
          canViewCash: false,
          cashSession: null,
        })}
      />,
    );

    expect(await screen.findByText(/no hay acciones disponibles para este usuario/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /abrir caja desde el inicio/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crear nueva factura/i })).not.toBeInTheDocument();
  });

  it('always keeps the LAN status reassurance card visible regardless of permissions', async () => {
    render(
      <DashboardView
        {...makeBaseProps({
          canViewManagerialReports: false,
          cashSession: null,
        })}
      />,
    );

    expect(await screen.findByText(/red local/i)).toBeInTheDocument();
    expect(
      screen.getByText(/los cobros y respaldos se guardan en el servidor del hospital/i),
    ).toBeInTheDocument();
  });
});

describe('DashboardView setup status card', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiClient, 'getDashboardReport').mockResolvedValue({
      current_month: {
        total_billed: '0.00',
        total_collected: '0.00',
        invoice_count: 0,
        payment_count: 0,
      },
      last_7_days: [],
      payments_by_method: { cash: '0.00', transfer: '0.00', card: '0.00', other: '0.00' },
      top_services: [],
      cashiers_summary: [],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('does not render the setup card when needs_setup is false', async () => {
    mockSetupStatus(false);
    render(<DashboardView {...makeBaseProps()} />);

    await screen.findByText(/^facturado$/i);
    expect(screen.queryByText(/configuracion pendiente/i)).not.toBeInTheDocument();
  });

  it('renders the setup card with all four steps when needs_setup is true', async () => {
    mockSetupStatus(true);
    render(<DashboardView {...makeBaseProps()} />);

    expect((await screen.findAllByText(/configuracion pendiente/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/datos del hospital/i)).toBeInTheDocument();
    expect(screen.getByText(/usuario administrador/i)).toBeInTheDocument();
    expect(screen.getByText(/catalogo/i)).toBeInTheDocument();
    expect(screen.getByText(/rango fiscal/i)).toBeInTheDocument();
  });

  it('hides the review button when the user cannot view fiscal settings', async () => {
    mockSetupStatus(true);
    render(<DashboardView {...makeBaseProps({ canViewFiscalSettings: false })} />);

    expect((await screen.findAllByText(/configuracion pendiente/i)).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('button', { name: /revisar configuracion pendiente/i }),
    ).not.toBeInTheDocument();
  });

  it('opens the setup wizard when the review button is clicked', async () => {
    mockSetupStatus(true);
    render(<DashboardView {...makeBaseProps()} />);

    const review = await screen.findByRole('button', { name: /revisar configuracion pendiente/i });
    await act(async () => {
      review.click();
    });
    // The dialog is rendered as a Radix portal; we only assert it mounted by checking
    // that the wizard's first-step content appears in the document.
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/preparar caja|datos del hospital|paso 1/i);
    });
  });
});

describe('DashboardView loading, error and partial states', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockSetupStatus(false);
  });

  afterEach(() => {
    cleanup();
  });

  it('retries fetching the dashboard data when retry is pressed on the revenue error state', async () => {
    const getDashboardReport = vi
      .spyOn(apiClient, 'getDashboardReport')
      .mockRejectedValueOnce(new ApiError('SQLSTATE[...]', 500))
      .mockResolvedValueOnce({
        current_month: {
          total_billed: '10.00',
          total_collected: '5.00',
          invoice_count: 1,
          payment_count: 1,
        },
        last_7_days: [],
        payments_by_method: { cash: '0.00', transfer: '0.00', card: '0.00', other: '0.00' },
        top_services: [],
        cashiers_summary: [],
      });

    render(<DashboardView {...makeBaseProps()} />);

    const retry = await screen.findAllByRole('button', { name: /reintentar/i });
    expect(retry.length).toBeGreaterThan(0);
    await act(async () => {
      retry[0].click();
    });

    await waitFor(() => {
      expect(getDashboardReport).toHaveBeenCalledTimes(2);
    });
  });

  it('shows the LAN reassurance message and a safe status callback on server failure', async () => {
    vi.spyOn(apiClient, 'getDashboardReport').mockRejectedValue(
      new ApiError('SQLSTATE[HY000]: stack trace in storage/logs/laravel.log', 500),
    );
    const onStatus = vi.fn();

    render(<DashboardView {...makeBaseProps({ onStatus })} />);

    expect(await screen.findByText(/red local/i)).toBeInTheDocument();
    expect(onStatus).toHaveBeenCalledWith(expect.stringMatching(/servidor lan/i));
    expect(document.body.textContent).not.toMatch(/SQLSTATE|stack trace|storage\/logs/i);
  });

  it('does not request the dashboard report when the user lacks managerial reports permission', async () => {
    const getDashboardReport = vi.spyOn(apiClient, 'getDashboardReport');

    render(<DashboardView {...makeBaseProps({ canViewManagerialReports: false })} />);

    await waitFor(() => {
      expect(getDashboardReport).not.toHaveBeenCalled();
    });
  });

  it('marks sections as permission-locked for users without managerial reports access', async () => {
    render(<DashboardView {...makeBaseProps({ canViewManagerialReports: false })} />);

    expect(
      await screen.findAllByText(/sin permiso para ver este resumen/i),
    ).not.toHaveLength(0);
    // The revenue chart container should not render the chart itself.
    expect(screen.queryByText(/cargando facturacion y cobros/i)).not.toBeInTheDocument();
  });

  it('renders the refresh button with an accessible name when the user has managerial reports', async () => {
    render(<DashboardView {...makeBaseProps()} />);

    const refresh = await screen.findByRole('button', {
      name: /actualizar facturacion y cobros/i,
    });
    expect(refresh).toBeInTheDocument();
  });
});
