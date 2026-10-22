import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient, type AuthUser, type Invoice, type Payment } from '@/lib/api';
import { AdminSessionProvider } from '@/shell/admin/AdminSessionContext';
import { RecibosView } from './RecibosView';

function authUser(permissions: string[]): AuthUser {
  return {
    id: 1,
    name: 'Admin Hospital',
    email: 'admin@hospital.local',
    username: 'admin',
    active: true,
    roles: ['admin'],
    permissions,
    must_change_password: false,
  };
}

function invoiceFixture(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1,
    invoice_number: '000-001-01-00000001',
    patient_name: 'Paciente Recibos',
    subtotal: '100.00',
    tax_amount: '15.00',
    discount_amount: '0.00',
    total: '115.00',
    paid_amount: '115.00',
    balance_due: '0.00',
    status: 'paid',
    issued_at: '2026-09-18T12:00:00.000000Z',
    items: [],
    ...overrides,
  };
}

function paymentFixture(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 5,
    invoice_id: 7,
    cash_session_id: 3,
    user_id: 1,
    method: 'cash',
    amount: '115.00',
    reference: null,
    status: 'posted',
    paid_at: '2026-09-18T12:05:00.000000Z',
    ...overrides,
  };
}

function renderView(permissions: string[], initialEntries = ['/recibos']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  const onStatus = vi.fn();
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <AdminSessionProvider
          user={authUser(permissions)}
          cashSession={null}
          cashSessionLoading={false}
          onStatus={onStatus}
        >
          <RecibosView />
        </AdminSessionProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { ...result, onStatus, queryClient };
}

