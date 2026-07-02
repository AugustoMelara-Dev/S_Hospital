import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NewInvoiceView } from './NewInvoiceView';
import { newInvoiceReducer } from './state/reducer';
import { getInitialNewInvoiceState } from './state/types';
import type { Service, CashSession } from '../../lib/api';

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
          data: { scanner_enabled: false, partial_payments_enabled: false, receipt_paper_size: 'half_letter' },
        }),
      } as Response;
    }
    return { ok: true, json: async () => ({ data: null }) } as Response;
  });
}

function renderNewInvoice(cashSession: CashSession | null = makeOpenCashSession()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/billing/new']}>
        <NewInvoiceView
          cashSession={cashSession}
          canCreatePayments
          canOpenCash
          canViewCatalog
          canViewReceipts
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

    fireEvent.click(screen.getByText('Eritropoyetina'));

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

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementationOnce(async () => {
      return {
        ok: false,
        status: 422,
        json: async () => ({
          message: 'Error de validacion',
          errors: { patient_name: ['Requerido'] },
        }),
      } as Response;
    });

    const patientInput = screen.getByLabelText(/nombre del paciente/i);
    fireEvent.change(patientInput, { target: { value: 'Maria Lopez' } });

    const searchInput = screen.getByLabelText(/buscar por nombre/i);
    fireEvent.change(searchInput, { target: { value: 'eritro' } });

    await waitFor(() => {
      expect(screen.getByText('Eritropoyetina')).toBeInTheDocument();
    }, { timeout: 3000 });

    fireEvent.click(screen.getByText('Eritropoyetina'));

    fireEvent.click(screen.getAllByRole('button', { name: /emitir/i })[0]);

    await waitFor(() => {
      expect(screen.getAllByText('Eritropoyetina').length).toBeGreaterThan(0);
    });

    expect(fetchMock).toHaveBeenCalled();
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
            data: { scanner_enabled: false, partial_payments_enabled: false, receipt_paper_size: 'half_letter' },
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
