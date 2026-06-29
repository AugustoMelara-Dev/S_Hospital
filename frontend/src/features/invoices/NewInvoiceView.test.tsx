/// <reference types="node" />
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { NewInvoiceView } from './NewInvoiceView';
import { PaymentModal } from '../../features/invoices/components/PaymentModal';
import { localDateString } from '../../features/invoices/InvoiceHistoryView';
import { ReceiptPreview } from '../../features/receipts/ReceiptPreview';
import { apiClient, type CashSession, type Category, type OperationalSettings, type ReceiptData, type Service, type ServiceArea } from '../../lib/api';
import { queryClient } from '../../lib/query-client';
import { resetRequestChain } from '../../lib/api/base';
import { openBlobInNewTab } from '../../lib/download';

vi.mock('../../lib/download', () => ({
  downloadBlob: vi.fn(),
  openBlobInNewTab: vi.fn(),
}));

describe('NewInvoiceView', () => {
  const submitButtons = (name: RegExp = /emitir y cobrar/i) => screen.getAllByRole('button', { name });
  const primarySubmitButton = (name: RegExp = /emitir y cobrar/i) => submitButtons(name)[0];

  beforeEach(() => {
    vi.restoreAllMocks();
    resetRequestChain();
    queryClient.clear();
    window.history.pushState({}, '', '/');
    vi.spyOn(apiClient, 'getLogo').mockResolvedValue(null);
    document.body.removeAttribute('data-printing-receipt');
    document.body.removeAttribute('data-receipt-width');
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  it('shows a retryable LAN load error instead of presenting the POS as only cash-closed', async () => {
    window.history.pushState({}, '', '/billing/new');

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/api/auth/session')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 2,
              name: 'Cajero Validacion',
              email: 'cajero.validacion@hospital.local',
              username: 'cajero.validacion',
              active: true,
              roles: ['cajero'],
              permissions: ['catalog.view', 'cash.view', 'invoices.create', 'payments.create', 'receipts.view'],
              must_change_password: false,
            },
          }),
        } as Response;
      }

      if (url.includes('/api/cash-sessions/current')) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ message: 'Servidor LAN no disponible' }),
          text: async () => JSON.stringify({ message: 'Servidor LAN no disponible' }),
        } as Response;
      }

      if (url.includes('/api/settings/operational')) {
        return {
          ok: true,
          json: async () => ({
            data: { scanner_enabled: false, partial_payments_enabled: false, receipt_paper_size: 'half_letter', default_tax_rate: '15.00' },
          }),
        } as Response;
      }

      if (url.includes('/api/categories')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }

      if (url.includes('/api/service-areas')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }

      if (url.includes('/api/services')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }

      return { ok: true, json: async () => ({}) } as Response;
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: /nueva factura/i })).toBeInTheDocument();
    expect(await screen.findByText(/no se pudo cargar el punto de venta/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    expect(screen.queryByText(/debe abrir la caja antes de emitir facturas/i)).not.toBeInTheDocument();
  });

  it('filters billable services by administrative area in the POS', async () => {
    window.history.pushState({}, '', '/billing/new');
    const requestedServiceUrls: string[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/api/auth/session')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 2,
              name: 'Cajero Validacion',
              email: 'cajero.validacion@hospital.local',
              username: 'cajero.validacion',
              active: true,
              roles: ['cajero'],
              permissions: ['catalog.view', 'cash.view', 'invoices.create', 'payments.create', 'receipts.view'],
              must_change_password: false,
            },
          }),
        } as Response;
      }

      if (url.includes('/api/cash-sessions/current')) {
        return {
          ok: true,
          json: async () => ({ data: null }),
        } as Response;
      }

      if (url.includes('/api/categories')) {
        return {
          ok: true,
          json: async () => ({ data: [{ id: 1, name: 'General', slug: 'general', active: true, sort_order: 1 }] }),
        } as Response;
      }

      if (url.includes('/api/service-areas')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 },
              { id: 2, name: 'Rayos X', slug: 'rayos-x', active: true, sort_order: 2 },
            ],
          }),
        } as Response;
      }

      if (url.includes('/api/services')) {
        requestedServiceUrls.push(url);
        const isRayos = url.includes('area_id=2');
        return {
          ok: true,
          json: async () => ({
            data: isRayos
              ? [{
                  id: 22,
                  category_id: 1,
                  area_id: 2,
                  name: 'Radiografia de abdomen',
                  slug: 'radiografia-de-abdomen',
                  price: '120.00',
                  scan_code: null,
                  barcode: null,
                  qr_code: null,
                  taxable: true,
                  active: true,
                  visible_in_billing: true,
                  is_billable: true,
                  special_rule_code: null,
                  category: { id: 1, name: 'General', slug: 'general', active: true, sort_order: 1 },
                  area: { id: 2, name: 'Rayos X', slug: 'rayos-x', active: true, sort_order: 2 },
                }]
              : [{
                  id: 11,
                  category_id: 1,
                  area_id: 1,
                  name: 'Glucosa',
                  slug: 'glucosa',
                  price: '15.00',
                  scan_code: null,
                  barcode: null,
                  qr_code: null,
                  taxable: true,
                  active: true,
                  visible_in_billing: true,
                  is_billable: true,
                  special_rule_code: null,
                  category: { id: 1, name: 'General', slug: 'general', active: true, sort_order: 1 },
                  area: { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 },
                }],
          }),
        } as Response;
      }

      return { ok: true, json: async () => ({}) } as Response;
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: /nueva factura/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(requestedServiceUrls.some((url) => url.includes('visible_in_billing=1') && url.includes('is_billable=1'))).toBe(true);
    });

    fireEvent.click(await screen.findByRole('radio', { name: /rayos x/i }));

    expect(await screen.findByRole('button', { name: /radiografia de abdomen/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /glucosa/i })).not.toBeInTheDocument();
    expect(requestedServiceUrls.some((url) => url.includes('area_id=2'))).toBe(true);
  });

  it('clears stale POS service results and shows an inline error when service search fails', async () => {
    const onStatus = vi.fn();
    const glucosa = {
      id: 11,
      category_id: 1,
      area_id: 1,
      name: 'Glucosa',
      slug: 'glucosa',
      price: '15.00',
      scan_code: null,
      barcode: null,
      qr_code: null,
      taxable: true,
      active: true,
      visible_in_billing: true,
      is_billable: true,
      special_rule_code: null,
      category: { id: 1, name: 'General', slug: 'general', active: true, sort_order: 1 },
      area: { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 },
    };

    vi.spyOn(apiClient, 'getCurrentCashSession').mockResolvedValue(null);
    vi.spyOn(apiClient, 'getCategories').mockResolvedValue([{ id: 1, name: 'General', slug: 'general', active: true, sort_order: 1 }]);
    vi.spyOn(apiClient, 'getServiceAreas').mockResolvedValue([{ id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true }]);
    vi.spyOn(apiClient, 'getOperationalSettings').mockResolvedValue({
      scanner_enabled: false,
      partial_payments_enabled: false,
      receipt_paper_size: 'half_letter',
      default_tax_rate: '15.00',
    });
    vi.spyOn(apiClient, 'getServices').mockImplementation(async (filters = {}) => {
      if (filters.search === 'fallo') {
        throw new Error('Servidor LAN caido');
      }

      return [glucosa];
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NewInvoiceView cashSession={null} onStatus={onStatus} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const searchInput = await screen.findByLabelText(/buscar por nombre/i);
    fireEvent.change(searchInput, { target: { value: 'glu' } });
    expect(await screen.findByRole('button', { name: /glucosa/i })).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'fallo' } });

    expect(await screen.findByText(/servidor lan caido/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /glucosa/i })).not.toBeInTheDocument();
    });
    expect(onStatus).toHaveBeenCalledWith('Servidor LAN caido');
    expect(searchInput).toHaveFocus();
  });

  it('renders payment form after issuing an invoice without adding reports', async () => {
    window.history.pushState({}, '', '/billing/new');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/api/auth/session')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 2,
              name: 'Cajero Validacion',
              email: 'cajero.validacion@hospital-san-isidro.local',
              username: 'cajero.validacion',
              active: true,
              roles: ['cajero'],
              permissions: ['catalog.view', 'cash.view', 'invoices.create', 'payments.create', 'receipts.view'],
              must_change_password: false,
            },
          }),
        } as Response;
      }

      if (url.includes('/api/cash-sessions/current')) {
        return {
          ok: true,
          json: async () => ({ data: null }),
        } as Response;
      }

      if (url.includes('/api/categories')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 1,
                name: 'Medicamentos',
                slug: 'medicamentos',
                active: true,
                sort_order: 4,
              },
            ],
          }),
        } as Response;
      }

      if (url.includes('/api/services')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 10,
                category_id: 1,
                name: 'Eritropoyetina',
                slug: 'eritropoyetina',
                price: '25.00',
                scan_code: 'MED-ERI-001',
                barcode: null,
                qr_code: null,
                taxable: true,
                active: true,
                special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
                category: {
                  id: 1,
                  name: 'Medicamentos',
                  slug: 'medicamentos',
                  active: true,
                  sort_order: 4,
                },
              },
            ],
          }),
        } as Response;
      }

      if (url.includes('/api/invoices')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 100,
              invoice_number: '000-001-01-00000001',
              patient_name: 'Maria Lopez',
              subtotal: '25.00',
              tax_amount: '3.75',
              discount_amount: '0.00',
              total: '28.75',
              paid_amount: '0.00',
              balance_due: '28.75',
              status: 'issued',
              issued_at: '2026-05-17T08:00:00-06:00',
              items: [],
            },
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: /nueva factura/i })).toBeInTheDocument();
    expect(await screen.findByLabelText(/nombre del paciente/i)).toBeInTheDocument();
    expect(await screen.findByLabelText(/buscar por nombre, categoría o código/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/scanner usb o código manual/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/buscar por nombre, categoría o código/i), {
      target: { value: 'eritropoyetina' },
    });
    expect(await screen.findByRole('button', { name: /eritropoyetina/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /eritropoyetina/i }));
    expect(submitButtons().every((button) => button.hasAttribute('disabled'))).toBe(true);
    expect((await screen.findAllByText(/debe abrir la caja antes de emitir facturas/i)).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText(/nombre del paciente/i), {
      target: { value: 'Maria Lopez' },
    });
    expect(submitButtons().every((button) => button.hasAttribute('disabled'))).toBe(true);
    expect(screen.queryByRole('button', { name: /abrir caja/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ir a caja/i })).toHaveAttribute('href', '/cashbox');
    expect(screen.getByText(/solicite apertura a un usuario autorizado/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /confirmar factura/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /registrar pago/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /reportes/i })).not.toBeInTheDocument();
  });

  it('opens the issued institutional receipt PDF after registering payment', async () => {
    window.history.pushState({}, '', '/billing/new');
    const service = {
      id: 11,
      category_id: 1,
      name: 'Glucosa',
      slug: 'glucosa',
      price: '15.00',
      scan_code: 'LAB-GLU-001',
      barcode: null,
      qr_code: null,
      taxable: true,
      active: true,
      special_rule_code: null,
      category: { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 },
    };
    const issuedInvoice = {
      id: 100,
      invoice_number: '000-001-01-00000001',
      patient_name: 'Maria Lopez',
      subtotal: '15.00',
      tax_amount: '2.25',
      discount_amount: '0.00',
      total: '17.25',
      paid_amount: '0.00',
      balance_due: '17.25',
      status: 'issued',
      issued_at: '2026-05-17T08:00:00-06:00',
      items: [],
    };
    const paidInvoice = { ...issuedInvoice, paid_amount: '17.25', balance_due: '0.00', status: 'paid' };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method?.toUpperCase() ?? 'GET';

      if (url.includes('/sanctum/csrf-cookie')) {
        return { ok: true, json: async () => ({}) } as Response;
      }

      if (url.includes('/api/auth/session')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 2,
              name: 'Cajero Validacion',
              email: 'cajero.validacion@hospital-san-isidro.local',
              username: 'cajero.validacion',
              active: true,
              roles: ['cajero'],
              permissions: ['catalog.view', 'cash.view', 'invoices.create', 'payments.create', 'receipts.view'],
              must_change_password: false,
            },
          }),
        } as Response;
      }

      if (url.includes('/api/cash-sessions/current')) {
        return {
          ok: true,
          json: async () => ({
            data: {
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
            },
          }),
        } as Response;
      }

      if (url.includes('/api/settings/operational')) {
        return {
          ok: true,
          json: async () => ({
            data: { scanner_enabled: true, partial_payments_enabled: false, receipt_paper_size: 'half_letter', default_tax_rate: '15.00' },
          }),
        } as Response;
      }

      if (url.includes('/api/categories')) {
        return {
          ok: true,
          json: async () => ({ data: [{ id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 }] }),
        } as Response;
      }

      if (url.includes('/api/services')) {
        return { ok: true, json: async () => ({ data: [service] }) } as Response;
      }

      if (url.includes('/api/invoices/100/payments')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              payment: {
                id: 50,
                invoice_id: 100,
                cash_session_id: 7,
                user_id: 2,
                method: 'cash',
                amount: '17.25',
                reference: null,
                status: 'posted',
                paid_at: '2026-05-17T08:03:00-06:00',
              },
              invoice: paidInvoice,
              institutional_receipt: {
                id: 90,
                invoice_id: 100,
                payment_id: 50,
                cash_session_id: 7,
                series_id: 5,
                receipt_number: 1,
                receipt_number_full: 'REC-A-00000001',
                status: 'issued',
                amount: '17.25',
                amount_cents: 1725,
                issued_at: '2026-05-17T08:03:00-06:00',
                issued_by: 2,
                payer_name: 'Maria Lopez',
                concept: 'Glucosa',
                amount_words: 'DIECISIETE LEMPIRAS CON 25/100 CENTAVOS',
                template_code: 'institutional_classic',
                print_profile_code: 'media_carta_horizontal',
                copy_mode: 'original_only',
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

      if (url.includes('/api/institutional-receipts/90/pdf')) {
        return {
          ok: true,
          blob: async () => new Blob(['%PDF-test'], { type: 'application/pdf' }),
        } as Response;
      }

      if (url.includes('/api/institutional-receipts/90/print-events') && method === 'POST') {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            data: {
              event: { id: 1, event_type: 'issued_print' },
              receipt: { id: 90, receipt_number_full: 'REC-A-00000001', reprint_count: 0 },
            },
          }),
        } as Response;
      }

      if (url.endsWith('/api/invoices') && method === 'POST') {
        return { ok: true, json: async () => ({ data: issuedInvoice }) } as Response;
      }

      return { ok: true, json: async () => ({}) } as Response;
    });

    render(<App />);

    fireEvent.change(await screen.findByLabelText(/nombre del paciente/i), {
      target: { value: 'Maria Lopez' },
    });
    fireEvent.change(await screen.findByLabelText(/buscar por nombre, categoría o código/i), {
      target: { value: 'glucosa' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /glucosa/i }));
    await waitFor(() => expect(primarySubmitButton()).toBeEnabled());
    await waitFor(() => expect(screen.getAllByText(/L 17\.25/i).length).toBeGreaterThan(0));
    fireEvent.click(primarySubmitButton());
    expect(await screen.findByRole('button', { name: /emitir y abrir cobro/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /emitir y abrir cobro/i }));
    expect(await screen.findByRole('heading', { name: /registrar pago/i })).toBeInTheDocument();
    expect(screen.getByText(/ingrese el monto recibido/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/ver preview antes de imprimir/i));
    fireEvent.change(screen.getByLabelText(/monto recibido/i), { target: { value: '17.25' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro y ver preview/i }));

    await waitFor(() => {
      expect(openBlobInNewTab).toHaveBeenCalledWith(
        expect.any(Blob),
        'recibo-institucional-REC-A-00000001.pdf',
      );
    });
    expect(
      (globalThis.fetch as unknown as { mock: { calls: Array<[unknown, RequestInit | undefined]> } }).mock.calls
        .filter(([url, init]) => String(url).includes('/api/institutional-receipts/90/print-events')
          && init?.method === 'POST'),
    ).toHaveLength(0);
    expect(
      (globalThis.fetch as unknown as { mock: { calls: Array<[unknown, RequestInit | undefined]> } }).mock.calls
        .filter(([url]) => String(url).includes('/api/invoices/100/receipt')),
    ).toHaveLength(0);
    expect(screen.queryByLabelText(/vista previa del recibo/i)).not.toBeInTheDocument();
    expect(await screen.findAllByText(/REC-A-00000001/i)).not.toHaveLength(0);
  });

  it('rejects inactive services returned by scanner lookup', async () => {
    window.history.pushState({}, '', '/billing/new');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/api/settings/operational')) {
        return {
          ok: true,
          json: async () => ({ data: { scanner_enabled: true, partial_payments_enabled: false, receipt_paper_size: 'half_letter' } }),
        } as Response;
      }

      if (url.includes('/api/auth/session')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 2,
              name: 'Cajero Validacion',
              email: 'cajero.validacion@hospital-san-isidro.local',
              username: 'cajero.validacion',
              active: true,
              roles: ['cajero'],
              permissions: ['catalog.view', 'cash.view', 'invoices.create', 'payments.create', 'receipts.view'],
              must_change_password: false,
            },
          }),
        } as Response;
      }

      if (url.includes('/api/cash-sessions/current')) {
        return {
          ok: true,
          json: async () => ({
            data: {
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
            },
          }),
        } as Response;
      }

      if (url.includes('/api/categories')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 1,
                name: 'Laboratorio',
                slug: 'laboratorio',
                active: true,
                sort_order: 1,
              },
            ],
          }),
        } as Response;
      }

      if (url.includes('/api/services') && url.includes('code=INACTIVE-001')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 12,
                category_id: 1,
                name: 'Servicio descontinuado',
                slug: 'servicio-descontinuado',
                price: '10.00',
                scan_code: 'INACTIVE-001',
                barcode: null,
                qr_code: null,
                taxable: true,
                active: false,
                special_rule_code: null,
                category: {
                  id: 1,
                  name: 'Laboratorio',
                  slug: 'laboratorio',
                  active: true,
                  sort_order: 1,
                },
              },
            ],
          }),
        } as Response;
      }

      if (url.includes('/api/services')) {
        return {
          ok: true,
          json: async () => ({ data: [] }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    });

    render(<App />);

    fireEvent.change(await screen.findByLabelText(/scanner usb o código manual/i), {
      target: { value: 'INACTIVE-001' },
    });
    fireEvent.click(screen.getByRole('button', { name: /escanear/i }));

    expect((await screen.findAllByText(/servicio esta inactivo/i)).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /agregue servicios/i })).toBeDisabled();
    expect(screen.queryByText(/servicio descontinuado/i)).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([url]) => {
        const value = String(url);
        return value.includes('/api/services') && value.includes('code=INACTIVE-001') && value.includes('active=1');
      }),
    ).toBe(true);
  });

  it('does not add a cached service when scanner lookup has no backend match', async () => {
    window.history.pushState({}, '', '/billing/new');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/api/settings/operational')) {
        return {
          ok: true,
          json: async () => ({ data: { scanner_enabled: true, partial_payments_enabled: false, receipt_paper_size: 'half_letter' } }),
        } as Response;
      }

      if (url.includes('/api/auth/session')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 2,
              name: 'Cajero Validacion',
              email: 'cajero.validacion@hospital-san-isidro.local',
              username: 'cajero.validacion',
              active: true,
              roles: ['cajero'],
              permissions: ['catalog.view', 'cash.view', 'invoices.create', 'payments.create', 'receipts.view'],
              must_change_password: false,
            },
          }),
        } as Response;
      }

      if (url.includes('/api/cash-sessions/current')) {
        return {
          ok: true,
          json: async () => ({
            data: {
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
            },
          }),
        } as Response;
      }

      if (url.includes('/api/categories')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }

      if (url.includes('/api/services') && url.includes('code=CACHED-001')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }

      if (url.includes('/api/services')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 21,
                category_id: 1,
                name: 'Servicio en cache local',
                slug: 'servicio-en-cache-local',
                price: '12.00',
                scan_code: 'CACHED-001',
                barcode: null,
                qr_code: null,
                taxable: true,
                active: true,
                special_rule_code: null,
                category: null,
              },
            ],
          }),
        } as Response;
      }

      return { ok: true, json: async () => ({}) } as Response;
    });

    render(<App />);

    fireEvent.change(await screen.findByLabelText(/scanner usb o código manual/i), {
      target: { value: 'CACHED-001' },
    });
    fireEvent.click(screen.getByRole('button', { name: /escanear/i }));

    expect((await screen.findAllByText(/no se encontró servicio activo para este código/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/no hay servicios agregados/i)).toBeInTheDocument();
  });

  it('shows a clear scanner error when the code does not exist', async () => {
    window.history.pushState({}, '', '/billing/new');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/api/settings/operational')) {
        return {
          ok: true,
          json: async () => ({ data: { scanner_enabled: true, partial_payments_enabled: false, receipt_paper_size: 'half_letter' } }),
        } as Response;
      }

      if (url.includes('/api/auth/session')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 2,
              name: 'Cajero Validacion',
              email: 'cajero.validacion@hospital-san-isidro.local',
              username: 'cajero.validacion',
              active: true,
              roles: ['cajero'],
              permissions: ['catalog.view', 'cash.view', 'invoices.create', 'payments.create', 'receipts.view'],
              must_change_password: false,
            },
          }),
        } as Response;
      }

      if (url.includes('/api/cash-sessions/current')) {
        return {
          ok: true,
          json: async () => ({
            data: {
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
            },
          }),
        } as Response;
      }

      if (url.includes('/api/categories')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }

      if (url.includes('/api/services')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }

      return { ok: true, json: async () => ({}) } as Response;
    });

    render(<App />);

    fireEvent.change(await screen.findByLabelText(/scanner usb o código manual/i), {
      target: { value: 'MISSING-001' },
    });
    fireEvent.click(screen.getByRole('button', { name: /escanear/i }));

    expect((await screen.findAllByText(/no se encontró servicio activo para este código/i)).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.getByLabelText(/scanner usb o código manual/i)).toHaveFocus();
    });
  });

  it('submits scanner lookup only once while the lookup is pending', async () => {
    const onStatus = vi.fn();
    const cashSession: CashSession = {
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
    const category: Category = { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 };
    const area: ServiceArea = { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true };
    const service: Service = {
      id: 41,
      category_id: 1,
      area_id: 1,
      name: 'Glucosa Scanner',
      slug: 'glucosa-scanner',
      price: '15.00',
      scan_code: 'LAB-ONCE-001',
      barcode: null,
      qr_code: null,
      taxable: true,
      active: true,
      visible_in_billing: true,
      is_billable: true,
      special_rule_code: null,
      category,
      area,
    };
    const operationalSettings: OperationalSettings = {
      scanner_enabled: true,
      partial_payments_enabled: false,
      receipt_paper_size: 'half_letter',
      default_tax_rate: '15.00',
    };
    let resolveScan!: (services: Service[]) => void;
    const getServices = vi.spyOn(apiClient, 'getServices').mockImplementation((filters = {}) => {
      if (filters.code === 'LAB-ONCE-001') {
        return new Promise((resolve) => { resolveScan = resolve; });
      }

      return Promise.resolve([]);
    });

    vi.spyOn(apiClient, 'getCurrentCashSession').mockResolvedValue(cashSession);
    vi.spyOn(apiClient, 'getCategories').mockResolvedValue([category]);
    vi.spyOn(apiClient, 'getServiceAreas').mockResolvedValue([area]);
    vi.spyOn(apiClient, 'getOperationalSettings').mockResolvedValue(operationalSettings);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NewInvoiceView cashSession={cashSession} onStatus={onStatus} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const scannerInput = await screen.findByLabelText(/scanner usb o código manual/i);
    fireEvent.change(scannerInput, { target: { value: 'LAB-ONCE-001' } });
    const scanButton = screen.getByRole('button', { name: /escanear/i });

    fireEvent.click(scanButton);
    fireEvent.click(scanButton);
    fireEvent.keyDown(scannerInput, { key: 'Enter', code: 'Enter' });

    expect(getServices.mock.calls.filter(([filters]) => filters?.code === 'LAB-ONCE-001')).toHaveLength(1);
    await waitFor(() => expect(screen.getByRole('button', { name: /buscando/i })).toBeDisabled());
    expect(scannerInput).toBeDisabled();

    await act(async () => {
      resolveScan([service]);
    });

    await waitFor(() => expect(onStatus).toHaveBeenCalledWith('Servicio agregado por código: Glucosa Scanner.'));
  });
  it('renders invoice history filters and reprint button based on permissions', async () => {
    window.history.pushState({}, '', '/invoices?invoice_number=00000001');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/api/auth/session')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 3,
              name: 'Supervisor Validacion',
              email: 'supervisor.validacion@hospital-san-isidro.local',
              username: 'supervisor.validacion',
              active: true,
              roles: ['supervisor'],
              permissions: ['invoices.view', 'receipts.reprint', 'receipts.reprint_any'],
              must_change_password: false,
            },
          }),
        } as Response;
      }

      if (url.includes('/api/invoices') && !url.includes('/api/invoices/')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 100,
                invoice_number: '000-001-01-00000001',
                patient_name: 'Maria Lopez',
                subtotal: '15.00',
                tax_amount: '2.25',
                discount_amount: '0.00',
                total: '17.25',
                paid_amount: '17.25',
                balance_due: '0.00',
                status: 'paid',
                issued_at: '2026-05-17T08:00:00-06:00',
                items: [],
                issuer: { id: 2, name: 'Cajero Validacion', username: 'cajero.validacion' },
              },
            ],
            meta: { current_page: 1, per_page: 10, total: 1 },
          }),
        } as Response;
      }

      if (url.includes('/api/invoices/100') && !url.includes('/receipt') && !url.includes('/reprint')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 100,
              invoice_number: '000-001-01-00000001',
              patient_name: 'Maria Lopez',
              subtotal: '15.00',
              tax_amount: '2.25',
              discount_amount: '0.00',
              total: '17.25',
              paid_amount: '17.25',
              balance_due: '0.00',
              status: 'paid',
              issued_at: '2026-05-17T08:00:00-06:00',
              void_reason: null,
              items: [
                {
                  id: 1,
                  service_id: 11,
                  service_name: 'Glucosa',
                  category_id: 1,
                  category_name: 'Laboratorio',
                  quantity: '1.00',
                  unit_price: '15.00',
                  tax_rate: '15.00',
                  tax_amount: '2.25',
                  line_subtotal: '15.00',
                  line_total: '17.25',
                  special_rule_code: null,
                  special_rule_applied: false,
                  notes: null,
                },
              ],
              payments: [],
            },
          }),
        } as Response;
      }

      if (url.includes('/api/invoices/100/reprint')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              receipt: {
                width: 'half_letter',
                hospital: { name: 'Hospital San Isidro', rtn: '08011999123456' },
                fiscal: {
                  cai: 'TEST-CAI',
                  authorized_range: '000-001-01-00000001 a 000-001-01-99999999',
                  valid_until: '2027-05-17',
                },
                invoice: {
                  id: 100,
                  invoice_number: '000-001-01-00000001',
                  issued_at: '2026-05-17T08:00:00-06:00',
                  cashier: 'Cajero Validacion',
                  patient_name: 'Maria Lopez',
                  subtotal: '15.00',
                  tax_amount: '2.25',
                  discount_amount: '0.00',
                  total: '17.25',
                  paid_amount: '17.25',
                  balance_due: '0.00',
                  status: 'paid',
                },
                items: [],
                payments: [],
              },
            },
          }),
        } as Response;
      }

      if (url.includes('/api/invoices/100/receipt')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              receipt: {
                width: 'half_letter',
                hospital: { name: 'Hospital San Isidro', rtn: '08011999123456' },
                fiscal: {
                  cai: 'TEST-CAI',
                  authorized_range: '000-001-01-00000001 a 000-001-01-99999999',
                  valid_until: '2027-05-17',
                },
                invoice: {
                  id: 100,
                  invoice_number: '000-001-01-00000001',
                  issued_at: '2026-05-17T08:00:00-06:00',
                  cashier: 'Cajero Validacion',
                  patient_name: 'Maria Lopez',
                  subtotal: '15.00',
                  tax_amount: '2.25',
                  discount_amount: '0.00',
                  total: '17.25',
                  paid_amount: '17.25',
                  balance_due: '0.00',
                  status: 'paid',
                },
                items: [],
                payments: [],
              },
            },
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ data: null }),
      } as Response;
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: /historial de facturas/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/desde/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/paciente/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/n.mero de factura/i)).toHaveValue('00000001');
    expect(screen.getByLabelText(/estado/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('invoice_number=00000001'))).toBe(true);
    });

    expect(await screen.findByRole('button', { name: /reimprimir/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /anular factura/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reimprimir/i }));
    fireEvent.change(await screen.findByLabelText(/motivo de reimpresi/i), {
      target: { value: 'Copia solicitada por caja' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /registrar reimpresi/i }));
    expect(await screen.findByLabelText(/vista previa del recibo/i)).toBeInTheDocument();
    await waitFor(() => {
      const receiptEl = screen.getByLabelText(/recibo institucional/i);
      expect(receiptEl).toBeInTheDocument();
      expect(receiptEl).toHaveClass('receipt-half-letter');
    });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/reprint'))).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /^imprimir$/i }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/reprint'))).toHaveLength(2);
    });
    const printAuditCall = fetchMock.mock.calls.filter(([url]) => String(url).includes('/reprint'))[1];
    expect(JSON.parse(String(printAuditCall[1]?.body))).toMatchObject({
      reason: 'Impresión desde vista de recibo.',
      width: 'half_letter',
    });
  });

  it('applies received cash as balance due and keeps change visible', () => {
    const confirmSpy = vi.fn();

    render(
      <PaymentModal
        open
        onOpenChange={vi.fn()}
        invoiceNumber="000-001-01-00000003"
        patientName="Maria Lopez"
        total="17.25"
        balanceDue="17.25"
        paymentMethod="cash"
        paymentAmount="17.25"
        onPaymentMethodChange={vi.fn()}
        onPaymentAmountChange={vi.fn()}
        onPaymentReferenceChange={vi.fn()}
        onConfirm={confirmSpy}
      />,
    );

    expect(screen.getAllByText('L 17.25').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro/i }));
    expect(confirmSpy).toHaveBeenCalledWith('17.25');
  });

  it('renders malformed payment modal invoice amounts as safe financial values', () => {
    render(
      <PaymentModal
        open
        onOpenChange={vi.fn()}
        invoiceNumber="000-001-01-00000006"
        patientName="Maria Lopez"
        total="monto-danado"
        balanceDue="NaN"
        paymentMethod="cash"
        paymentAmount=""
        onPaymentMethodChange={vi.fn()}
        onPaymentAmountChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText('Maria Lopez')).toBeInTheDocument();
    expect(document.body.textContent).toContain('L 0.00');
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|undefined/);
  });

  it('calculates cash change and applied amount using cents', () => {
    const confirmSpy = vi.fn();

    render(
      <PaymentModal
        open
        onOpenChange={vi.fn()}
        invoiceNumber="000-001-01-00000005"
        patientName="Maria Lopez"
        total="0.20"
        balanceDue="0.20"
        paymentMethod="cash"
        paymentAmount="0.20"
        onPaymentMethodChange={vi.fn()}
        onPaymentAmountChange={vi.fn()}
        onConfirm={confirmSpy}
      />,
    );

    expect(screen.getAllByText('L 0.20').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro/i }));
    expect(confirmSpy).toHaveBeenCalledWith('0.20');
  });

  it('allows partial payment and shows the remaining balance clearly', () => {
    const confirmSpy = vi.fn();

    render(
      <PaymentModal
        open
        onOpenChange={vi.fn()}
        invoiceNumber="000-001-01-00000004"
        patientName="Maria Lopez"
        total="17.25"
        balanceDue="17.25"
        paymentMethod="cash"
        paymentAmount="10.00"
        paymentReference=""
        onPaymentMethodChange={vi.fn()}
        onPaymentAmountChange={vi.fn()}
        onPaymentReferenceChange={vi.fn()}
        onConfirm={confirmSpy}
        partialPaymentsEnabled
      />,
    );

    expect(screen.getAllByText(/saldo pendiente/i).length).toBeGreaterThan(0);
    expect(screen.getByText('L 7.25')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro/i }));
    expect(confirmSpy).toHaveBeenCalledWith('10.00');
  });

  it('shows a reference field for non-cash payments and separates them from expected cash', () => {
    const referenceSpy = vi.fn();

    render(
      <PaymentModal
        open
        onOpenChange={vi.fn()}
        invoiceNumber="000-001-01-00000005"
        patientName="Maria Lopez"
        total="17.25"
        balanceDue="17.25"
        paymentMethod="transfer"
        paymentAmount="17.25"
        paymentReference=""
        onPaymentMethodChange={vi.fn()}
        onPaymentAmountChange={vi.fn()}
        onPaymentReferenceChange={referenceSpy}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText(/separado del efectivo esperado/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/referencia de pago/i), {
      target: { value: 'TRX-555' },
    });
    expect(referenceSpy).toHaveBeenCalledWith('TRX-555');
  });

  it('scopes receipt print hiding to the explicit printing receipt state', () => {
    const styles = readFileSync('src/styles.css', 'utf8');

    expect(styles).toContain('.print-hidden');
    expect(styles).toContain('display: none !important;');
    expect(styles).toContain('body[data-printing-receipt="true"] *');
    expect(styles).toContain('@page receipt-half-letter');
    expect(styles).toContain('size: 8.5in 5.5in;');
    expect(styles).toContain('.institutional-receipt.receipt-letter');
    expect(styles).toContain('.institutional-receipt.receipt-a5');
    expect(styles).toContain('.institutional-receipt.receipt-80mm');
    expect(styles).toContain('.institutional-receipt.receipt-58mm');
    expect(styles).toContain('@page receipt-80mm');
    expect(styles).toContain('@page receipt-58mm');
    expect(styles).not.toContain('body * {\n      visibility: hidden;');
    expect(styles).not.toContain('body * {\r\n      visibility: hidden;');
  });

  it('formats local dates without converting them through UTC', () => {
    expect(localDateString(new Date(2026, 4, 17, 23, 30))).toBe('2026-05-17');
  });

  it('shows void reason confirmation for users with invoice void permission', async () => {
    window.history.pushState({}, '', '/invoices');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/api/auth/session')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 1,
              name: 'Administrador Validacion',
              email: 'admin.validacion@hospital-san-isidro.local',
              username: 'admin.validacion',
              active: true,
              roles: ['admin'],
              permissions: ['invoices.view', 'invoices.void', 'receipts.reprint', 'receipts.reprint_any'],
              must_change_password: false,
            },
          }),
        } as Response;
      }

      if (url.includes('/api/invoices') && !url.includes('/api/invoices/')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 101,
                invoice_number: '000-001-01-00000002',
                patient_name: 'Jose Perez',
                subtotal: '15.00',
                tax_amount: '2.25',
                discount_amount: '0.00',
                total: '17.25',
                paid_amount: '0.00',
                balance_due: '17.25',
                status: 'issued',
                issued_at: '2026-05-17T09:00:00-06:00',
                items: [],
                issuer: { id: 2, name: 'Cajero Validacion', username: 'cajero.validacion' },
              },
            ],
            meta: { current_page: 1, per_page: 10, total: 1 },
          }),
        } as Response;
      }

      if (url.includes('/api/invoices/101') && !url.includes('/void')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 101,
              invoice_number: '000-001-01-00000002',
              patient_name: 'Jose Perez',
              subtotal: '15.00',
              tax_amount: '2.25',
              discount_amount: '0.00',
              total: '17.25',
              paid_amount: '0.00',
              balance_due: '17.25',
              status: 'issued',
              issued_at: '2026-05-17T09:00:00-06:00',
              void_reason: null,
              items: [],
              payments: [],
            },
          }),
        } as Response;
      }

      if (url.includes('/api/invoices/101/void')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 101,
              invoice_number: '000-001-01-00000002',
              patient_name: 'Jose Perez',
              subtotal: '15.00',
              tax_amount: '2.25',
              discount_amount: '0.00',
              total: '17.25',
              paid_amount: '0.00',
              balance_due: '17.25',
              status: 'void',
              issued_at: '2026-05-17T09:00:00-06:00',
              void_reason: 'Error de captura',
              items: [],
              payments: [],
            },
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    });

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: /anular/i }));
    expect(await screen.findByLabelText(/motivo de anulación/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/motivo de anulación/i), {
      target: { value: 'Error de captura' },
    });
    fireEvent.click(screen.getByRole('button', { name: /anular factura/i }));

    await waitFor(() => {
      // After the void POST, the list refetches via TanStack Query
      // invalidation, so the last call is the GET, not the POST.
      // Assert that the POST was issued at some point.
      const calledWithVoid = fetchMock.mock.calls.some(([url, init]) => {
        return (
          String(url).includes('/api/invoices/101/void')
          && (init as RequestInit | undefined)?.method === 'POST'
        );
      });
      expect(calledWithVoid).toBe(true);
    });
  });

  it('renders institutional receipt print structure with fiscal valid until date', async () => {
    const receipt: ReceiptData = {
      width: '80mm',
      hospital: { name: 'Hospital San Isidro', rtn: '08011999123456' },
      fiscal: {
        cai: 'VALIDACION-CAI',
        authorized_range: '000-001-01-00000001 a 000-001-01-99999999',
        valid_until: '2027-05-17',
      },
      invoice: {
        id: 100,
        invoice_number: '000-001-01-00000001',
        issued_at: '2026-05-17T08:00:00-06:00',
        cashier: 'Cajero Validacion',
        patient_name: 'Maria Lopez',
        subtotal: '15.00',
        tax_amount: '2.25',
        discount_amount: '0.00',
        total: '17.25',
        paid_amount: '17.25',
        balance_due: '0.00',
        status: 'paid',
      },
      items: [
        {
          service_name: 'Glucosa',
          category_name: 'Laboratorio',
          quantity: '1.00',
          unit_price: '15.00',
          tax_amount: '2.25',
          line_total: '17.25',
          special_rule_code: null,
          special_rule_applied: false,
          notes: null,
        },
      ],
      payments: [
        {
          id: 50,
          method: 'cash',
          amount: '17.25',
          reference: null,
          paid_at: '2026-05-17T08:03:00-06:00',
          cashier: 'Cajero Validacion',
        },
      ],
    };
    const printSpy = vi.fn();

    render(<ReceiptPreview receipt={receipt} onWidthChange={vi.fn()} onPrint={printSpy} />);

    expect(screen.getByLabelText(/recibo institucional/i)).toHaveClass('receipt-80mm');
    expect(screen.getByText(/termico 80mm/i)).toBeInTheDocument();
    expect(screen.getByText(/vence/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /imprimir/i }));
    await waitFor(() => expect(printSpy).toHaveBeenCalledOnce());
  });

  it('shows pending fiscal configuration on receipts without real authorization data', () => {
    const receipt: ReceiptData = {
      width: 'letter',
      hospital: { name: 'Hospital San Isidro', rtn: null },
      fiscal: {
        cai: null,
        authorized_range: null,
        valid_until: null,
      },
      invoice: {
        id: 100,
        invoice_number: '000-001-01-00000001',
        issued_at: '2026-05-17T08:00:00-06:00',
        cashier: 'Cajero',
        patient_name: 'Maria Lopez',
        subtotal: '15.00',
        tax_amount: '2.25',
        discount_amount: '0.00',
        total: '17.25',
        paid_amount: '17.25',
        balance_due: '0.00',
        status: 'paid',
      },
      items: [],
      payments: [],
    };

    render(<ReceiptPreview receipt={receipt} onWidthChange={vi.fn()} />);

    expect(screen.getByLabelText(/recibo institucional/i)).toHaveClass('receipt-letter');
    expect(screen.getAllByText(/configuración pendiente/i)).toHaveLength(3);
    expect(screen.queryByText(/\bQR\b|barra|barcode|codigo interno/i)).not.toBeInTheDocument();
  });

  describe('dialysis prescription gating', () => {
    it('allows a user with permission to mark a dialysis prescription and estimates 0.00', async () => {
      window.history.pushState({}, '', '/billing/new');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let createdInvoicePayload: any = null;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.includes('/api/auth/session')) {
          return {
            ok: true,
            json: async () => ({
              data: {
                id: 2,
                name: 'Cajero Admin',
                email: 'admin@hospital.local',
                username: 'admin',
                active: true,
                roles: ['cajero'],
                permissions: ['catalog.view', 'cash.view', 'invoices.create', 'payments.create', 'receipts.view', 'patients.mark_dialysis_prescription'],
                must_change_password: false,
              },
            }),
          } as Response;
        }
        if (url.includes('/api/cash-sessions/current')) {
          return { ok: true, json: async () => ({ data: { id: 1, status: 'open' } }) } as Response;
        }
        if (url.includes('/api/services')) {
          return {
            ok: true,
            json: async () => ({
              data: [{
                id: 3,
                category_id: 1,
                area_id: 1,
                name: 'Eritropoyetina',
                price: '25.00',
                taxable: false,
                active: true,
                special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
                category: { id: 1, name: 'General' },
                area: { id: 1, name: 'Farmacia' },
              }],
            }),
          } as Response;
        }
        if (url.includes('/api/categories')) {
          return { ok: true, json: async () => ({ data: [{ id: 1, name: 'General' }] }) } as Response;
        }
        if (url.includes('/api/service-areas')) {
          return { ok: true, json: async () => ({ data: [{ id: 1, name: 'Farmacia' }] }) } as Response;
        }
        if (url.includes('/api/invoices') && init?.method === 'POST') {
          createdInvoicePayload = JSON.parse(String(init.body));
          return {
            ok: true,
            json: async () => ({ data: { id: 1, invoice_number: 'INV-1', status: 'issued', total: '0.00', balance_due: '0.00' } }),
          } as Response;
        }
        return { ok: true, json: async () => ({}) } as Response;
      });

      render(<App />);

      await screen.findByRole('heading', { name: /nueva factura/i });
      fireEvent.click(await screen.findByRole('radio', { name: /farmacia/i }));
      fireEvent.click(await screen.findByRole('button', { name: /eritropoyetina/i }));

      const checkbox = await screen.findByRole('checkbox');
      expect(checkbox).toBeEnabled();
      fireEvent.click(checkbox);

      // Verify that the preview estimate handles the free prescription
      expect(screen.getAllByText('L 0.00').length).toBeGreaterThan(0);

      // Fill required fields to submit
      fireEvent.change(screen.getByLabelText(/nombre del paciente/i), { target: { value: 'Juan Perez' } });
      fireEvent.click(primarySubmitButton(/emitir/i));
      fireEvent.click(screen.getByRole('button', { name: /confirmar emisión/i }));

      await waitFor(() => {
        expect(createdInvoicePayload).not.toBeNull();
      });

      expect(createdInvoicePayload.dialysis_prescription).toBe(true);
      expect(createdInvoicePayload.items[0].dialysis_prescription).toBe(true);
    });

    it('prevents a user without permission from marking a dialysis prescription and estimating 0.00', async () => {
      window.history.pushState({}, '', '/billing/new');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let createdInvoicePayload: any = null;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.includes('/api/auth/session')) {
          return {
            ok: true,
            json: async () => ({
              data: {
                id: 2,
                name: 'Cajero Normal',
                email: 'normal@hospital.local',
                username: 'normal',
                active: true,
                roles: ['cajero'],
                permissions: ['catalog.view', 'cash.view', 'invoices.create', 'payments.create', 'receipts.view'],
                must_change_password: false,
              },
            }),
          } as Response;
        }
        if (url.includes('/api/cash-sessions/current')) {
          return { ok: true, json: async () => ({ data: { id: 1, status: 'open' } }) } as Response;
        }
        if (url.includes('/api/services')) {
          return {
            ok: true,
            json: async () => ({
              data: [{
                id: 3,
                category_id: 1,
                area_id: 1,
                name: 'Eritropoyetina',
                price: '25.00',
                taxable: false,
                active: true,
                special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
                category: { id: 1, name: 'General' },
                area: { id: 1, name: 'Farmacia' },
              }],
            }),
          } as Response;
        }
        if (url.includes('/api/categories')) {
          return { ok: true, json: async () => ({ data: [{ id: 1, name: 'General' }] }) } as Response;
        }
        if (url.includes('/api/service-areas')) {
          return { ok: true, json: async () => ({ data: [{ id: 1, name: 'Farmacia' }] }) } as Response;
        }
        if (url.includes('/api/invoices') && init?.method === 'POST') {
          createdInvoicePayload = JSON.parse(String(init.body));
          return {
            ok: true,
            json: async () => ({ data: { id: 1, invoice_number: 'INV-1', status: 'issued', total: '25.00', balance_due: '25.00' } }),
          } as Response;
        }
        return { ok: true, json: async () => ({}) } as Response;
      });

      render(<App />);

      await screen.findByRole('heading', { name: /nueva factura/i });
      fireEvent.click(await screen.findByRole('radio', { name: /farmacia/i }));
      fireEvent.click(await screen.findByRole('button', { name: /eritropoyetina/i }));

      const checkbox = await screen.findByRole('checkbox');
      expect(checkbox).toBeDisabled();

      // Ensure price is estimated normally, not as 0.00
      expect(screen.getAllByText('L 25.00').length).toBeGreaterThan(0);

      // Submit
      fireEvent.change(screen.getByLabelText(/nombre del paciente/i), { target: { value: 'Juan Perez' } });
      fireEvent.click(primarySubmitButton(/emitir/i));
      fireEvent.click(screen.getByRole('button', { name: /emitir y abrir cobro/i }));

      await waitFor(() => {
        expect(createdInvoicePayload).not.toBeNull();
      });

      expect(createdInvoicePayload.dialysis_prescription).toBe(false);
      expect(createdInvoicePayload.items[0].dialysis_prescription).toBe(false);
    });
  });
});