describe('RecibosView', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra el estado sin permiso sin inventar contenido', () => {
    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [],
      meta: { current_page: 1, per_page: 10, total: 0 },
    });

    renderView([]);

    expect(screen.getByText(/sin permiso para consultar recibos/i)).toBeInTheDocument();
    expect(screen.getByText(/solicite acceso a recibos a un administrador/i)).toBeInTheDocument();
    expect(screen.queryByText(/receipts\.view|invoices\.view/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('distingue el estado de carga con role status', () => {
    vi.spyOn(apiClient, 'getInvoices').mockReturnValue(new Promise<never>(() => undefined));

    renderView(['invoices.view']);

    expect(screen.getByRole('status', { name: /cargando operaciones/i })).toBeInTheDocument();
  });

  it('distingue "sin operaciones" de "sin coincidencias"', async () => {
    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [],
      meta: { current_page: 1, per_page: 10, total: 0 },
    });

    renderView(['invoices.view']);
    expect(await screen.findByText(/aún no hay operaciones registradas/i)).toBeInTheDocument();
  });

  it('ofrece limpiar filtros cuando no hay coincidencias', async () => {
    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [],
      meta: { current_page: 1, per_page: 10, total: 0 },
    });

    renderView(['invoices.view'], ['/recibos?q=zzz']);
    expect(await screen.findByText(/sin coincidencias con la búsqueda/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /limpiar filtros/i })).toBeInTheDocument();
  });

  it('muestra un error con Reintentar y conserva los filtros', async () => {
    vi.spyOn(apiClient, 'getInvoices').mockRejectedValue(new Error('LAN caída'));

    renderView(['invoices.view'], ['/recibos?q=maria']);
    expect(await screen.findByText(/no se pudo cargar el historial/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/paciente o número/i)).toBeInTheDocument();
  });

  it('muestra el contexto aplicado (chips) y el rango visible de la página', async () => {
    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [invoiceFixture({ id: 3, invoice_number: '000-001-01-00000003', patient_name: 'María López' })],
      meta: { current_page: 1, per_page: 10, total: 1 },
    });

    renderView(['invoices.view'], ['/recibos?q=maria']);

    const results = await screen.findByRole('table', { name: /operaciones filtradas/i });
    expect(within(results).getByText('María López')).toBeInTheDocument();
    expect(screen.getByText('Paciente maria')).toBeInTheDocument();
    expect(screen.getByText(/1–1 de 1/)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /paginación de facturas/i })).toBeInTheDocument();
  });

  it('abre el detalle por deep link ?operacion= con operación, pagos y documento', async () => {
    const summary = invoiceFixture({ id: 7, invoice_number: '000-001-01-00000007', patient_name: 'Paciente Detalle' });
    const detail = invoiceFixture({
      id: 7,
      invoice_number: '000-001-01-00000007',
      patient_name: 'Paciente Detalle',
      institutional_receipt: {
        id: 90,
        receipt_number_full: 'REC-A-00000090',
        status: 'issued',
        issued_at: '2026-09-18T12:05:00.000000Z',
        reprint_count: 0,
        copy_mode: 'original_only',
        print_events_count: 0,
        has_print_events: false,
      },
      items: [
        {
          id: 1,
          service_id: 1,
          service_name: 'Eritropoyetina',
          category_id: 1,
          category_name: 'Medicamentos',
          quantity: '1.00',
          unit_price: '25.00',
          tax_rate: '0.00',
          tax_amount: '0.00',
          line_subtotal: '25.00',
          line_total: '0.00',
          special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
          special_rule_applied: true,
          notes: null,
        },
      ],
      payments: [paymentFixture()],
    });

    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [summary],
      meta: { current_page: 1, per_page: 10, total: 1 },
    });
    const getInvoice = vi.spyOn(apiClient, 'getInvoice').mockResolvedValue(detail);

    renderView(['invoices.view', 'receipts.view'], ['/recibos?operacion=7']);

    const panel = await screen.findByRole('complementary', { name: /detalle de la operación/i });
    await waitFor(() => expect(getInvoice).toHaveBeenCalledWith(7));
    expect(within(panel).getByText('Paciente Detalle')).toBeInTheDocument();
    expect(within(panel).getByText(/Efectivo/)).toBeInTheDocument();
    expect(within(panel).getByText(/sin cobro por receta/i)).toBeInTheDocument();
    expect(within(panel).getByText('REC-A-00000090')).toBeInTheDocument();
  });

  it('abre el detalle desde la tabla e inicia la reimpresión sin el legacy', async () => {
    const user = userEvent.setup();
    const summary = invoiceFixture({ id: 7, invoice_number: '000-001-01-00000007', patient_name: 'Paciente Detalle' });
    const detail = invoiceFixture({
      id: 7,
      invoice_number: '000-001-01-00000007',
      patient_name: 'Paciente Detalle',
      institutional_receipt: {
        id: 90,
        receipt_number_full: 'REC-A-00000090',
        status: 'issued',
        issued_at: '2026-09-18T12:05:00.000000Z',
        reprint_count: 0,
        copy_mode: 'original_only',
        print_events_count: 0,
        has_print_events: false,
      },
      payments: [paymentFixture()],
    });

    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [summary],
      meta: { current_page: 1, per_page: 10, total: 1 },
    });
    const getInvoice = vi.spyOn(apiClient, 'getInvoice').mockResolvedValue(detail);

    renderView(['invoices.view', 'receipts.view', 'receipts.reprint', 'receipts.reprint_any']);

    // Detalle desde la fila de la tabla de escritorio (no deep link): el helper
    // reubicado `issuedInstitutionalReceipt` debe seguir resolviendo el
    // comprobante. La lista móvil duplica el botón, así que se acota a la tabla.
    const resultsTable = await screen.findByRole('table', { name: /operaciones filtradas/i });
    await user.click(
      within(resultsTable).getByRole('button', { name: /más acciones de la operación/i }),
    );
    expect(screen.queryByRole('complementary', { name: /detalle de la operación/i })).not.toBeInTheDocument();
    expect(getInvoice).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('menuitem', { name: /^Detalle$/ }));

    const panel = await screen.findByRole('complementary', { name: /detalle de la operación/i });
    await waitFor(() => expect(getInvoice).toHaveBeenCalledWith(7));
    await waitFor(() => expect(panel).toHaveFocus());
    expect(panel).toHaveClass('order-1', '2xl:order-2');
    expect(screen.getByRole('region', { name: /resultados del historial/i })).toHaveClass(
      'order-2',
      '2xl:order-1',
    );
    expect(within(panel).getByText('Paciente Detalle')).toBeInTheDocument();
    expect(within(panel).getByText('REC-A-00000090')).toBeInTheDocument();

    // Reimpresión desde el detalle: abre el diálogo auditado (motivo humano).
    await user.click(within(panel).getByRole('button', { name: /reimprimir con motivo/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Reimprimir 000-001-01-00000007/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/motivo/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /cancelar/i }));
    await user.click(within(panel).getByRole('button', { name: /cerrar detalle/i }));
    await waitFor(() => {
      expect(screen.queryByRole('complementary', { name: /detalle de la operación/i })).not.toBeInTheDocument();
      expect(document.querySelector<HTMLElement>('[data-invoice-detail-trigger="7"]')).toHaveFocus();
    });
  });
});
