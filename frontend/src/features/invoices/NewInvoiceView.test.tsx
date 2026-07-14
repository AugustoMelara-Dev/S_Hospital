import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode, type ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NewInvoiceView } from './NewInvoiceView';
import { newInvoiceReducer } from './state/reducer';
import { getInitialNewInvoiceState } from './state/types';
import { apiClient, type Service, type CashSession } from '../../lib/api';
import * as apiBase from '@/lib/api/base';
import { queryKeys } from '@/lib/queryKeys';
import { downloadBlob, openBlobInNewTab } from '@/lib/download';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getLogo: vi.fn().mockResolvedValue(null),
    },
  };
});

vi.mock('@/lib/download', () => ({
  downloadBlob: vi.fn(),
  openBlobInNewTab: vi.fn(),
  institutionalReceiptPdfFilename: (receiptNumber: string) => `recibo-institucional-${receiptNumber}.pdf`,
}));

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: 10,
    category_id: 1,
    area_id: 1,
    name: 'Eritropoyetina',
    aliases: null,
    slug: 'eritropoyetina',
    scan_code: 'MED-ERI-001',
    barcode: null,
    qr_code: null,
    price: '25.00',
    taxable: true,
    active: true,
    visible_in_billing: true,
    is_billable: true,
    special_rule_code: null,
    category: { id: 1, name: 'Medicamentos', slug: 'medicamentos', active: true, sort_order: 4 },
    area: { id: 1, name: 'Farmacia', slug: 'farmacia', active: true },
    ...overrides,
  } as Service;
}

function makeOpenCashSession(): CashSession {
  return {
    id: 7,
    user_id: 2,
    opening_amount: '500.00',
    closing_amount: null,
    expected_amount: null,
    difference_amount: null,
    status: 'open',
    opening_notes: null,
    closing_notes: null,
    opened_at: '2026-05-17T08:00:00-06:00',
    closed_at: null,
  };
}

function openCashSessionResponse(): Response {
  return { ok: true, json: async () => ({ data: makeOpenCashSession() }) } as Response;
}

function mockFetchForOpenCashWithService(): ReturnType<typeof vi.fn> {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('/api/cash-sessions/current')) {
      return openCashSessionResponse();
    }
    if (url.includes('/api/services')) {
      return { ok: true, json: async () => ({ data: [makeService()] }) } as Response;
    }
    if (url.includes('/api/categories')) {
      return { ok: true, json: async () => ({ data: [] }) } as Response;
    }
    if (url.includes('/api/settings/operational')) {
      return {
        ok: true,
        json: async () => ({
          data: { scanner_enabled: false, partial_payments_enabled: false },
        }),
      } as Response;
    }
    return { ok: true, json: async () => ({ data: null }) } as Response;
  });
}

