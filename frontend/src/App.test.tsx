import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { ReceiptPreview } from './features/receipts/ReceiptPreview';
import { type ReceiptData } from './lib/api';

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the login screen when there is no session', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Unauthenticated.' }),
    } as Response);

    render(<App />);

    expect(await screen.findByRole('heading', { name: /acceso local/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/usuario o email/i)).toBeInTheDocument();
  });

  it('renders fiscal settings for an authenticated admin', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 1,
            name: 'Admin Demo',
            email: 'admin.demo@hospital-billing.local',
            username: 'admin.demo',
            active: true,
            roles: ['admin'],
            permissions: ['settings.fiscal.view', 'settings.fiscal.update'],
            must_change_password: false,
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            hospital_name: 'Hospital Demo',
            rtn: '08011999123456',
            default_tax_rate: '15.00',
            receipt_width: '80mm',
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 1,
              document_type: 'invoice',
              prefix: '000-001-01',
              min_number: 1,
              max_number: 99999999,
              current_number: 0,
              cai: 'DEMO-CAI',
              valid_until: '2027-05-17',
              active: true,
            },
          ],
        }),
      } as Response);

    render(<App />);

    expect(await screen.findByRole('heading', { name: /datos fiscales del hospital/i })).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Hospital Demo')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('DEMO-CAI')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar configuracion/i })).toBeEnabled();
  });

  it('renders catalog as read only for a cashier', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 2,
            name: 'Cajero Demo',
            email: 'cajero.demo@hospital-billing.local',
            username: 'cajero.demo',
            active: true,
            roles: ['cajero'],
            permissions: ['catalog.view'],
            must_change_password: false,
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 1,
              name: 'Laboratorio',
              slug: 'laboratorio',
              active: true,
              sort_order: 0,
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 10,
              category_id: 1,
              name: 'Eritropoyetina',
              slug: 'eritropoyetina',
              price: '25.00',
              taxable: true,
              active: true,
              special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
              category: {
                id: 1,
                name: 'Laboratorio',
                slug: 'laboratorio',
                active: true,
                sort_order: 0,
              },
            },
          ],
        }),
      } as Response);

    render(<App />);

    expect(await screen.findByRole('heading', { name: /categorias y servicios/i })).toBeInTheDocument();
    expect(await screen.findByText('Eritropoyetina')).toBeInTheDocument();
    expect(screen.getByText(/cajero puede consultar catalogo/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /guardar servicio/i })).not.toBeInTheDocument();
  });

  it('shows cash status and allows opening a cash session', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 2,
            name: 'Cajero Demo',
            email: 'cajero.demo@hospital-billing.local',
            username: 'cajero.demo',
            active: true,
            roles: ['cajero'],
            permissions: ['cash.view', 'cash.open', 'cash.close'],
            must_change_password: false,
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: null }),
      } as Response)
      .mockResolvedValueOnce({
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
      } as Response);

    render(<App />);

    expect(await screen.findByRole('heading', { name: /^caja$/i })).toBeInTheDocument();
    expect(await screen.findByText(/sin caja abierta/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /abrir caja/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/api/cash-sessions/open'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect((await screen.findAllByText(/caja abierta/i)).length).toBeGreaterThan(0);
  });

  it('renders payment form after issuing an invoice without adding reports', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 2,
            name: 'Cajero Demo',
            email: 'cajero.demo@hospital-billing.local',
            username: 'cajero.demo',
            active: true,
            roles: ['cajero'],
            permissions: ['cash.view', 'invoices.create', 'invoices.view', 'payments.create'],
            must_change_password: false,
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: null }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 10,
              category_id: 1,
              name: 'Eritropoyetina',
              slug: 'eritropoyetina',
              price: '25.00',
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
      } as Response)
      .mockResolvedValueOnce({
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
      } as Response);

    render(<App />);

    expect(await screen.findByRole('heading', { name: /nueva factura/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre del paciente/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/buscar servicios activos/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/nombre del paciente/i), {
      target: { value: 'Maria Lopez' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /eritropoyetina/i }));
    fireEvent.click(screen.getByRole('button', { name: /emitir factura/i }));

    expect(await screen.findByRole('heading', { name: /registrar pago/i })).toBeInTheDocument();
    expect(screen.getByText(/abra caja antes de cobrar/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/metodo de pago/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /reportes/i })).not.toBeInTheDocument();
  });

  it('shows receipt preview after registering payment', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 2,
            name: 'Cajero Demo',
            email: 'cajero.demo@hospital-billing.local',
            username: 'cajero.demo',
            active: true,
            roles: ['cajero'],
            permissions: ['cash.view', 'invoices.create', 'payments.create', 'receipts.view'],
            must_change_password: false,
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
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
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 11,
              category_id: 1,
              name: 'Glucosa',
              slug: 'glucosa',
              price: '15.00',
              taxable: true,
              active: true,
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
      } as Response)
      .mockResolvedValueOnce({
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
            paid_amount: '0.00',
            balance_due: '17.25',
            status: 'issued',
            issued_at: '2026-05-17T08:00:00-06:00',
            items: [],
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
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
            invoice: {
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
            },
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            width: '80mm',
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
          },
        }),
      } as Response);

    render(<App />);

    fireEvent.change(await screen.findByLabelText(/nombre del paciente/i), {
      target: { value: 'Maria Lopez' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /glucosa/i }));
    fireEvent.click(screen.getByRole('button', { name: /emitir factura/i }));
    expect(await screen.findByRole('heading', { name: /registrar pago/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cobrar/i }));

    expect(await screen.findByRole('heading', { name: /preview termico/i })).toBeInTheDocument();
    expect(await screen.findByText(/hospital demo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ancho del recibo/i)).toHaveValue('80mm');
  });

  it('renders 58mm receipt print structure with fiscal valid until date', () => {
    const receipt: ReceiptData = {
      width: '58mm',
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
      expect(document.body.dataset.receiptWidth).toBe('58mm');
    });

    render(<ReceiptPreview receipt={receipt} onWidthChange={vi.fn()} onPrint={printSpy} />);

    expect(screen.getByLabelText(/recibo termico/i)).toHaveClass('receipt-58mm');
    expect(screen.getByText(/fecha limite/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /imprimir/i }));
    expect(printSpy).toHaveBeenCalledOnce();
    expect(document.body.dataset.receiptWidth).toBeUndefined();
  });

  it('lets a user with required password change submit a new password', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 1,
            name: 'Admin Demo',
            email: 'admin.demo@hospital-billing.local',
            username: 'admin.demo',
            active: true,
            roles: ['admin'],
            permissions: ['settings.fiscal.view', 'settings.fiscal.update'],
            must_change_password: true,
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 1,
            name: 'Admin Demo',
            email: 'admin.demo@hospital-billing.local',
            username: 'admin.demo',
            active: true,
            roles: ['admin'],
            permissions: ['settings.fiscal.view', 'settings.fiscal.update'],
            must_change_password: false,
          },
        }),
      } as Response);

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: /cambio obligatorio de contrasena/i }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/contrasena actual/i), {
      target: { value: 'Password123!' },
    });
    fireEvent.change(screen.getByLabelText(/^nueva contrasena$/i), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.change(screen.getByLabelText(/confirmar nueva contrasena/i), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /actualizar contrasena/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/api/auth/change-password'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
