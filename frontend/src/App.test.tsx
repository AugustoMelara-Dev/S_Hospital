import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { localDateString } from './features/invoices/InvoiceHistoryView';
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
    expect(screen.getByRole('navigation', { name: /navegacion principal/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /configuracion fiscal/i })).toHaveAttribute(
      'href',
      '#configuracion-fiscal',
    );
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

    expect(await screen.findByRole('link', { name: /caja/i })).toHaveAttribute('href', '#caja');
    expect(screen.queryByRole('link', { name: /backups/i })).not.toBeInTheDocument();
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

  it('renders reports view for a user with reports view permission', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 3,
            name: 'Supervisor Demo',
            email: 'supervisor.demo@hospital-billing.local',
            username: 'supervisor.demo',
            active: true,
            roles: ['supervisor'],
            permissions: ['reports.view'],
            must_change_password: false,
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            date: '2026-05-17',
            total_billed: '28.75',
            total_collected: '17.25',
            invoice_count: 2,
            payment_count: 1,
            payments_by_method: {
              cash: '17.25',
              transfer: '0.00',
              card: '0.00',
              other: '0.00',
            },
            invoices_by_status: {
              issued: { count: 1, total: '11.50' },
              partial: { count: 0, total: '0.00' },
              paid: { count: 1, total: '17.25' },
              void: { count: 0, total: '0.00' },
            },
          },
        }),
      } as Response);

    render(<App />);

    expect(await screen.findByRole('heading', { name: /^reportes$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/fecha diaria/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/desde/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hasta/i)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /^reporte diario$/i })).toBeInTheDocument();
    expect(screen.getByText(/total cobrado/i)).toBeInTheDocument();
    expect(screen.getAllByText('L. 17.25').length).toBeGreaterThan(0);
  });

  it('does not render reports for a cashier without reports view permission', async () => {
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
            permissions: ['cash.view'],
            must_change_password: false,
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: null }),
      } as Response);

    render(<App />);

    expect(await screen.findByRole('heading', { name: /^caja$/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^reportes$/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/fecha diaria/i)).not.toBeInTheDocument();
  });

  it('renders backups view and empty state for an admin', async () => {
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
            permissions: ['backups.view', 'backups.create', 'backups.download'],
            must_change_password: false,
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [],
          meta: { current_page: 1, per_page: 15, total: 0 },
        }),
      } as Response);

    render(<App />);

    expect(await screen.findByRole('heading', { name: /backups locales/i })).toBeInTheDocument();
    expect(await screen.findByText(/no hay backups registrados/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear backup/i })).toBeEnabled();
  });

  it('does not render backups for a user without backup permission', async () => {
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
            permissions: ['cash.view'],
            must_change_password: false,
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: null }),
      } as Response);

    render(<App />);

    expect(await screen.findByRole('heading', { name: /^caja$/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /backups locales/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crear backup/i })).not.toBeInTheDocument();
  });

  it('creates a manual backup from the admin backups view', async () => {
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
            permissions: ['backups.view', 'backups.create', 'backups.download'],
            must_change_password: false,
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [],
          meta: { current_page: 1, per_page: 15, total: 0 },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 9,
            filename: 'hospital-backup-20260517-101500-test.sql',
            size_bytes: 2048,
            checksum_sha256: 'a'.repeat(64),
            status: 'pending',
            type: 'manual',
            created_by: 1,
            completed_at: null,
            created_at: '2026-05-17T10:15:00-06:00',
            updated_at: '2026-05-17T10:15:00-06:00',
            creator: { id: 1, name: 'Admin Demo', username: 'admin.demo' },
          },
        }),
      } as Response);

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: /crear backup/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/api/backups'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect(await screen.findByText('hospital-backup-20260517-101500-test.sql')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /descargar backup hospital-backup/i })).not.toBeInTheDocument();
  });

  it('renders successful backups with accessible download and pagination controls', async () => {
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
            permissions: ['backups.view', 'backups.download'],
            must_change_password: false,
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 10,
              filename: 'hospital-backup-20260517-101500-test.sql',
              size_bytes: 2048,
              checksum_sha256: 'b'.repeat(64),
              status: 'success',
              type: 'manual',
              created_by: 1,
              completed_at: '2026-05-17T10:15:00-06:00',
              created_at: '2026-05-17T10:15:00-06:00',
              updated_at: '2026-05-17T10:15:00-06:00',
              creator: { id: 1, name: 'Admin Demo', username: 'admin.demo' },
            },
          ],
          meta: { current_page: 1, per_page: 15, total: 16 },
        }),
      } as Response);

    render(<App />);

    expect(await screen.findByText('hospital-backup-20260517-101500-test.sql')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /descargar backup hospital-backup-20260517-101500-test\.sql/i,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crear backup/i })).not.toBeInTheDocument();
    expect(screen.getByText(/pagina 1 de 2/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /siguiente/i })).toBeEnabled();
  });

  it('renders report date filters and empty category state after loading range', async () => {
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
            permissions: ['reports.view'],
            must_change_password: false,
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            date: '2026-05-17',
            total_billed: '0.00',
            total_collected: '0.00',
            invoice_count: 0,
            payment_count: 0,
            payments_by_method: {
              cash: '0.00',
              transfer: '0.00',
              card: '0.00',
              other: '0.00',
            },
            invoices_by_status: {
              issued: { count: 0, total: '0.00' },
              partial: { count: 0, total: '0.00' },
              paid: { count: 0, total: '0.00' },
              void: { count: 0, total: '0.00' },
            },
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            date_from: '2026-05-17',
            date_to: '2026-05-17',
            cash_session_id: null,
            user_id: null,
            total_collected: '0.00',
            payments_by_method: {
              cash: '0.00',
              transfer: '0.00',
              card: '0.00',
              other: '0.00',
            },
            payment_count: 0,
            invoice_count: 0,
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            date_from: '2026-05-17',
            date_to: '2026-05-17',
            categories: [],
          },
        }),
      } as Response);

    render(<App />);

    expect(await screen.findByRole('heading', { name: /^reportes$/i })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /^reporte diario$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/desde/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hasta/i)).toBeInTheDocument();
    expect(screen.getByText(/rango maximo permitido: 31 dias/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ver rango/i }));

    expect(await screen.findByText(/ingresos por rango/i)).toBeInTheDocument();
    expect(await screen.findByText(/sin categorias en el rango seleccionado/i)).toBeInTheDocument();
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
            permissions: ['cash.view', 'invoices.create', 'payments.create'],
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

  it('renders invoice history filters and reprint button based on permissions', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
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
      } as Response)
      .mockResolvedValueOnce({
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
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            receipt: {
              width: '80mm',
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
      } as Response);

    render(<App />);

    expect(await screen.findByRole('heading', { name: /historial de facturas/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/desde/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/paciente/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/numero de factura/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/estado/i)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /ver/i }));

    expect(await screen.findByRole('button', { name: /reimprimir/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /anular factura/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reimprimir/i }));
    expect(await screen.findByRole('heading', { name: /preview termico/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/ancho del recibo/i), { target: { value: '58mm' } });
    expect(screen.getByLabelText(/recibo termico/i)).toHaveClass('receipt-58mm');
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/reprint'))).toHaveLength(1);
  });

  it('formats local dates without converting them through UTC', () => {
    expect(localDateString(new Date(2026, 4, 17, 23, 30))).toBe('2026-05-17');
  });

  it('shows void reason confirmation for users with invoice void permission', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
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
            permissions: ['invoices.view', 'invoices.void', 'receipts.reprint', 'receipts.reprint_any'],
            must_change_password: false,
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
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
      } as Response)
      .mockResolvedValueOnce({
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
      } as Response)
      .mockResolvedValueOnce({
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
      } as Response);

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: /ver/i }));
    expect(await screen.findByLabelText(/motivo de anulacion/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/motivo de anulacion/i), {
      target: { value: 'Error de captura' },
    });
    fireEvent.click(screen.getByRole('button', { name: /anular factura/i }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/api/invoices/101/void'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
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
