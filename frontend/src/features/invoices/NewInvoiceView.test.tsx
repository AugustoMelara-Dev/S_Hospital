/// <reference types="node" />
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { PaymentModal } from '../../features/invoices/components/PaymentModal';
import { localDateString } from '../../features/invoices/InvoiceHistoryView';
import { ReceiptPreview } from '../../features/receipts/ReceiptPreview';
import { apiClient, type ReceiptData } from '../../lib/api';
import { queryClient } from '../../lib/query-client';
import { resetRequestChain } from '../../lib/api/base';

describe('NewInvoiceView', () => {
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
              name: 'Cajero Demo',
              email: 'cajero.demo@hospital-billing.local',
              username: 'cajero.demo',
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
    expect(await screen.findByLabelText(/buscar por nombre, categoria o codigo/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/scanner usb o codigo manual/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/buscar por nombre, categoria o codigo/i), {
      target: { value: 'eritropoyetina' },
    });
    expect(await screen.findByRole('button', { name: /eritropoyetina/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /eritropoyetina/i }));
    expect(screen.getByRole('button', { name: /emitir y cobrar/i })).toBeDisabled();
    expect((await screen.findAllByText(/debe abrir la caja antes de emitir facturas/i)).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText(/nombre del paciente/i), {
      target: { value: 'Maria Lopez' },
    });
    expect(screen.getByRole('button', { name: /emitir y cobrar/i })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: /abrir caja/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('dialog', { name: /confirmar factura/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /registrar pago/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /reportes/i })).not.toBeInTheDocument();
  });

  it('shows receipt preview after registering payment', async () => {
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
              name: 'Cajero Demo',
              email: 'cajero.demo@hospital-billing.local',
              username: 'cajero.demo',
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
            },
          }),
        } as Response;
      }

      if (url.includes('/api/invoices/100/receipt')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              width: 'half_letter',
              hospital: { name: 'Hospital Demo', rtn: '08011999123456' },
              fiscal: {
                cai: 'DEMO-CAI',
                authorized_range: '000-001-01-00000001 a 000-001-01-99999999',
                valid_until: '2027-05-17',
              },
              invoice: { ...paidInvoice, cashier: 'Cajero Demo' },
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
                  cashier: 'Cajero Demo',
                },
              ],
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
    fireEvent.change(await screen.findByLabelText(/buscar por nombre, categoria o codigo/i), {
      target: { value: 'glucosa' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /glucosa/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /emitir y cobrar/i })).toBeEnabled());
    await waitFor(() => expect(screen.getAllByText(/L\. 17\.25/i).length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: /emitir y cobrar/i }));
    expect(await screen.findByRole('button', { name: /emitir y abrir cobro/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /emitir y abrir cobro/i }));
    expect(await screen.findByRole('heading', { name: /registrar pago/i })).toBeInTheDocument();
    expect(screen.getByText(/ingrese el monto recibido/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/monto recibido/i), { target: { value: '17.25' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro/i }));

    expect((await screen.findAllByLabelText(/vista previa del recibo/i)).length).toBeGreaterThan(0);
    expect(await screen.findByText(/hospital demo/i)).toBeInTheDocument();
    expect(screen.getByText('Media carta')).toBeInTheDocument();
  });

  it('rejects inactive services returned by scanner lookup', async () => {
    window.history.pushState({}, '', '/billing/new');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/api/settings/fiscal')) {
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
              name: 'Cajero Demo',
              email: 'cajero.demo@hospital-billing.local',
              username: 'cajero.demo',
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

    fireEvent.change(await screen.findByLabelText(/scanner usb o codigo manual/i), {
      target: { value: 'INACTIVE-001' },
    });
    fireEvent.click(screen.getByRole('button', { name: /escanear/i }));

    expect((await screen.findAllByText(/servicio esta inactivo/i)).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /agregue servicios/i })).toBeDisabled();
    expect(screen.queryByText(/servicio descontinuado/i)).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([url]) => {
        const value = String(url);
        return value.includes('/api/services') && value.includes('code=INACTIVE-001') && !value.includes('active=1');
      }),
    ).toBe(true);
  });

  it('shows a clear scanner error when the code does not exist', async () => {
    window.history.pushState({}, '', '/billing/new');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/api/settings/fiscal')) {
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
              name: 'Cajero Demo',
              email: 'cajero.demo@hospital-billing.local',
              username: 'cajero.demo',
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

    fireEvent.change(await screen.findByLabelText(/scanner usb o codigo manual/i), {
      target: { value: 'MISSING-001' },
    });
    fireEvent.click(screen.getByRole('button', { name: /escanear/i }));

    expect((await screen.findAllByText(/no se encontro servicio activo para este codigo/i)).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.getByLabelText(/scanner usb o codigo manual/i)).toHaveFocus();
    });
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
              name: 'Supervisor Demo',
              email: 'supervisor.demo@hospital-billing.local',
              username: 'supervisor.demo',
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
                issuer: { id: 2, name: 'Cajero Demo', username: 'cajero.demo' },
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
                hospital: { name: 'Hospital Demo', rtn: '08011999123456' },
                fiscal: {
                  cai: 'TEST-CAI',
                  authorized_range: '000-001-01-00000001 a 000-001-01-99999999',
                  valid_until: '2027-05-17',
                },
                invoice: {
                  id: 100,
                  invoice_number: '000-001-01-00000001',
                  issued_at: '2026-05-17T08:00:00-06:00',
                  cashier: 'Cajero Demo',
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
                hospital: { name: 'Hospital Demo', rtn: '08011999123456' },
                fiscal: {
                  cai: 'TEST-CAI',
                  authorized_range: '000-001-01-00000001 a 000-001-01-99999999',
                  valid_until: '2027-05-17',
                },
                invoice: {
                  id: 100,
                  invoice_number: '000-001-01-00000001',
                  issued_at: '2026-05-17T08:00:00-06:00',
                  cashier: 'Cajero Demo',
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
    fireEvent.click(await screen.findByRole('button', { name: /registrar reimpresi/i }));
    expect(await screen.findByLabelText(/vista previa del recibo/i)).toBeInTheDocument();
    await waitFor(() => {
      const receiptEl = screen.getByLabelText(/recibo institucional/i);
      expect(receiptEl).toBeInTheDocument();
      expect(receiptEl).toHaveClass('receipt-half_letter');
    });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/reprint'))).toHaveLength(1);
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
        paymentAmount="20.00"
        onPaymentMethodChange={vi.fn()}
        onPaymentAmountChange={vi.fn()}
        onConfirm={confirmSpy}
      />,
    );

    expect(screen.getByText('L. 2.75')).toBeInTheDocument();
    expect(screen.getAllByText('L. 17.25').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro/i }));
    expect(confirmSpy).toHaveBeenCalledWith('17.25');
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
        onPaymentMethodChange={vi.fn()}
        onPaymentAmountChange={vi.fn()}
        onConfirm={confirmSpy}
        partialPaymentsEnabled
      />,
    );

    expect(screen.getAllByText(/saldo pendiente/i).length).toBeGreaterThan(0);
    expect(screen.getByText('L. 7.25')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro/i }));
    expect(confirmSpy).toHaveBeenCalledWith('10.00');
  });

  it('scopes receipt print hiding to the explicit printing receipt state', () => {
    const styles = readFileSync('src/styles.css', 'utf8');

    expect(styles).toContain('body[data-printing-receipt="true"] *');
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
              name: 'Admin Demo',
              email: 'admin.demo@hospital-billing.local',
              username: 'admin.demo',
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
                issuer: { id: 2, name: 'Cajero Demo', username: 'cajero.demo' },
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

    fireEvent.click(await screen.findByRole('button', { name: /ver/i }));
    fireEvent.click(await screen.findByRole('button', { name: /anular/i }));
    expect(await screen.findByLabelText(/motivo de anulacion/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/motivo de anulacion/i), {
      target: { value: 'Error de captura' },
    });
    fireEvent.click(screen.getByRole('button', { name: /anular factura/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/api/invoices/101/void'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('renders institutional receipt print structure with fiscal valid until date', async () => {
    const receipt: ReceiptData = {
      width: 'half_letter',
      hospital: { name: 'Hospital Demo', rtn: '08011999123456' },
      fiscal: {
        cai: 'DEMO-CAI',
        authorized_range: '000-001-01-00000001 a 000-001-01-99999999',
        valid_until: '2027-05-17',
      },
      invoice: {
        id: 100,
        invoice_number: '000-001-01-00000001',
        issued_at: '2026-05-17T08:00:00-06:00',
        cashier: 'Cajero Demo',
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
          cashier: 'Cajero Demo',
        },
      ],
    };
    const printSpy = vi.fn(() => {
      expect(document.body.dataset.receiptWidth).toBe('half_letter');
    });

    render(<ReceiptPreview receipt={receipt} onWidthChange={vi.fn()} onPrint={printSpy} />);

    expect(screen.getByLabelText(/recibo institucional/i)).toHaveClass('receipt-half_letter');
    expect(screen.getByText(/vence/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /imprimir/i }));
    expect(printSpy).toHaveBeenCalledOnce();
    await waitFor(() => expect(document.body.dataset.receiptWidth).toBeUndefined());
  });
});