function renderNewInvoice(
  cashSession: CashSession | null = makeOpenCashSession(),
  overrides: Partial<ComponentProps<typeof NewInvoiceView>> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/billing/new']}>
        <NewInvoiceView
          cashSession={cashSession}
          canCreatePayments={overrides.canCreatePayments ?? true}
          canMarkDialysisPrescription={overrides.canMarkDialysisPrescription ?? false}
          canOpenCash
          canViewCatalog
          canViewReceipts={overrides.canViewReceipts ?? true}
          onOpenCash={vi.fn()}
          onStatus={overrides.onStatus ?? vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function waitForPointOfSaleLoad() {
  await waitFor(() => {
    expect(screen.getByText(/busque o elija/i)).toBeInTheDocument();
  });
}

function addErythropoietinAndOpenAccount(options: { openAccount?: boolean } = {}) {
  void options;
  fireEvent.click(screen.getByRole('button', { name: /agregar eritropoyetina/i }));
}

describe('NewInvoiceView critical flows', () => {
  beforeEach(() => {
    mockFetchForOpenCashWithService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the patient input, service search and action button when cash session is open', async () => {
    renderNewInvoice();
    await waitForPointOfSaleLoad();

    expect(screen.getByLabelText(/nombre del paciente/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/buscar por nombre/i)).toBeInTheDocument();
  });

  it('does not repeat the initial services request before the cashier searches', async () => {
    renderNewInvoice();
    await waitForPointOfSaleLoad();

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;

    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/services')).length).toBe(1);
  });

  it('deduplicates the initial point-of-sale load under React StrictMode', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/billing/new']}>
            <NewInvoiceView
              cashSession={makeOpenCashSession()}
              canCreatePayments
              canOpenCash
              canViewCatalog
              canViewReceipts
              onOpenCash={vi.fn()}
              onStatus={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      </StrictMode>,
    );

    await waitForPointOfSaleLoad();
    await new Promise((resolve) => setTimeout(resolve, 350));

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/services'))).toHaveLength(1);
  });

  it('does not show success dialog before an invoice is issued', async () => {
    renderNewInvoice();
    await waitForPointOfSaleLoad();

    expect(screen.queryByRole('dialog', { name: /factura emitida/i })).not.toBeInTheDocument();
  });

  it('does not show receipt dialog before an invoice is issued', async () => {
    renderNewInvoice();
    await waitForPointOfSaleLoad();

    expect(screen.queryByRole('dialog', { name: /comprobante de factura/i })).not.toBeInTheDocument();
  });

  it('reports contextual service additions without opening a duplicate toast', async () => {
    const onStatus = vi.fn();
    renderNewInvoice(makeOpenCashSession(), { onStatus });
    await waitForPointOfSaleLoad();

    fireEvent.change(screen.getByLabelText(/buscar por nombre/i), { target: { value: 'eritro' } });
    await waitFor(() => expect(screen.getByRole('button', { name: /agregar eritropoyetina/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /agregar eritropoyetina/i }));

    expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({
      key: 'billing-service-added',
      level: 'success',
      toast: false,
    }));
  });
  it('uses local server wording when initial point-of-sale data cannot load', async () => {
    const onStatus = vi.fn();
    vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/settings/operational')) {
        return {
          ok: true,
          json: async () => ({ data: { scanner_enabled: false, partial_payments_enabled: false } }),
        } as Response;
      }
      throw new TypeError(`No connection for ${url}`);
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/billing/new']}>
          <NewInvoiceView
            cashSession={null}
            canCreatePayments
            canOpenCash
            canViewCatalog
            canViewReceipts
            onOpenCash={vi.fn()}
            onStatus={onStatus}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({
        key: 'billing-services-load',
        level: 'error',
        message: expect.stringMatching(/servidor local/i),
        toast: false,
      }));
    });
    expect(onStatus).not.toHaveBeenCalledWith(expect.stringMatching(/servidor LAN/i));
  });

  it('does not call emit twice when Emit button is double-clicked', async () => {
    renderNewInvoice();
    await waitForPointOfSaleLoad();

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;

    const patientInput = screen.getByLabelText(/nombre del paciente/i);
    fireEvent.change(patientInput, { target: { value: 'Maria Lopez' } });

    const searchInput = screen.getByLabelText(/buscar por nombre/i);
    fireEvent.change(searchInput, { target: { value: 'eritro' } });

    await waitFor(() => {
      expect(screen.getByText('Eritropoyetina')).toBeInTheDocument();
    }, { timeout: 3000 });

    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/services')).length).toBe(2);
    });

    addErythropoietinAndOpenAccount();

    fetchMock.mockClear();

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /emitir/i })[0]);
      fireEvent.click(screen.getAllByRole('button', { name: /emitir/i })[0]);
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /confirmar emis/i })).toBeInTheDocument();
    });

    const invoiceCalls = fetchMock.mock.calls.filter(
      ([url]) => typeof url === 'string' && url.includes('/api/billing/invoices') && !String(url).includes('?'),
    );
    expect(invoiceCalls.length).toBeLessThanOrEqual(1);
  });

  it('does not create duplicate invoices when the final confirmation is double-clicked', async () => {
    vi.spyOn(apiBase, 'createClientIdempotencyKey').mockReturnValue('invoice-double-submit-1');
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const invoiceIdempotencyKeys: Array<string | null> = [];
    let resolveInvoice!: (response: Response) => void;

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/cash-sessions/current')) {
        return { ok: true, json: async () => ({ data: makeOpenCashSession() }) } as Response;
      }
      if (url.includes('/api/services')) {
        return { ok: true, json: async () => ({ data: [makeService()] }) } as Response;
      }
      if (url.includes('/api/categories')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }
      if (url.includes('/api/settings/operational')) {
        return {
          ok: true,
          json: async () => ({ data: { scanner_enabled: false, partial_payments_enabled: false } }),
        } as Response;
      }
      if (url.endsWith('/api/invoices')) {
        const headers = new Headers((init as RequestInit | undefined)?.headers);
        invoiceIdempotencyKeys.push(headers.get('Idempotency-Key'));

        return new Promise<Response>((resolve) => {
          resolveInvoice = resolve;
        });
      }
      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    renderNewInvoice();
    await waitForPointOfSaleLoad();

    fireEvent.change(screen.getByLabelText(/nombre del paciente/i), { target: { value: 'Maria Lopez' } });
    fireEvent.change(screen.getByLabelText(/buscar por nombre/i), { target: { value: 'eritro' } });
    await waitFor(() => expect(screen.getByText('Eritropoyetina')).toBeInTheDocument(), { timeout: 3000 });
    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/services')).length).toBe(2);
    });
    addErythropoietinAndOpenAccount();
    fireEvent.click(await screen.findByRole('button', { name: /^emitir y cobrar$/i }));

    const confirmButton = await screen.findByRole('button', { name: /emitir y abrir cobro/i });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(invoiceIdempotencyKeys).toEqual(['invoice-double-submit-1']);
    });

    resolveInvoice({
      ok: true,
      json: async () => ({
        data: {
          id: 64,
          invoice_number: '000-001-01-00000064',
          patient_name: 'Maria Lopez',
          status: 'issued',
          subtotal: '25.00',
          tax_amount: '0.00',
          discount_amount: '0.00',
          total: '25.00',
          paid_amount: '0.00',
          balance_due: '25.00',
          issued_at: '2026-05-17T09:25:00-06:00',
          items: [],
        },
      }),
    } as Response);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /registrar pago/i })).toBeInTheDocument();
    });
  });

  it('preserves the cart after a 422 error from the backend', async () => {
    renderNewInvoice();
    await waitForPointOfSaleLoad();

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;

    const patientInput = screen.getByLabelText(/nombre del paciente/i);
    fireEvent.change(patientInput, { target: { value: 'Maria Lopez' } });

    const searchInput = screen.getByLabelText(/buscar por nombre/i);
    fireEvent.change(searchInput, { target: { value: 'eritro' } });

    await waitFor(() => {
      expect(screen.getByText('Eritropoyetina')).toBeInTheDocument();
    }, { timeout: 3000 });

    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/services')).length).toBe(2);
    });

    addErythropoietinAndOpenAccount();

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/cash-sessions/current')) {
        return openCashSessionResponse();
      }
      if (url.endsWith('/api/invoices')) {
        return {
          ok: false,
          status: 422,
          json: async () => ({
            message: 'Error de validacion',
            errors: { patient_name: ['Requerido'] },
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    fireEvent.click(screen.getAllByRole('button', { name: /emitir/i })[0]);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /confirmar emis/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /emitir y abrir cobro/i }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/invoices'))).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getAllByText('Eritropoyetina').length).toBeGreaterThan(0);
    });

    expect(screen.getByText(/patient name: requerido/i)).toBeInTheDocument();
  });

  it('rejects whitespace-only patient names from keyboard emission', async () => {
    renderNewInvoice();
    await waitForPointOfSaleLoad();

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;

    const patientInput = screen.getByLabelText(/nombre del paciente/i);
    fireEvent.change(patientInput, { target: { value: '   ' } });
    fetchMock.mockClear();

    fireEvent.keyDown(patientInput, { key: 'Enter', ctrlKey: true });

    expect(await screen.findByText(/nombre del paciente es requerido/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /confirmar emis/i })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/invoices'))).toBe(false);
  });

  it('trims patient name before creating the invoice', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    let invoicePayload: unknown = null;

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/cash-sessions/current')) {
        return { ok: true, json: async () => ({ data: makeOpenCashSession() }) } as Response;
      }
      if (url.includes('/api/services')) {
        return { ok: true, json: async () => ({ data: [makeService()] }) } as Response;
      }
      if (url.includes('/api/categories')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }
      if (url.includes('/api/settings/operational')) {
        return {
          ok: true,
          json: async () => ({ data: { scanner_enabled: false, partial_payments_enabled: false } }),
        } as Response;
      }
      if (url.endsWith('/api/invoices')) {
        invoicePayload = JSON.parse(String(init?.body ?? '{}'));
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 60,
              invoice_number: '000-001-01-00000060',
              patient_name: 'Maria Lopez',
              status: 'issued',
              subtotal: '25.00',
              tax_amount: '0.00',
              discount_amount: '0.00',
              total: '25.00',
              paid_amount: '0.00',
              balance_due: '25.00',
              issued_at: '2026-05-17T09:10:00-06:00',
              items: [],
            },
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    renderNewInvoice();
    await waitForPointOfSaleLoad();

    fireEvent.change(screen.getByLabelText(/nombre del paciente/i), { target: { value: '  Maria Lopez  ' } });
    fireEvent.change(screen.getByLabelText(/buscar por nombre/i), { target: { value: 'eritro' } });
    await waitFor(() => expect(screen.getByText('Eritropoyetina')).toBeInTheDocument(), { timeout: 3000 });
    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/services')).length).toBe(2);
    });
    addErythropoietinAndOpenAccount();
    fireEvent.click(await screen.findByRole('button', { name: /^emitir y cobrar$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /emitir y abrir cobro/i }));

    await waitFor(() => expect(invoicePayload).toEqual(expect.objectContaining({
      patient_name: 'Maria Lopez',
    })));
  });

  it('prefills payment amount, clears a residual reference and submits exact cash with Ctrl+Enter', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    let paymentPayload: unknown = null;

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/cash-sessions/current')) {
        return { ok: true, json: async () => ({ data: makeOpenCashSession() }) } as Response;
      }
      if (url.includes('/api/services')) {
        return { ok: true, json: async () => ({ data: [makeService({ taxable: false })] }) } as Response;
      }
      if (url.includes('/api/categories')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }
      if (url.includes('/api/settings/operational')) {
        return {
          ok: true,
          json: async () => ({ data: { scanner_enabled: false, partial_payments_enabled: false } }),
        } as Response;
      }
      if (url.endsWith('/api/invoices')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 70,
              invoice_number: '000-001-01-00000070',
              patient_name: 'Maria Lopez',
              status: 'issued',
              subtotal: '25.00',
              tax_amount: '0.00',
              discount_amount: '0.00',
              total: '25.00',
              paid_amount: '0.00',
              balance_due: '25.00',
              issued_at: '2026-05-17T09:10:00-06:00',
              items: [],
            },
          }),
        } as Response;
      }
      if (url.endsWith('/api/invoices/70/payments')) {
        paymentPayload = JSON.parse(String(init?.body ?? '{}'));
        return {
          ok: true,
          json: async () => ({
            data: {
              payment: {
                id: 107,
                invoice_id: 70,
                cash_session_id: 7,
                user_id: 2,
                method: 'cash',
                amount: '25.00',
                reference: null,
                status: 'posted',
                paid_at: '2026-05-17T09:11:00-06:00',
              },
              invoice: {
                id: 70,
                invoice_number: '000-001-01-00000070',
                patient_name: 'Maria Lopez',
                status: 'paid',
                subtotal: '25.00',
                tax_amount: '0.00',
                discount_amount: '0.00',
                total: '25.00',
                paid_amount: '25.00',
                balance_due: '0.00',
                issued_at: '2026-05-17T09:10:00-06:00',
                items: [],
              },
              institutional_receipt: null,
              institutional_receipt_error: null,
              receipt_outcome: 'recovery_required',
            },
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    renderNewInvoice();
    await waitForPointOfSaleLoad();

    fireEvent.change(screen.getByLabelText(/nombre del paciente/i), { target: { value: 'Maria Lopez' } });
    fireEvent.change(screen.getByLabelText(/buscar por nombre/i), { target: { value: 'eritro' } });
    await waitFor(() => expect(screen.getByText('Eritropoyetina')).toBeInTheDocument(), { timeout: 3000 });
    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/services')).length).toBe(2);
    });
    addErythropoietinAndOpenAccount();
    fireEvent.click(await screen.findByRole('button', { name: /^emitir y cobrar$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /emitir y abrir cobro/i }));

    const amountInput = await screen.findByLabelText(/monto recibido/i);
    expect(amountInput).toHaveValue('25.00');

    fireEvent.click(screen.getByRole('radio', { name: 'Transferencia' }));
    fireEvent.change(screen.getByLabelText(/referencia de pago/i), { target: { value: 'TX-RESIDUAL' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Efectivo' }));

    fireEvent.keyDown(amountInput, { key: 'Enter', code: 'Enter', ctrlKey: true });

    await waitFor(() => {
      expect(paymentPayload).toEqual(expect.objectContaining({ amount: '25.00', method: 'cash', reference: null }));
    });
    expect(await screen.findByRole('dialog', { name: /factura pagada/i })).toBeInTheDocument();
    expect(screen.getByText('Efectivo')).toBeInTheDocument();
    expect(screen.getByText(/17\/05\/2026/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /nueva factura/i }));
    expect(screen.getByLabelText(/nombre del paciente/i)).toHaveValue('');
    expect(screen.queryByText(/17\/05\/2026/)).not.toBeInTheDocument();
  });

  it('sends dialysis prescription only as an invoice-level flag', async () => {
    const erythropoietin = makeService({ special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION' });
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    let invoicePayload: unknown = null;

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/cash-sessions/current')) {
        return { ok: true, json: async () => ({ data: makeOpenCashSession() }) } as Response;
      }
      if (url.includes('/api/services')) {
        return { ok: true, json: async () => ({ data: [erythropoietin] }) } as Response;
      }
      if (url.includes('/api/categories')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }
      if (url.includes('/api/settings/operational')) {
        return {
          ok: true,
          json: async () => ({ data: { scanner_enabled: false, partial_payments_enabled: false } }),
        } as Response;
      }
      if (url.endsWith('/api/invoices')) {
        invoicePayload = JSON.parse(String(init?.body ?? '{}'));
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 59,
              invoice_number: '000-001-01-00000059',
              patient_name: 'Maria Lopez',
              status: 'paid',
              subtotal: '0.00',
              tax_amount: '0.00',
              discount_amount: '0.00',
              total: '0.00',
              paid_amount: '0.00',
              balance_due: '0.00',
              issued_at: '2026-05-17T09:05:00-06:00',
              items: [],
            },
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    renderNewInvoice(makeOpenCashSession(), { canMarkDialysisPrescription: true });
    await waitForPointOfSaleLoad();

    fireEvent.change(screen.getByLabelText(/nombre del paciente/i), { target: { value: 'Maria Lopez' } });
    fireEvent.change(screen.getByLabelText(/buscar por nombre/i), { target: { value: 'eritro' } });

    await waitFor(() => expect(screen.getByText('Eritropoyetina')).toBeInTheDocument(), { timeout: 3000 });
    addErythropoietinAndOpenAccount();
    fireEvent.click(screen.getByRole('checkbox', { name: /receta de di/i }));

    fireEvent.click(await screen.findByRole('button', { name: /^emitir y cobrar$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /confirmar emis/i }));

    await waitFor(() => expect(invoicePayload).toEqual({
      patient_name: 'Maria Lopez',
      dialysis_prescription: true,
      items: [{ service_id: erythropoietin.id, quantity: '1' }],
    }));
  });

  it('shows a human pending-payment warning when the cashier cannot collect after emitting', async () => {
    renderNewInvoice(makeOpenCashSession(), { canCreatePayments: false });
    await waitForPointOfSaleLoad();

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;

    fireEvent.change(screen.getByLabelText(/nombre del paciente/i), { target: { value: 'Maria Lopez' } });
    fireEvent.change(screen.getByLabelText(/buscar por nombre/i), { target: { value: 'eritro' } });

    await waitFor(() => {
      expect(screen.getByText('Eritropoyetina')).toBeInTheDocument();
    }, { timeout: 3000 });

    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/services')).length).toBe(2);
    });

    addErythropoietinAndOpenAccount();

    const emitButton = await screen.findByRole('button', { name: /^emitir factura$/i });

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/cash-sessions/current')) {
        return openCashSessionResponse();
      }
      if (url.endsWith('/api/invoices')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 55,
              invoice_number: '000-001-01-00000055',
              patient_name: 'Maria Lopez',
              status: 'issued',
              total: '25.00',
              balance_due: '25.00',
              paid_amount: '0.00',
              issued_at: '2026-05-17T08:30:00-06:00',
              items: [],
            },
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    fireEvent.click(emitButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /confirmar factura/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /confirmar emis/i }));

    expect((await screen.findAllByText(/pendiente de cobro/i)).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /cobrar ahora/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nueva factura/i })).toBeInTheDocument();
    expect(screen.queryByText(/permisos completos/i)).not.toBeInTheDocument();
  });

  it('keeps payment registered without requesting fallback receipt when institutional receipt is missing after collection', async () => {
    const onStatus = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/billing/new']}>
          <NewInvoiceView
            cashSession={makeOpenCashSession()}
            canCreatePayments
            canOpenCash
            canViewCatalog
            canViewReceipts
            onOpenCash={vi.fn()}
            onStatus={onStatus}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitForPointOfSaleLoad();

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;

    fireEvent.change(screen.getByLabelText(/nombre del paciente/i), { target: { value: 'Maria Lopez' } });
    fireEvent.change(screen.getByLabelText(/buscar por nombre/i), { target: { value: 'eritro' } });

    await waitFor(() => {
      expect(screen.getByText('Eritropoyetina')).toBeInTheDocument();
    }, { timeout: 3000 });

    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/services')).length).toBe(2);
    });

    addErythropoietinAndOpenAccount();

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/cash-sessions/current')) {
        return openCashSessionResponse();
      }
      if (url.endsWith('/api/invoices')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 57,
              invoice_number: '000-001-01-00000057',
              patient_name: 'Maria Lopez',
              status: 'issued',
              subtotal: '25.00',
              tax_amount: '0.00',
              discount_amount: '0.00',
              total: '25.00',
              paid_amount: '0.00',
              balance_due: '25.00',
              issued_at: '2026-05-17T08:50:00-06:00',
              items: [],
            },
          }),
        } as Response;
      }
      if (url.endsWith('/api/invoices/57/payments')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              payment: {
                id: 88,
                invoice_id: 57,
                cash_session_id: 7,
                user_id: 2,
                method: 'cash',
                amount: '25.00',
                reference: null,
                status: 'posted',
                paid_at: '2026-05-17T08:51:00-06:00',
              },
              invoice: {
                id: 57,
                invoice_number: '000-001-01-00000057',
                patient_name: 'Maria Lopez',
                status: 'paid',
                subtotal: '25.00',
                tax_amount: '0.00',
                discount_amount: '0.00',
                total: '25.00',
                paid_amount: '25.00',
                balance_due: '0.00',
                issued_at: '2026-05-17T08:50:00-06:00',
                items: [],
              },
              institutional_receipt: null,
              institutional_receipt_error: null,
              receipt_outcome: 'recovery_required',
            },
          }),
        } as Response;
      }
      if (url.includes('/api/invoices/57/receipt')) {
        return {
          ok: true,
          json: async () => ({ data: null }),
        } as Response;
      }
      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /emitir/i }).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByRole('button', { name: /emitir/i })[0]);
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /confirmar emis/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /emitir y abrir cobro/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /registrar pago/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/monto recibido/i), { target: { value: '25.00' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro.*imprimir/i }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/invoices/57/payments'))).toBe(true);
    });

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.cashSessions.current() });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.cashSessions.movements(7) });
    });

    expect(onStatus).not.toHaveBeenCalledWith(expect.stringMatching(/no se pudo registrar el pago/i));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /registrar pago/i })).not.toBeInTheDocument();
    });
    expect(await screen.findByRole('dialog', { name: /factura pagada/i })).toBeInTheDocument();
    expect(screen.getAllByText(/pago registrado/i).length).toBeGreaterThan(0);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/invoices/57/receipt'))).toBe(false);
    expect(screen.queryByRole('dialog', { name: /comprobante de factura/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/revise la factura en historial/i).length).toBeGreaterThan(0);
  });

  it('does not request fallback receipt after partial payment', async () => {
    vi.spyOn(apiBase, 'createClientIdempotencyKey')
      .mockReturnValueOnce('partial-invoice-attempt-1')
      .mockReturnValueOnce('partial-payment-attempt-1');
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/cash-sessions/current')) {
        return { ok: true, json: async () => ({ data: makeOpenCashSession() }) } as Response;
      }
      if (url.includes('/api/services')) {
        return { ok: true, json: async () => ({ data: [makeService()] }) } as Response;
      }
      if (url.includes('/api/categories')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }
      if (url.includes('/api/settings/operational')) {
        return {
          ok: true,
          json: async () => ({ data: { scanner_enabled: false, partial_payments_enabled: true } }),
        } as Response;
      }
      if (url.endsWith('/api/invoices')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 65,
              invoice_number: '000-001-01-00000065',
              patient_name: 'Maria Lopez',
              status: 'issued',
              subtotal: '25.00',
              tax_amount: '0.00',
              discount_amount: '0.00',
              total: '25.00',
              paid_amount: '0.00',
              balance_due: '25.00',
              issued_at: '2026-05-17T09:30:00-06:00',
              items: [],
            },
          }),
        } as Response;
      }
      if (url.endsWith('/api/invoices/65/payments')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              payment: {
                id: 94,
                invoice_id: 65,
                cash_session_id: 7,
                user_id: 2,
                method: 'cash',
                amount: '15.00',
                reference: null,
                status: 'posted',
                paid_at: '2026-05-17T09:31:00-06:00',
              },
              invoice: {
                id: 65,
                invoice_number: '000-001-01-00000065',
                patient_name: 'Maria Lopez',
                status: 'partial',
                subtotal: '25.00',
                tax_amount: '0.00',
                discount_amount: '0.00',
                total: '25.00',
                paid_amount: '15.00',
                balance_due: '10.00',
                issued_at: '2026-05-17T09:30:00-06:00',
                items: [],
              },
              institutional_receipt: null,
              institutional_receipt_error: null,
              receipt_outcome: 'not_required',
            },
          }),
        } as Response;
      }
      if (url.includes('/api/invoices/65/receipt')) {
        return {
          ok: true,
          json: async () => ({ data: null }),
        } as Response;
      }

      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    renderNewInvoice();
    await waitForPointOfSaleLoad();

    fireEvent.change(screen.getByLabelText(/nombre del paciente/i), { target: { value: 'Maria Lopez' } });
    fireEvent.change(screen.getByLabelText(/buscar por nombre/i), { target: { value: 'eritro' } });
    await waitFor(() => {
      expect(screen.getByText('Eritropoyetina')).toBeInTheDocument();
    }, { timeout: 3000 });
    addErythropoietinAndOpenAccount();
    fireEvent.click(screen.getAllByRole('button', { name: /emitir/i })[0]);
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /confirmar emis/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /emitir y abrir cobro/i }));
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /registrar pago/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/monto recibido/i), { target: { value: '15.00' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro.*imprimir/i }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/invoices/65/payments'))).toBe(true);
    });

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/invoices/65/receipt'))).toBe(false);
    expect(screen.queryByRole('dialog', { name: /comprobante de factura/i })).not.toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: /factura pendiente/i })).toBeInTheDocument();
    expect(screen.getByText('Efectivo')).toBeInTheDocument();
    expect(screen.getByText(/17\/05\/2026/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cobrar ahora/i })).toBeInTheDocument();
  });

  it('does not fall back to the historical receipt when institutional receipt issuance fails after payment', async () => {
    const onStatus = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/billing/new']}>
          <NewInvoiceView
            cashSession={makeOpenCashSession()}
            canCreatePayments
            canOpenCash
            canViewCatalog
            canViewReceipts
            onOpenCash={vi.fn()}
            onStatus={onStatus}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitForPointOfSaleLoad();

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;

    fireEvent.change(screen.getByLabelText(/nombre del paciente/i), { target: { value: 'Maria Lopez' } });
    fireEvent.change(screen.getByLabelText(/buscar por nombre/i), { target: { value: 'eritro' } });

    await waitFor(() => {
      expect(screen.getByText('Eritropoyetina')).toBeInTheDocument();
    }, { timeout: 3000 });

    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/services')).length).toBe(2);
    });

    addErythropoietinAndOpenAccount();

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/cash-sessions/current')) {
        return openCashSessionResponse();
      }
      if (url.endsWith('/api/invoices')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 61,
              invoice_number: '000-001-01-00000061',
              patient_name: 'Maria Lopez',
              status: 'issued',
              subtotal: '25.00',
              tax_amount: '0.00',
              discount_amount: '0.00',
              total: '25.00',
              paid_amount: '0.00',
              balance_due: '25.00',
              issued_at: '2026-05-17T09:00:00-06:00',
              items: [],
            },
          }),
        } as Response;
      }
      if (url.endsWith('/api/invoices/61/payments')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              payment: {
                id: 91,
                invoice_id: 61,
                cash_session_id: 7,
                user_id: 2,
                method: 'cash',
                amount: '25.00',
                reference: null,
                status: 'posted',
                paid_at: '2026-05-17T09:01:00-06:00',
              },
              invoice: {
                id: 61,
                invoice_number: '000-001-01-00000061',
                patient_name: 'Maria Lopez',
                status: 'paid',
                subtotal: '25.00',
                tax_amount: '0.00',
                discount_amount: '0.00',
                total: '25.00',
                paid_amount: '25.00',
                balance_due: '0.00',
                issued_at: '2026-05-17T09:00:00-06:00',
                items: [],
              },
              institutional_receipt: null,
              institutional_receipt_error: 'No hay una serie activa para recibos institucionales.',
              receipt_outcome: 'recovery_required',
            },
          }),
        } as Response;
      }
      if (url.includes('/api/invoices/61/receipt')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              width: 'half_letter',
              hospital: { name: 'Hospital San Isidro', rtn: null },
              fiscal: { cai: null, authorized_range: null, valid_until: null },
              invoice: {
                id: 61,
                invoice_number: '000-001-01-00000061',
                patient_name: 'Maria Lopez',
                subtotal: '25.00',
                tax_amount: '0.00',
                discount_amount: '0.00',
                total: '25.00',
                paid_amount: '25.00',
                balance_due: '0.00',
                status: 'paid',
                issued_at: '2026-05-17T09:00:00-06:00',
                cashier: 'Caja',
              },
              items: [],
              payments: [],
            },
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    fireEvent.click(screen.getAllByRole('button', { name: /emitir/i })[0]);
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /confirmar emis/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /emitir y abrir cobro/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /registrar pago/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/monto recibido/i), { target: { value: '25.00' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro.*imprimir/i }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/invoices/61/payments'))).toBe(true);
    });

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/invoices/61/receipt'))).toBe(false);
    expect(screen.queryByRole('dialog', { name: /comprobante de factura/i })).not.toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: /factura pagada/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /imprimir recibo$/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/revise la factura en historial/i).length).toBeGreaterThan(0);
    expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({
      key: 'billing-payment',
      level: 'warning',
      message: expect.stringMatching(/recibo institucional esta pendiente/i),
    }));
  });

  it('does not fetch or show a receipt for a paid zero-total invoice when receipts are not allowed', async () => {
    renderNewInvoice(makeOpenCashSession(), { canViewReceipts: false });
    await waitForPointOfSaleLoad();

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;

    fireEvent.change(screen.getByLabelText(/nombre del paciente/i), { target: { value: 'Maria Lopez' } });
    fireEvent.change(screen.getByLabelText(/buscar por nombre/i), { target: { value: 'eritro' } });

    await waitFor(() => {
      expect(screen.getByText('Eritropoyetina')).toBeInTheDocument();
    }, { timeout: 3000 });

    addErythropoietinAndOpenAccount();

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/cash-sessions/current')) {
        return openCashSessionResponse();
      }
      if (url.endsWith('/api/invoices')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 56,
              invoice_number: '000-001-01-00000056',
              patient_name: 'Maria Lopez',
              status: 'paid',
              subtotal: '0.00',
              tax_amount: '0.00',
              discount_amount: '0.00',
              total: '0.00',
              balance_due: '0.00',
              paid_amount: '0.00',
              issued_at: '2026-05-17T08:45:00-06:00',
              items: [],
            },
          }),
        } as Response;
      }
      if (url.includes('/api/invoices/56/receipt')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              width: 'half_letter',
              hospital: { name: 'Hospital San Isidro', rtn: null },
              fiscal: { cai: null, authorized_range: null, valid_until: null },
              invoice: {
                id: 56,
                invoice_number: '000-001-01-00000056',
                patient_name: 'Maria Lopez',
                subtotal: '0.00',
                tax_amount: '0.00',
                discount_amount: '0.00',
                total: '0.00',
                paid_amount: '0.00',
                balance_due: '0.00',
                status: 'paid',
                issued_at: '2026-05-17T08:45:00-06:00',
                cashier: 'Caja',
              },
              items: [],
              payments: [],
            },
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    fireEvent.click(await screen.findByRole('button', { name: /^emitir factura$/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /confirmar factura/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /confirmar emis/i }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/invoices'))).toBe(true);
    });

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/invoices/56/receipt'))).toBe(false);
    expect(screen.queryByRole('dialog', { name: /comprobante de factura/i })).not.toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: /factura pagada/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /imprimir recibo$/i })).not.toBeInTheDocument();
  });

  it('issues an institutional receipt for a paid zero-total invoice instead of using the fallback receipt', async () => {
    vi.spyOn(apiBase, 'createClientIdempotencyKey')
      .mockReturnValueOnce('invoice-attempt-1')
      .mockReturnValueOnce('zero-receipt-attempt-1')
      .mockReturnValueOnce('zero-receipt-print-attempt-1');
    const getInstitutionalReceiptPdf = vi
      .spyOn(apiClient, 'getInstitutionalReceiptPdf')
      .mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));
    const registerPrint = vi.spyOn(apiClient, 'registerInstitutionalReceiptPrintEvent')
      .mockResolvedValue({} as never);
    const institutionalReceiptRequests: Array<{
      body: unknown;
      idempotencyKey: string | null;
    }> = [];

    renderNewInvoice();
    await waitForPointOfSaleLoad();

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;

    fireEvent.change(screen.getByLabelText(/nombre del paciente/i), { target: { value: 'Maria Lopez' } });
    fireEvent.change(screen.getByLabelText(/buscar por nombre/i), { target: { value: 'eritro' } });

    await waitFor(() => {
      expect(screen.getByText('Eritropoyetina')).toBeInTheDocument();
    }, { timeout: 3000 });

    addErythropoietinAndOpenAccount();

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/cash-sessions/current')) {
        return openCashSessionResponse();
      }
      if (url.endsWith('/api/invoices')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 64,
              invoice_number: '000-001-01-00000064',
              patient_name: 'Maria Lopez',
              status: 'paid',
              subtotal: '0.00',
              tax_amount: '0.00',
              discount_amount: '0.00',
              total: '0.00',
              balance_due: '0.00',
              paid_amount: '0.00',
              issued_at: '2026-05-17T09:30:00-06:00',
              items: [],
            },
          }),
        } as Response;
      }
      if (url.endsWith('/api/institutional-receipts')) {
        const headers = new Headers((init as RequestInit | undefined)?.headers);
        institutionalReceiptRequests.push({
          body: JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}')),
          idempotencyKey: headers.get('Idempotency-Key'),
        });

        return {
          ok: true,
          json: async () => ({
            data: {
              id: 98,
              invoice_id: 64,
              payment_id: null,
              cash_session_id: 7,
              series_id: 1,
              receipt_number: 98,
              receipt_number_full: 'REC-A-00000098',
              status: 'issued',
              amount: '0.00',
              amount_cents: 0,
              issued_at: '2026-05-17T09:31:00-06:00',
              issued_by: 2,
              payer_name: 'Maria Lopez',
              concept: 'Pago de factura 000-001-01-00000064',
              amount_words: 'Cero lempiras exactos',
              template_code: 'institutional_classic',
              print_profile_code: 'letter',
              copy_mode: 'single',
              reprint_count: 0,
              voided_by: null,
              voided_at: null,
              void_reason: null,
            },
          }),
        } as Response;
      }
      if (url.includes('/api/invoices/64/receipt')) {
        return {
          ok: true,
          json: async () => ({ data: null }),
        } as Response;
      }
      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    fireEvent.click(screen.getAllByRole('button', { name: /emitir/i })[0]);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /confirmar emis/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /emitir y abrir cobro/i }));

    await waitFor(() => {
      expect(institutionalReceiptRequests).toEqual([{
        body: { invoice_id: 64, cash_session_id: 7 },
        idempotencyKey: 'zero-receipt-attempt-1',
      }]);
    });

    await waitFor(() => {
      expect(registerPrint).toHaveBeenCalledWith(98, undefined, {
        idempotencyKey: 'zero-receipt-print-attempt-1',
      });
    });
    expect(getInstitutionalReceiptPdf).toHaveBeenCalledWith(98);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/invoices/64/receipt'))).toBe(false);
    expect(screen.queryByRole('dialog', { name: /comprobante de factura/i })).not.toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: /factura pagada/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /imprimir recibo$/i })).toBeInTheDocument();
  });

  it('reprints the institutional receipt from the sale flow with an idempotency key', async () => {
    vi.spyOn(apiBase, 'createClientIdempotencyKey').mockReturnValue('sale-reprint-attempt-1');
    const getInstitutionalReceiptPdf = vi
      .spyOn(apiClient, 'getInstitutionalReceiptPdf')
      .mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));
    const registerPrint = vi.spyOn(apiClient, 'registerInstitutionalReceiptPrintEvent')
      .mockResolvedValue({} as never);

    renderNewInvoice();
    await waitForPointOfSaleLoad();

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;

    fireEvent.change(screen.getByLabelText(/nombre del paciente/i), { target: { value: 'Maria Lopez' } });
    fireEvent.change(screen.getByLabelText(/buscar por nombre/i), { target: { value: 'eritro' } });

    await waitFor(() => {
      expect(screen.getByText('Eritropoyetina')).toBeInTheDocument();
    }, { timeout: 3000 });

    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/services')).length).toBe(2);
    });

    addErythropoietinAndOpenAccount();

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/cash-sessions/current')) {
        return openCashSessionResponse();
      }
      if (url.endsWith('/api/invoices')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 58,
              invoice_number: '000-001-01-00000058',
              patient_name: 'Maria Lopez',
              status: 'issued',
              subtotal: '25.00',
              tax_amount: '0.00',
              discount_amount: '0.00',
              total: '25.00',
              paid_amount: '0.00',
              balance_due: '25.00',
              issued_at: '2026-05-17T08:55:00-06:00',
              items: [],
            },
          }),
        } as Response;
      }
      if (url.endsWith('/api/invoices/58/payments')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              payment: {
                id: 89,
                invoice_id: 58,
                cash_session_id: 7,
                user_id: 2,
                method: 'cash',
                amount: '25.00',
                reference: null,
                status: 'posted',
                paid_at: '2026-05-17T08:56:00-06:00',
              },
              invoice: {
                id: 58,
                invoice_number: '000-001-01-00000058',
                patient_name: 'Maria Lopez',
                status: 'paid',
                subtotal: '25.00',
                tax_amount: '0.00',
                discount_amount: '0.00',
                total: '25.00',
                paid_amount: '25.00',
                balance_due: '0.00',
                issued_at: '2026-05-17T08:55:00-06:00',
                items: [],
              },
              institutional_receipt: {
                id: 96,
                invoice_id: 58,
                payment_id: 89,
                cash_session_id: 7,
                series_id: 1,
                receipt_number: 96,
                receipt_number_full: 'REC-A-00000096',
                status: 'issued',
                amount: '25.00',
                amount_cents: 2500,
                issued_at: '2026-05-17T08:56:00-06:00',
                issued_by: 2,
                payer_name: 'Maria Lopez',
                concept: 'Pago de factura 000-001-01-00000058',
                amount_words: 'Veinticinco lempiras exactos',
                template_code: 'institutional_classic',
                print_profile_code: 'letter',
                copy_mode: 'single',
                reprint_count: 0,
                voided_by: null,
                voided_at: null,
                void_reason: null,
              },
              institutional_receipt_error: null,
              receipt_outcome: 'issued',
            },
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /emitir/i }).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByRole('button', { name: /emitir/i })[0]);
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /confirmar emis/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /emitir y abrir cobro/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /registrar pago/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/monto recibido/i), { target: { value: '25.00' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro.*imprimir/i }));

    await waitFor(() => {
      expect(registerPrint).toHaveBeenCalledWith(96, undefined, {
        idempotencyKey: 'sale-reprint-attempt-1',
      });
    });
    expect(getInstitutionalReceiptPdf).toHaveBeenCalledWith(96);
    expect(openBlobInNewTab).toHaveBeenCalledWith(
      expect.any(Blob),
      'recibo-institucional-REC-A-00000096.pdf',
    );
    registerPrint.mockClear();
    getInstitutionalReceiptPdf.mockClear();
    vi.mocked(openBlobInNewTab).mockClear();
    vi.mocked(downloadBlob).mockClear();

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /factura pagada/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /imprimir recibo$/i }));

    await waitFor(() => {
      expect(registerPrint).toHaveBeenCalledWith(
        96,
        'Reimpresion desde venta/cobro.',
        { idempotencyKey: 'sale-reprint-attempt-1' },
      );
    });
    expect(getInstitutionalReceiptPdf).toHaveBeenCalledWith(96);
    expect(openBlobInNewTab).toHaveBeenCalledWith(
      expect.any(Blob),
      'recibo-institucional-REC-A-00000096.pdf',
    );

    registerPrint.mockClear();
    getInstitutionalReceiptPdf.mockClear();
    vi.mocked(openBlobInNewTab).mockClear();
    vi.mocked(downloadBlob).mockClear();

    fireEvent.click(screen.getByRole('button', { name: /guardar pdf/i }));

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      'recibo-institucional-REC-A-00000096.pdf',
    ));
    expect(getInstitutionalReceiptPdf).toHaveBeenCalledWith(96);
    expect(registerPrint).not.toHaveBeenCalled();
    expect(openBlobInNewTab).not.toHaveBeenCalled();
  });

  it('keeps a visible retry path when the institutional PDF fails to open after payment', async () => {
    const onStatus = vi.fn();
    const getInstitutionalReceiptPdf = vi
      .spyOn(apiClient, 'getInstitutionalReceiptPdf')
      .mockRejectedValue(new Error('No se pudo abrir el PDF institucional'));
    const registerPrint = vi.spyOn(apiClient, 'registerInstitutionalReceiptPrintEvent')
      .mockResolvedValue({} as never);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/billing/new']}>
          <NewInvoiceView
            cashSession={makeOpenCashSession()}
            canCreatePayments
            canOpenCash
            canViewCatalog
            canViewReceipts
            onOpenCash={vi.fn()}
            onStatus={onStatus}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitForPointOfSaleLoad();

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;

    fireEvent.change(screen.getByLabelText(/nombre del paciente/i), { target: { value: 'Maria Lopez' } });
    fireEvent.change(screen.getByLabelText(/buscar por nombre/i), { target: { value: 'eritro' } });

    await waitFor(() => {
      expect(screen.getByText('Eritropoyetina')).toBeInTheDocument();
    }, { timeout: 3000 });
    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/services')).length).toBe(2);
    });

    addErythropoietinAndOpenAccount();

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/cash-sessions/current')) {
        return openCashSessionResponse();
      }
      if (url.endsWith('/api/invoices')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 62,
              invoice_number: '000-001-01-00000062',
              patient_name: 'Maria Lopez',
              status: 'issued',
              subtotal: '25.00',
              tax_amount: '0.00',
              discount_amount: '0.00',
              total: '25.00',
              paid_amount: '0.00',
              balance_due: '25.00',
              issued_at: '2026-05-17T09:10:00-06:00',
              items: [],
            },
          }),
        } as Response;
      }
      if (url.endsWith('/api/invoices/62/payments')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              payment: {
                id: 92,
                invoice_id: 62,
                cash_session_id: 7,
                user_id: 2,
                method: 'cash',
                amount: '25.00',
                reference: null,
                status: 'posted',
                paid_at: '2026-05-17T09:11:00-06:00',
              },
              invoice: {
                id: 62,
                invoice_number: '000-001-01-00000062',
                patient_name: 'Maria Lopez',
                status: 'paid',
                subtotal: '25.00',
                tax_amount: '0.00',
                discount_amount: '0.00',
                total: '25.00',
                paid_amount: '25.00',
                balance_due: '0.00',
                issued_at: '2026-05-17T09:10:00-06:00',
                items: [],
              },
              institutional_receipt: {
                id: 97,
                invoice_id: 62,
                payment_id: 92,
                cash_session_id: 7,
                series_id: 1,
                receipt_number: 97,
                receipt_number_full: 'REC-A-00000097',
                status: 'issued',
                amount: '25.00',
                amount_cents: 2500,
                issued_at: '2026-05-17T09:11:00-06:00',
                issued_by: 2,
                payer_name: 'Maria Lopez',
                concept: 'Pago de factura 000-001-01-00000062',
                amount_words: 'Veinticinco lempiras exactos',
                template_code: 'institutional_classic',
                print_profile_code: 'letter',
                copy_mode: 'single',
                reprint_count: 0,
                voided_by: null,
                voided_at: null,
                void_reason: null,
              },
              institutional_receipt_error: null,
              receipt_outcome: 'issued',
            },
          }),
        } as Response;
      }
      if (url.includes('/api/invoices/62/receipt')) {
        return {
          ok: true,
          json: async () => ({ data: null }),
        } as Response;
      }
      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    fireEvent.click(screen.getAllByRole('button', { name: /emitir/i })[0]);
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /confirmar emis/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /emitir y abrir cobro/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /registrar pago/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/monto recibido/i), { target: { value: '25.00' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro.*imprimir/i }));

    await waitFor(() => {
      expect(registerPrint).toHaveBeenCalledWith(97, undefined, {
        idempotencyKey: expect.any(String),
      });
    });
    expect(getInstitutionalReceiptPdf).toHaveBeenCalledTimes(1);

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/invoices/62/receipt'))).toBe(false);
    expect(await screen.findByRole('dialog', { name: /factura pagada/i })).toBeInTheDocument();
    expect(screen.getAllByText(/recibo institucional REC-A-00000097 emitido/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/no se pudo abrir el PDF/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /imprimir recibo$/i })).toBeInTheDocument();
    expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({
      key: 'billing-payment',
      level: 'warning',
      message: expect.stringMatching(/no se pudo abrir el PDF/i),
    }));
  });

  it('renews the payment idempotency key when a failed payment payload changes', async () => {
    vi.spyOn(apiBase, 'createClientIdempotencyKey')
      .mockReturnValueOnce('invoice-attempt-1')
      .mockReturnValueOnce('payment-attempt-1')
      .mockReturnValueOnce('payment-attempt-2');
    const paymentIdempotencyKeys: Array<string | null> = [];
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/cash-sessions/current')) {
        return { ok: true, json: async () => ({ data: makeOpenCashSession() }) } as Response;
      }
      if (url.includes('/api/services')) {
        return { ok: true, json: async () => ({ data: [makeService()] }) } as Response;
      }
      if (url.includes('/api/categories')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }
      if (url.includes('/api/settings/operational')) {
        return {
          ok: true,
          json: async () => ({ data: { scanner_enabled: false, partial_payments_enabled: true } }),
        } as Response;
      }
      if (url.endsWith('/api/invoices')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 63,
              invoice_number: '000-001-01-00000063',
              patient_name: 'Maria Lopez',
              status: 'issued',
              subtotal: '25.00',
              tax_amount: '0.00',
              discount_amount: '0.00',
              total: '25.00',
              paid_amount: '0.00',
              balance_due: '25.00',
              issued_at: '2026-05-17T09:20:00-06:00',
              items: [],
            },
          }),
        } as Response;
      }
      if (url.endsWith('/api/invoices/63/payments')) {
        const headers = new Headers((init as RequestInit | undefined)?.headers);
        paymentIdempotencyKeys.push(headers.get('Idempotency-Key'));

        if (paymentIdempotencyKeys.length === 1) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ message: 'Corte de red durante el cobro' }),
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({
            data: {
              payment: {
                id: 93,
                invoice_id: 63,
                cash_session_id: 7,
                user_id: 2,
                method: 'cash',
                amount: '15.00',
                reference: null,
                status: 'posted',
                paid_at: '2026-05-17T09:22:00-06:00',
              },
              invoice: {
                id: 63,
                invoice_number: '000-001-01-00000063',
                patient_name: 'Maria Lopez',
                status: 'partial',
                subtotal: '25.00',
                tax_amount: '0.00',
                discount_amount: '0.00',
                total: '25.00',
                paid_amount: '15.00',
                balance_due: '10.00',
                issued_at: '2026-05-17T09:20:00-06:00',
                items: [],
              },
              institutional_receipt: null,
              institutional_receipt_error: null,
              receipt_outcome: 'not_required',
            },
          }),
        } as Response;
      }
      if (url.includes('/api/invoices/63/receipt')) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ message: 'Recibo pendiente' }),
        } as Response;
      }

      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    renderNewInvoice();
    await waitForPointOfSaleLoad();

    fireEvent.change(screen.getByLabelText(/nombre del paciente/i), { target: { value: 'Maria Lopez' } });
    fireEvent.change(screen.getByLabelText(/buscar por nombre/i), { target: { value: 'eritro' } });
    await waitFor(() => {
      expect(screen.getByText('Eritropoyetina')).toBeInTheDocument();
    }, { timeout: 3000 });
    addErythropoietinAndOpenAccount();
    fireEvent.click(screen.getAllByRole('button', { name: /emitir/i })[0]);
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /confirmar emis/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /emitir y abrir cobro/i }));
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /registrar pago/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/monto recibido/i), { target: { value: '10.00' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro.*imprimir/i }));
    await waitFor(() => {
      expect(paymentIdempotencyKeys).toEqual(['payment-attempt-1']);
    });
    expect(screen.getByRole('dialog', { name: /registrar pago/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/monto recibido/i), { target: { value: '15.00' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro.*imprimir/i }));

    await waitFor(() => {
      expect(paymentIdempotencyKeys).toEqual(['payment-attempt-1', 'payment-attempt-2']);
    });
  });

  it('does not let cashier proceed when cash session is closed', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/cash-sessions/current')) {
        return { ok: true, json: async () => ({ data: null }) } as Response;
      }
      if (url.includes('/api/services')) {
        return { ok: true, json: async () => ({ data: [makeService()] }) } as Response;
      }
      if (url.includes('/api/categories')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }
      if (url.includes('/api/settings/operational')) {
        return {
          ok: true,
          json: async () => ({
            data: { scanner_enabled: false, partial_payments_enabled: false },
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    renderNewInvoice(null);

    const patientInput = screen.getByLabelText(/nombre del paciente/i);
    fireEvent.change(patientInput, { target: { value: 'Maria Lopez' } });

    await waitFor(() => {
      const emitButtons = screen.queryAllByRole('button', { name: /emitir/i });
      expect(emitButtons.length).toBeGreaterThan(0);
      emitButtons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });
  });

  it('refreshes cash session before opening invoice confirmation', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    let currentSessionCalls = 0;

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/cash-sessions/current')) {
        currentSessionCalls += 1;
        return {
          ok: true,
          json: async () => ({ data: currentSessionCalls === 1 ? makeOpenCashSession() : null }),
        } as Response;
      }
      if (url.includes('/api/services')) {
        return { ok: true, json: async () => ({ data: [makeService()] }) } as Response;
      }
      if (url.includes('/api/categories')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }
      if (url.includes('/api/settings/operational')) {
        return {
          ok: true,
          json: async () => ({ data: { scanner_enabled: false, partial_payments_enabled: false } }),
        } as Response;
      }
      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    renderNewInvoice();
    await waitForPointOfSaleLoad();

    fireEvent.change(screen.getByLabelText(/nombre del paciente/i), { target: { value: 'Maria Lopez' } });
    fireEvent.change(screen.getByLabelText(/buscar por nombre/i), { target: { value: 'eritro' } });

    await waitFor(() => {
      expect(screen.getByText('Eritropoyetina')).toBeInTheDocument();
    }, { timeout: 3000 });

    addErythropoietinAndOpenAccount();
    fetchMock.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /^emitir y cobrar$/i }));

    expect(await screen.findByText(/abra caja antes de emitir y cobrar una factura/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /confirmar emis/i })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/invoices'))).toBe(false);
    expect(screen.getAllByText('Eritropoyetina').length).toBeGreaterThan(0);
  });

  it('does not allow emit when patient is missing even if cart has services (reducer-level)', () => {
    const state = getInitialNewInvoiceState(makeOpenCashSession());
    const next = newInvoiceReducer(state, { type: 'ADD_TO_CART', payload: makeService() });
    expect(next.cartItems.length).toBe(1);
    expect(next.patientName).toBe('');
  });

  it('does not allow emit when cart is empty even if patient is set (reducer-level)', () => {
    const state = newInvoiceReducer(
      getInitialNewInvoiceState(makeOpenCashSession()),
      { type: 'SET_PATIENT_NAME', payload: 'Maria Lopez' },
    );
    expect(state.patientName).toBe('Maria Lopez');
    expect(state.cartItems.length).toBe(0);
  });

  it('marks the state ready when patient is set AND cart has services (reducer-level)', () => {
    const initial = getInitialNewInvoiceState(makeOpenCashSession());
    const withPatient = newInvoiceReducer(initial, { type: 'SET_PATIENT_NAME', payload: 'Maria Lopez' });
    const ready = newInvoiceReducer(withPatient, { type: 'ADD_TO_CART', payload: makeService() });
    expect(ready.patientName.trim()).toBe('Maria Lopez');
    expect(ready.cartItems.length).toBe(1);
    expect(ready.loadedCashSession?.status).toBe('open');
  });
});
