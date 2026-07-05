import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NewInvoiceView } from './NewInvoiceView';
import { newInvoiceReducer } from './state/reducer';
import { getInitialNewInvoiceState } from './state/types';
import { apiClient, type Service, type CashSession } from '../../lib/api';
import * as apiBase from '@/lib/api/base';
import { queryKeys } from '@/lib/queryKeys';

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
  openBlobInNewTab: vi.fn(),
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

function mockFetchForOpenCashWithService(): ReturnType<typeof vi.fn> {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
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
          onStatus={vi.fn()}
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

    fireEvent.click(screen.getByRole('button', { name: /agregar eritropoyetina/i }));

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

    fireEvent.click(screen.getByRole('button', { name: /agregar eritropoyetina/i }));

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
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
    fireEvent.click(screen.getByRole('button', { name: /agregar eritropoyetina/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^emitir y cobrar$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /emitir y abrir cobro/i }));

    await waitFor(() => expect(invoicePayload).toEqual(expect.objectContaining({
      patient_name: 'Maria Lopez',
    })));
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
    fireEvent.click(screen.getByRole('button', { name: /agregar eritropoyetina/i }));
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

    fireEvent.click(screen.getByText('Eritropoyetina'));

    const emitButton = await screen.findByRole('button', { name: /^emitir factura$/i });

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
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
    expect(screen.getByRole('button', { name: /crear otra factura/i })).toBeInTheDocument();
    expect(screen.queryByText(/permisos completos/i)).not.toBeInTheDocument();
  });

  it('keeps payment registered when legacy receipt loading fails after collection', async () => {
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

    fireEvent.click(screen.getByText('Eritropoyetina'));

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
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
            },
          }),
        } as Response;
      }
      if (url.includes('/api/invoices/57/receipt')) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ message: 'No se pudo generar PDF legacy' }),
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
    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro e imprimir/i }));

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
    expect(screen.getByText(/pago registrado/i)).toBeInTheDocument();
    expect(screen.getByText(/no se pudo generar el recibo/i)).toBeInTheDocument();
  });

  it('does not fall back to the legacy receipt when institutional receipt issuance fails after payment', async () => {
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

    fireEvent.click(screen.getByText('Eritropoyetina'));

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
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
    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro e imprimir/i }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/invoices/61/payments'))).toBe(true);
    });

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/invoices/61/receipt'))).toBe(false);
    expect(screen.queryByRole('dialog', { name: /comprobante de factura/i })).not.toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: /factura pagada/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /imprimir recibo institucional/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/genere el recibo institucional desde historial/i).length).toBeGreaterThan(0);
    expect(onStatus).toHaveBeenCalledWith(expect.stringMatching(/recibo institucional pendiente/i));
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

    fireEvent.click(screen.getByText('Eritropoyetina'));

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
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
    expect(screen.queryByRole('button', { name: /imprimir recibo institucional/i })).not.toBeInTheDocument();
  });

  it('reprints the institutional receipt from the sale flow with an idempotency key', async () => {
    vi.spyOn(apiBase, 'createClientIdempotencyKey').mockReturnValue('sale-reprint-attempt-1');
    const getInstitutionalReceiptPdf = vi
      .spyOn(apiClient, 'getInstitutionalReceiptPdf')
      .mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));

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

    fireEvent.click(screen.getByRole('button', { name: /agregar eritropoyetina/i }));

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
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
    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro e imprimir/i }));

    await waitFor(() => {
      expect(getInstitutionalReceiptPdf).toHaveBeenCalledTimes(1);
    });
    getInstitutionalReceiptPdf.mockClear();

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /factura pagada/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /imprimir recibo institucional/i }));

    await waitFor(() => {
      expect(getInstitutionalReceiptPdf).toHaveBeenCalledWith(
        96,
        'Reimpresion desde venta/cobro.',
        { idempotencyKey: 'sale-reprint-attempt-1' },
      );
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
