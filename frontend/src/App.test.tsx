import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { PaymentModal } from './features/invoices/components/PaymentModal';
import { localDateString } from './features/invoices/InvoiceHistoryView';
import { ReceiptPreview } from './features/receipts/ReceiptPreview';
import { apiClient, type ReceiptData } from './lib/api';
import { queryClient } from './lib/query-client';

describe('App', () => {
  function activateTab(name: RegExp) {
    const tab = screen.getByRole('tab', { name });
    tab.focus();
    fireEvent.pointerDown(tab, { button: 0, ctrlKey: false });
    fireEvent.keyDown(tab, { key: 'Enter', code: 'Enter' });
    fireEvent.click(tab);
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient.clear();
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
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

  it('renders app shell and fiscal settings route for an authenticated admin', async () => {
    window.history.pushState({}, '', '/settings/fiscal');
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

    const navigation = await screen.findByRole('navigation', { name: /navegaci[oó]n principal/i });

    expect(navigation).toBeInTheDocument();
    expect(navigation.closest('aside')).toHaveClass('print-hidden');
    expect(screen.getByRole('banner')).toHaveClass('print-hidden');
    expect(screen.getByRole('contentinfo')).toHaveClass('print-hidden');
    expect(screen.getByRole('link', { name: /configuraci[oó]n fiscal/i })).toHaveAttribute(
      'href',
      '/settings/fiscal',
    );
    expect(await screen.findByRole('heading', { name: /configuraci[oó]n fiscal/i })).toBeInTheDocument();
    activateTab(/datos del hospital/i);
    expect(await screen.findByRole('heading', { name: /datos del hospital/i })).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Hospital Demo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar informaci.n/i })).toBeEnabled();
    activateTab(/secuencia fiscal/i);
    expect(await screen.findByDisplayValue('DEMO-CAI')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar secuencia/i })).toBeEnabled();
  });

  it('renders catalog as read only for a cashier', async () => {
    window.history.pushState({}, '', '/catalog');
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

    expect(await screen.findByRole('heading', { name: /cat[aá]logo de servicios/i })).toBeInTheDocument();
    expect((await screen.findAllByText('Eritropoyetina')).length).toBeGreaterThan(0);
    expect(screen.getByText(/cajero puede consultar catalogo/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /guardar servicio/i })).not.toBeInTheDocument();
  });

  it('shows cash status and allows opening a cash session', async () => {
    window.history.pushState({}, '', '/cashbox');
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
      } as Response)
      .mockResolvedValueOnce({
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
      } as Response)
      .mockResolvedValueOnce({
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

    expect(await screen.findByRole('link', { name: /caja/i })).toHaveAttribute('href', '/cashbox');
    expect(screen.queryByRole('link', { name: /backups/i })).not.toBeInTheDocument();
    expect((await screen.findAllByRole('heading', { name: /^caja$/i })).length).toBeGreaterThan(0);
    expect(await screen.findByText(/no hay una caja abierta actualmente/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /abrir caja/i }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url, options]) => {
          const requestOptions = options as RequestInit | undefined;
          return String(url).includes('/api/cash-sessions/open') && requestOptions?.method === 'POST';
        }),
      ).toBe(true);
    });
    expect((await screen.findAllByText(/caja abierta/i)).length).toBeGreaterThan(0);
  });

  it('renders reports view for a user with reports view permission', async () => {
    window.history.pushState({}, '', '/reports');
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
            permissions: ['reports.view', 'reports.managerial.view', 'reports.export', 'reports.cash_session.view'],
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
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [],
        }),
      } as Response);

    render(<App />);

    expect((await screen.findAllByRole('heading', { name: /^reportes$/i })).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/fecha diaria/i)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /^reporte diario$/i })).toBeInTheDocument();
    expect(screen.getByText(/total cobrado/i)).toBeInTheDocument();
    expect(screen.getAllByText('L. 17.25').length).toBeGreaterThan(0);
    activateTab(/rango/i);
    expect(await screen.findByLabelText(/desde/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hasta/i)).toBeInTheDocument();
  });

  it('hides local report csv export without reports export permission', async () => {
    window.history.pushState({}, '', '/reports');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
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
              permissions: ['reports.view', 'reports.managerial.view'],
              must_change_password: false,
            },
          }),
        } as Response;
      }

      if (url.includes('/api/reports/daily')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              date: '2026-05-17',
              total_billed: '17.25',
              total_collected: '17.25',
              invoice_count: 1,
              payment_count: 1,
              payments_by_method: { cash: '17.25', transfer: '0.00', card: '0.00', other: '0.00' },
              invoices_by_status: {
                issued: { count: 0, total: '0.00' },
                partial: { count: 0, total: '0.00' },
                paid: { count: 1, total: '17.25' },
                void: { count: 0, total: '0.00' },
              },
            },
          }),
        } as Response;
      }

      if (url.includes('/api/categories')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }

      if (url.includes('/api/reports/income')) {
        return {
          ok: true,
          json: async () => ({ data: { range: { date_from: '2026-05-17', date_to: '2026-05-17' }, totals: { billed: '17.25', collected: '17.25', balance_due: '0.00' }, by_method: [], by_status: [] } }),
        } as Response;
      }

      if (url.includes('/api/reports/categories')) {
        return {
          ok: true,
          json: async () => ({ data: { categories: [{ category: 'Laboratorio', quantity: '1.00', subtotal: '15.00', tax: '2.25', total: '17.25' }] } }),
        } as Response;
      }

      if (url.includes('/api/reports/services')) {
        return {
          ok: true,
          json: async () => ({ data: { services: [{ service: 'Glucosa', category: 'Laboratorio', quantity: '1.00', total: '17.25' }] } }),
        } as Response;
      }

      if (url.includes('/api/reports/operations')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              summary: { void_count: 0, reprint_count: 0, backup_count: 0, failed_backup_count: 0, cashier_count: 1 },
              voids: [],
              reprints: [],
              backups: [],
              cashiers: [{ user: 'Cajero Demo', cash_session_count: 1, invoice_count: 1, total_collected: '17.25' }],
            },
          }),
        } as Response;
      }

      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    render(<App />);
    expect((await screen.findAllByRole('heading', { name: /^reportes$/i })).length).toBeGreaterThan(0);

    activateTab(/servicios/i);
    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));
    expect(await screen.findByText(/glucosa/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /exportar csv/i })).not.toBeInTheDocument();
    expect(screen.getByText(/requiere permiso de exportacion/i)).toBeInTheDocument();

    activateTab(/auditor/i);
    expect(screen.queryByRole('button', { name: /exportar csv/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/requiere permiso de exportacion/i).length).toBeGreaterThan(0);
  });

  it('does not render reports for a cashier without reports view permission', async () => {
    window.history.pushState({}, '', '/cashbox');
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

    expect((await screen.findAllByRole('heading', { name: /^caja$/i })).length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: /^reportes$/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/fecha diaria/i)).not.toBeInTheDocument();
  });

  it('renders backups view actions for an admin', async () => {
    window.history.pushState({}, '', '/backups');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
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
              permissions: ['backups.view', 'backups.create', 'backups.download'],
              must_change_password: false,
            },
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({
          data: [],
          meta: { current_page: 1, per_page: 15, total: 0 },
        }),
      } as Response;
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: /^backups$/i })).toBeInTheDocument();
    expect(await screen.findByText(/sistema de backups/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /crear backup/i }).some((button) => !button.hasAttribute('disabled'))).toBe(true);
  });

  it('does not render backups for a user without backup permission', async () => {
    window.history.pushState({}, '', '/cashbox');
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

    expect((await screen.findAllByRole('heading', { name: /^caja$/i })).length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: /backups locales/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crear backup/i })).not.toBeInTheDocument();
  });

  it('creates a manual backup from the admin backups view', async () => {
    window.history.pushState({}, '', '/backups');
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
        json: async () => ({}),
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

    const createBackupButton = await screen.findByRole('button', { name: /crear backup/i });
    await waitFor(() => expect(createBackupButton).toBeEnabled());
    fireEvent.click(createBackupButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/api/backups'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect(await screen.findByText('hospital-backup-20260517-101500-test.sql')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /descargar backup hospital-backup/i })).not.toBeInTheDocument();
  });

  it('renders successful backups with accessible download and pagination controls', async () => {
    window.history.pushState({}, '', '/backups');
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
    window.history.pushState({}, '', '/reports');
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
            permissions: ['reports.view', 'reports.managerial.view', 'reports.export', 'reports.cash_session.view'],
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
          data: [
            {
              id: 4,
              name: 'Radiologia',
              slug: 'radiologia',
              active: true,
              sort_order: 20,
            },
          ],
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
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            date_from: '2026-05-17',
            date_to: '2026-05-17',
            services: [],
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            date_from: '2026-05-17',
            date_to: '2026-05-17',
            summary: {
              void_count: 0,
              reprint_count: 0,
              backup_count: 0,
              failed_backup_count: 0,
              cashier_count: 0,
            },
            voids: [],
            reprints: [],
            backups: [],
            cashiers: [],
          },
        }),
      } as Response);

    render(<App />);

    expect((await screen.findAllByRole('heading', { name: /^reportes$/i })).length).toBeGreaterThan(0);
    expect(await screen.findByRole('heading', { name: /^reporte diario$/i })).toBeInTheDocument();
    activateTab(/rango/i);
    expect(await screen.findByLabelText(/desde/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hasta/i)).toBeInTheDocument();
    expect(screen.getByText(/rango m.ximo permitido: 31 dias/i)).toBeInTheDocument();
    expect(screen.getByText(/rango m.ximo permitido: 31 dias/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ver rango/i }));

    expect(await screen.findByText(/total ingresos/i)).toBeInTheDocument();
    activateTab(/servicios/i);
    expect(await screen.findByText(/sin categorias cobradas/i)).toBeInTheDocument();
    expect(await screen.findByText(/sin servicios cobrados/i)).toBeInTheDocument();
    activateTab(/auditor.a/i);
    expect((await screen.findAllByText(/sin eventos operativos/i)).length).toBeGreaterThan(0);
  });

  it('renders payment form after issuing an invoice without adding reports', async () => {
    window.history.pushState({}, '', '/billing/new');
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
            permissions: ['catalog.view', 'cash.view', 'invoices.create', 'payments.create', 'receipts.view'],
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
              id: 1,
              name: 'Medicamentos',
              slug: 'medicamentos',
              active: true,
              sort_order: 4,
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
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
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
    expect(await screen.findByLabelText(/nombre del paciente/i)).toBeInTheDocument();
    expect(await screen.findByLabelText(/buscar por nombre, categoria o codigo/i)).toBeInTheDocument();
    expect(await screen.findByLabelText(/scanner usb o codigo manual/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/buscar por nombre, categoria o codigo/i), {
      target: { value: 'eritropoyetina' },
    });
    expect(await screen.findByRole('button', { name: /eritropoyetina/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /eritropoyetina/i }));
    expect(screen.getByRole('button', { name: /emitir factura/i })).toBeDisabled();
    expect((await screen.findAllByText(/debe abrir la caja antes de emitir facturas/i)).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText(/nombre del paciente/i), {
      target: { value: 'Maria Lopez' },
    });
    expect(screen.getByRole('button', { name: /emitir factura/i })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: /abrir caja/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('dialog', { name: /confirmar factura/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /registrar pago/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /reportes/i })).not.toBeInTheDocument();
  });

  it('shows receipt preview after registering payment', async () => {
    window.history.pushState({}, '', '/billing/new');
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
            permissions: ['catalog.view', 'cash.view', 'invoices.create', 'payments.create', 'receipts.view'],
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
              id: 1,
              name: 'Laboratorio',
              slug: 'laboratorio',
              active: true,
              sort_order: 1,
            },
          ],
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
              scan_code: 'LAB-GLU-001',
              barcode: null,
              qr_code: null,
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
        json: async () => ({}),
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
        json: async () => ({}),
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
    fireEvent.change(await screen.findByLabelText(/buscar por nombre, categoria o codigo/i), {
      target: { value: 'glucosa' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /glucosa/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /emitir factura/i })).toBeEnabled());
    await waitFor(() => expect(screen.getAllByText(/L\. 17\.25/i).length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: /emitir factura/i }));
    expect(await screen.findByRole('button', { name: /confirmar emision/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /confirmar emision/i }));
    expect(await screen.findByRole('dialog', { name: /factura emitida/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cobrar ahora/i }));
    expect(await screen.findByRole('heading', { name: /registrar pago/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro/i }));

    expect(await screen.findByLabelText(/vista previa del recibo/i)).toBeInTheDocument();
    expect(await screen.findByText(/hospital demo/i)).toBeInTheDocument();
    expect(screen.getByText('80mm')).toBeInTheDocument();
  });

  it('rejects inactive services returned by scanner lookup', async () => {
    window.history.pushState({}, '', '/billing/new');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
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
    expect(screen.getByRole('button', { name: /agregar servicios/i })).toBeDisabled();
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

    expect((await screen.findAllByText(/no se encontro servicio para este codigo/i)).length).toBeGreaterThan(0);
  });

  it('renders invoice history filters and reprint button based on permissions', async () => {
    window.history.pushState({}, '', '/invoices');
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
        json: async () => ({}),
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
    expect(await screen.findByLabelText(/vista previa del recibo/i)).toBeInTheDocument();
    await waitFor(() => {
      const receiptEl = screen.getByLabelText(/recibo termico/i);
      expect(receiptEl).toBeInTheDocument();
      expect(receiptEl).toHaveClass('receipt-80mm');
    });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/reprint'))).toHaveLength(1);

    fireEvent.change(screen.getByLabelText(/ancho de vista previa/i), { target: { value: '58mm' } });

    await waitFor(() => {
      expect(screen.getByLabelText(/recibo termico/i)).toHaveClass('receipt-58mm');
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

  it('treats persistent 419 responses as an expired session', async () => {
    const expiredSpy = vi.fn();
    apiClient.onSessionExpired(expiredSpy);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 419,
      json: async () => ({ message: 'CSRF token mismatch.' }),
    } as Response);

    await expect(
      apiClient.registerPayment(1, {
        cash_session_id: 1,
        method: 'cash',
        amount: '17.25',
      }),
    ).rejects.toThrow(/sesion/i);

    expect(expiredSpy).toHaveBeenCalledOnce();
    apiClient.onSessionExpired(null);
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
    expect(screen.getByText(/vence/i)).toBeInTheDocument();
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

  it('renders not found for an unknown authenticated route', async () => {
    window.history.pushState({}, '', '/ruta-inexistente');
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
      } as Response);

    render(<App />);

    expect(await screen.findByText(/ruta no encontrada/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^reportes$/i })).not.toBeInTheDocument();
  });

  it('renders only the active module instead of all modules at once', async () => {
    window.history.pushState({}, '', '/reports');
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
            permissions: [
              'cash.view',
              'catalog.view',
              'invoices.create',
              'invoices.view',
              'reports.view',
              'reports.managerial.view',
              'reports.export',
              'reports.cash_session.view',
              'backups.view',
              'settings.fiscal.view',
            ],
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
      } as Response);

    render(<App />);

    expect((await screen.findAllByRole('heading', { name: /^reportes$/i })).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /nueva factura/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /configuraci[oó]n fiscal/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /nueva factura/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /datos fiscales del hospital/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /backups locales/i })).not.toBeInTheDocument();
  });
});
