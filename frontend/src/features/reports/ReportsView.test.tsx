/// <reference types="node" />
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { apiClient } from '../../lib/api';
import { queryClient } from '../../lib/query-client';
import { resetRequestChain } from '../../lib/api/base';

describe('ReportsView', () => {
  function activateTab(name: RegExp) {
    const tab = screen.getByRole('tab', { name });
    tab.focus();
    fireEvent.pointerDown(tab, { button: 0, ctrlKey: false });
    fireEvent.keyDown(tab, { key: 'Enter', code: 'Enter' });
    fireEvent.click(tab);
  }

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

  it('renders reports view for a user with reports view permission', async () => {
    window.history.pushState({}, '', '/reports');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
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
              permissions: ['reports.view', 'reports.managerial.view', 'reports.export', 'reports.cash_session.view'],
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
              total_billed: '28.75',
              total_collected: '17.25',
              total_pending: '11.50',
              total_partial: '0.00',
              total_voided: '0.00',
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
        } as Response;
      }
      if (url.includes('/api/categories')) {
        return {
          ok: true,
          json: async () => ({
            data: [],
          }),
        } as Response;
      }
      if (url.includes('/api/areas')) {
        return {
          ok: true,
          json: async () => ({
            data: [],
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    render(<App />);

    expect((await screen.findAllByRole('heading', { name: /^reportes$/i })).length).toBeGreaterThan(0);
    expect(screen.getByText(/facturacion, cobros, caja y auditoria en una vista clara/i)).toBeInTheDocument();
    expect(screen.queryByText(/ventas, cobros, caja y auditoria/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^fecha$/i)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /^resumen del dia$/i })).toBeInTheDocument();
    expect(screen.getByText(/^cobrado$/i)).toBeInTheDocument();
    expect(screen.getAllByText('L. 17.25').length).toBeGreaterThan(0);
    expect(screen.getByText(/^pendiente$/i)).toBeInTheDocument();
    expect(screen.getAllByText('L. 11.50').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/undefined|\bNaN\b/);
    activateTab(/rango/i);
    expect(await screen.findByLabelText(/desde/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hasta/i)).toBeInTheDocument();
  });

  it('renders the monthly financial summary from backend facts', async () => {
    window.history.pushState({}, '', '/reports');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/auth/session')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 1,
              name: 'Administracion Validacion',
              email: 'administracion.validacion@hospital-san-isidro.local',
              username: 'administracion.validacion',
              active: true,
              roles: ['admin'],
              permissions: ['reports.view', 'reports.managerial.view', 'reports.export', 'reports.cash_session.view'],
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
              total_billed: '0.00',
              total_collected: '0.00',
              total_pending: '0.00',
              total_partial: '0.00',
              total_voided: '0.00',
              invoice_count: 0,
              payment_count: 0,
              payments_by_method: { cash: '0.00', transfer: '0.00', card: '0.00', other: '0.00' },
              invoices_by_status: {
                issued: { count: 0, total: '0.00' },
                partial: { count: 0, total: '0.00' },
                paid: { count: 0, total: '0.00' },
                void: { count: 0, total: '0.00' },
              },
            },
          }),
        } as Response;
      }
      if (url.includes('/api/categories')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }
      if (url.includes('/api/areas')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }
      if (url.includes('/api/reports/monthly')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              month: '2026-05',
              date_from: '2026-05-01',
              date_to: '2026-05-31',
              total_billed: '57.50',
              total_collected: '22.25',
              total_pending: '35.25',
              total_partial: '11.50',
              total_voided: '17.25',
              invoice_count: 4,
              payment_count: 2,
              payments_by_method: { cash: '17.25', transfer: '5.00', card: '0.00', other: '0.00' },
              invoices_by_status: {
                issued: { count: 1, total: '28.75' },
                partial: { count: 1, total: '11.50' },
                paid: { count: 1, total: '17.25' },
                void: { count: 1, total: '17.25' },
              },
              daily_totals: [
                {
                  date: '2026-05-03',
                  total_billed: '17.25',
                  total_collected: '17.25',
                  total_pending: '0.00',
                  total_partial: '0.00',
                  total_voided: '0.00',
                  invoice_count: 1,
                  payment_count: 1,
                },
                {
                  date: '2026-05-04',
                  total_billed: '40.25',
                  total_collected: '5.00',
                  total_pending: '35.25',
                  total_partial: '11.50',
                  total_voided: '17.25',
                  invoice_count: 3,
                  payment_count: 1,
                },
              ],
            },
          }),
        } as Response;
      }

      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    render(<App />);

    expect((await screen.findAllByRole('heading', { name: /^reportes$/i })).length).toBeGreaterThan(0);
    activateTab(/mensual/i);
    expect(await screen.findByRole('heading', { name: /^resumen mensual$/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^mes$/i), { target: { value: '2026-05' } });
    fireEvent.click(screen.getByRole('button', { name: /ver mes/i }));

    expect((await screen.findAllByText(/^facturado$/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText('L. 57.50').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^cobrado$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('L. 22.25').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^pendiente$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('L. 35.25').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /cobros por m.todo/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /estados de factura/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /evoluci.n por fecha/i })).toBeInTheDocument();
    expect(screen.getByText('2026-05-04')).toBeInTheDocument();
    expect(screen.getByText('Transferencia')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/undefined|\bNaN\b/);
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/reports/monthly?month=2026-05'))).toBe(true);
    });
  });

  it('renders malformed daily and monthly report amounts as zero instead of raw values', async () => {
    window.history.pushState({}, '', '/reports');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/auth/session')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 1,
              name: 'Administracion Validacion',
              email: 'administracion.validacion@hospital-san-isidro.local',
              username: 'administracion.validacion',
              active: true,
              roles: ['admin'],
              permissions: ['reports.view', 'reports.managerial.view', 'reports.export', 'reports.cash_session.view'],
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
              total_billed: 'monto-danado',
              total_collected: 'NaN',
              total_pending: 'no-numero',
              total_partial: '',
              total_voided: 'monto-danado',
              invoice_count: 1,
              payment_count: 1,
              payments_by_method: { cash: 'monto-danado', transfer: '', card: 'NaN', other: 'no-numero' },
              invoices_by_status: {
                issued: { count: 1, total: 'monto-danado' },
                partial: { count: 0, total: 'NaN' },
                paid: { count: 0, total: '' },
                void: { count: 0, total: 'no-numero' },
              },
            },
          }),
        } as Response;
      }
      if (url.includes('/api/reports/monthly')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              month: '2026-05',
              date_from: '2026-05-01',
              date_to: '2026-05-31',
              total_billed: 'monto-danado',
              total_collected: 'NaN',
              total_pending: 'no-numero',
              total_partial: '',
              total_voided: 'monto-danado',
              invoice_count: 1,
              payment_count: 1,
              payments_by_method: { cash: 'monto-danado', transfer: '', card: 'NaN', other: 'no-numero' },
              invoices_by_status: {
                issued: { count: 1, total: 'monto-danado' },
                partial: { count: 0, total: 'NaN' },
                paid: { count: 0, total: '' },
                void: { count: 0, total: 'no-numero' },
              },
              daily_totals: [
                {
                  date: '2026-05-04',
                  total_billed: 'monto-danado',
                  total_collected: 'NaN',
                  total_pending: 'no-numero',
                  total_partial: '',
                  total_voided: 'monto-danado',
                  invoice_count: 1,
                  payment_count: 1,
                },
              ],
            },
          }),
        } as Response;
      }
      if (url.includes('/api/categories')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }
      if (url.includes('/api/areas')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }
      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    render(<App />);

    expect((await screen.findAllByRole('heading', { name: /^reportes$/i })).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.getAllByText('L. 0.00').length).toBeGreaterThanOrEqual(5);
    });
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|no-numero/);

    activateTab(/mensual/i);
    fireEvent.change(screen.getByLabelText(/^mes$/i), { target: { value: '2026-05' } });
    fireEvent.click(screen.getByRole('button', { name: /ver mes/i }));

    expect(await screen.findByText('2026-05-04')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText('L. 0.00').length).toBeGreaterThanOrEqual(10);
    });
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|no-numero/);
  });

  it('exports reports through the protected backend Excel endpoint', async () => {
    window.history.pushState({}, '', '/reports');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:report'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    const createObjectUrl = vi.mocked(URL.createObjectURL);
    const revokeObjectUrl = vi.mocked(URL.revokeObjectURL);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
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
              permissions: ['reports.view', 'reports.managerial.view', 'reports.export', 'reports.cash_session.view'],
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
              total_pending: '0.00',
              total_partial: '0.00',
              total_voided: '0.00',
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

      if (url.includes('/api/areas')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }

      if (url.includes('/api/reports/export')) {
        return {
          ok: true,
          blob: async () => new Blob(['excel-data'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        } as Response;
      }

      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    render(<App />);

    expect((await screen.findAllByRole('heading', { name: /^reportes$/i })).length).toBeGreaterThan(0);
    fireEvent.click(await screen.findByRole('button', { name: /exportar excel/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/reports/export?'),
        expect.objectContaining({ credentials: 'include' }),
      );
    });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('date_from=') && String(url).includes('date_to='))).toBe(true);
    expect(createObjectUrl).toHaveBeenCalled();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:report');
  });

  it('hides local report excel export without reports export permission', async () => {
    window.history.pushState({}, '', '/reports');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
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
              total_pending: '0.00',
              total_partial: '0.00',
              total_voided: '0.00',
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

      if (url.includes('/api/areas')) {
        return {
          ok: true,
          json: async () => ({
            data: [{ id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true }],
          }),
        } as Response;
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

      if (url.includes('/api/reports/areas')) {
        return {
          ok: true,
          json: async () => ({ data: { date_from: '2026-05-17', date_to: '2026-05-17', filters: {}, areas: [{ area_id: 1, area: 'Laboratorio', item_count: 1, quantity: '1.00', total: '17.25' }] } }),
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
              cashiers: [{ user: 'Cajero Validacion', cash_session_count: 1, invoice_count: 1, total_collected: '17.25' }],
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
    expect(screen.getByRole('heading', { name: /servicios m.s facturados/i })).toBeInTheDocument();
    expect(screen.getAllByText(/monto facturado/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /exportar excel/i })).not.toBeInTheDocument();
    expect(screen.getByText(/permiso de exportaci[oó]n de reportes/i)).toBeInTheDocument();

    activateTab(/auditor/i);
    expect(screen.queryByRole('button', { name: /exportar excel/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/permiso de reportes/i).length).toBeGreaterThan(0);
  });

  it('does not render reports for a cashier without reports view permission', async () => {
    window.history.pushState({}, '', '/cashbox');
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
              permissions: ['cash.view'],
              must_change_password: false,
            },
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    render(<App />);

    expect((await screen.findAllByRole('heading', { name: /^caja$/i })).length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: /^reportes$/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^fecha$/i)).not.toBeInTheDocument();
  });

  it('allows cash-session-only report users to open the cash report tab without managerial reports', async () => {
    window.history.pushState({}, '', '/reports');
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
              permissions: ['reports.cash_session.view'],
              must_change_password: false,
            },
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    render(<App />);

    expect((await screen.findAllByRole('heading', { name: /^reportes$/i })).length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: /^caja$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/n.mero de caja/i)).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /diario/i })).not.toBeInTheDocument();
  });

  it('renders report date filters and empty category state after loading range', async () => {
    window.history.pushState({}, '', '/reports');
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
              permissions: ['reports.view', 'reports.managerial.view', 'reports.export', 'reports.cash_session.view'],
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
              total_billed: '0.00',
              total_collected: '0.00',
              total_pending: '0.00',
              total_partial: '0.00',
              total_voided: '0.00',
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
        } as Response;
      }

      if (url.includes('/api/categories')) {
        return {
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
        } as Response;
      }

      if (url.includes('/api/areas')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 4,
                name: 'Radiologia',
                slug: 'radiologia',
                active: true,
              },
            ],
          }),
        } as Response;
      }

      if (url.includes('/api/reports/income')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              date_from: '2026-05-17',
              date_to: '2026-05-17',
              cash_session_id: null,
              user_id: null,
              total_billed: '0.00',
              total_collected: '0.00',
              total_pending: '0.00',
              total_partial: '0.00',
              total_voided: '0.00',
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
        } as Response;
      }

      if (url.includes('/api/reports/categories')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              date_from: '2026-05-17',
              date_to: '2026-05-17',
              categories: [],
            },
          }),
        } as Response;
      }

      if (url.includes('/api/reports/areas')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              date_from: '2026-05-17',
              date_to: '2026-05-17',
              filters: {},
              areas: [{ area_id: 4, area: 'Radiologia', item_count: 1, quantity: '1.00', total: '51.75' }],
            },
          }),
        } as Response;
      }

      if (url.includes('/api/reports/services')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              date_from: '2026-05-17',
              date_to: '2026-05-17',
              services: [],
            },
          }),
        } as Response;
      }

      if (url.includes('/api/reports/operations')) {
        return {
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
        } as Response;
      }

      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    render(<App />);

    expect((await screen.findAllByRole('heading', { name: /^reportes$/i })).length).toBeGreaterThan(0);
    expect(await screen.findByRole('heading', { name: /^resumen del dia$/i })).toBeInTheDocument();
    activateTab(/rango/i);
    expect(await screen.findByLabelText(/desde/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hasta/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^area$/i)).toBeInTheDocument();
    expect(screen.getByText(/puede consultar hasta 31 dias por busqueda/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ver rango/i }));

    expect(await screen.findByText(/^cobrado$/i)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /por area/i })).toBeInTheDocument();
    expect(screen.getByText('Radiologia')).toBeInTheDocument();
    expect(screen.getByText('L. 51.75')).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/reports/areas?'))).toBe(true);
    });
    activateTab(/servicios/i);
    expect(await screen.findByText(/sin categor.as facturadas/i)).toBeInTheDocument();
    expect(await screen.findByText(/sin servicios facturados/i)).toBeInTheDocument();
    expect(screen.queryByText(/sin categorias cobradas/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sin servicios cobrados/i)).not.toBeInTheDocument();
    activateTab(/auditor.a/i);
    expect((await screen.findAllByText(/sin eventos operativos/i)).length).toBeGreaterThan(0);
  });
});
