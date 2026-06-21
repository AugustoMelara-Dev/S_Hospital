/// <reference types="node" />
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { ReportsView } from './ReportsView';
import { AuditoriaTab } from './components/AuditoriaTab';
import { ApiError, apiClient } from '../../lib/api';
import { queryClient } from '../../lib/query-client';
import { resetRequestChain } from '../../lib/api/base';
import type { ExecutiveReport, OperationsReport } from '../../lib/api/types';

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

    expect((await screen.findAllByRole('heading', { name: /^reportes$/i }, { timeout: 5000 })).length).toBeGreaterThan(0);
    expect(screen.getByText(/facturación, cobros, caja y auditoría en una vista clara/i)).toBeInTheDocument();
    expect(screen.queryByText(/ventas, cobros, caja y auditoria/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^fecha$/i)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /^resumen del día$/i })).toBeInTheDocument();
    expect(screen.getByText(/^cobrado$/i)).toBeInTheDocument();
    expect(screen.getAllByText('L 17.25').length).toBeGreaterThan(0);
    expect(screen.getByText(/^pendiente$/i)).toBeInTheDocument();
    expect(screen.getAllByText('L 11.50').length).toBeGreaterThan(0);
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
    expect(screen.getAllByText('L 57.50').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^cobrado$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('L 22.25').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^pendiente$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('L 35.25').length).toBeGreaterThan(0);
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
      expect(screen.getAllByText('L 0.00').length).toBeGreaterThanOrEqual(5);
    });
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|no-numero/);

    activateTab(/mensual/i);
    fireEvent.change(screen.getByLabelText(/^mes$/i), { target: { value: '2026-05' } });
    fireEvent.click(screen.getByRole('button', { name: /ver mes/i }));

    expect(await screen.findByText('2026-05-04')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText('L 0.00').length).toBeGreaterThanOrEqual(10);
    });
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|no-numero/);
  });

  it('loads and renders area reports from backend aggregates', async () => {
    window.history.pushState({}, '', '/reports');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/api/auth/session')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 1,
              name: 'Admin Validacion',
              email: 'admin.validacion@hospital.local',
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
              date: '2026-05-31',
              total_billed: '0.00',
              total_collected: '0.00',
              total_balance_due: '0.00',
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

      if (url.includes('/api/reports/income')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              date_from: '2026-05-31',
              date_to: '2026-05-31',
              filters: {},
              total_billed: '46.00',
              total_collected: '46.00',
              total_balance_due: '0.00',
              payments_by_method: { cash: '17.25', transfer: '0.00', card: '28.75', other: '0.00' },
              invoices_by_status: {
                issued: { count: 0, total: '0.00' },
                partial: { count: 0, total: '0.00' },
                paid: { count: 2, total: '46.00' },
                void: { count: 0, total: '0.00' },
              },
              payment_count: 2,
              invoice_count: 2,
            },
          }),
        } as Response;
      }

      if (url.includes('/api/reports/categories')) {
        return { ok: true, json: async () => ({ data: { date_from: '2026-05-31', date_to: '2026-05-31', filters: {}, categories: [] } }) } as Response;
      }

      if (url.includes('/api/reports/services')) {
        return { ok: true, json: async () => ({ data: { date_from: '2026-05-31', date_to: '2026-05-31', filters: {}, services: [] } }) } as Response;
      }

      if (url.includes('/api/reports/operations')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              date_from: '2026-05-31',
              date_to: '2026-05-31',
              filters: {},
              summary: { void_count: 0, reprint_count: 0, audit_event_count: 0, backup_count: 0, failed_backup_count: 0, cashier_count: 0 },
              voids: [],
              reprints: [],
              audit_events: [],
              backups: [],
              cashiers: [],
            },
          }),
        } as Response;
      }

      if (url.includes('/api/reports/areas')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              date_from: '2026-05-31',
              date_to: '2026-05-31',
              filters: {},
              areas: [
                {
                  area_id: 1,
                  area: 'Laboratorio',
                  item_count: 1,
                  invoice_count: 1,
                  quantity: '1.00',
                  subtotal: '15.00',
                  tax_amount: '2.25',
                  total: '17.25',
                  collected: '17.25',
                  balance_due: '0.00',
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
    activateTab(/por rango/i);
    fireEvent.click(await screen.findByRole('button', { name: /ver rango/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/reports/areas?'),
        expect.objectContaining({ credentials: 'include' }),
      );
    });

    expect(await screen.findByText('Laboratorio')).toBeInTheDocument();
    expect(screen.getAllByText('L 17.25').length).toBeGreaterThan(0);
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

  it('exports executive PDF and Excel through the protected api client', async () => {
    vi.spyOn(apiClient, 'getExecutiveReport').mockResolvedValue(createExecutiveReportFixture());
    vi.spyOn(apiClient, 'getDailyReport').mockResolvedValue({
      date: '2026-06-16',
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
    });
    vi.spyOn(apiClient, 'getCategories').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getAreas').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getCashSessions').mockResolvedValue({ data: [], meta: { current_page: 1, per_page: 50, total: 0 } });
    const downloadExecutivePdf = vi.spyOn(apiClient, 'downloadExecutivePdf').mockResolvedValue(
      new Blob(['pdf-data'], { type: 'application/pdf' }),
    );
    const downloadExecutiveExcel = vi.spyOn(apiClient, 'downloadExecutiveExcel').mockResolvedValue(
      new Blob(['excel-data'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    );
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:executive-report'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(
      <ReportsView
        canExport
        canViewCashSessionReport
        canViewManagerial
        onStatus={() => undefined}
      />,
    );

    activateTab(/exportaciones/i);
    expect(await screen.findByText(/PDF ejecutivo y Excel contable/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /exportar pdf ejecutivo/i }));

    await waitFor(() => {
      expect(downloadExecutivePdf).toHaveBeenCalledWith(expect.objectContaining({
        date_from: expect.any(String),
        date_to: expect.any(String),
      }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /exportar excel ejecutivo/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /exportar excel ejecutivo/i }));

    await waitFor(() => {
      expect(downloadExecutiveExcel).toHaveBeenCalledWith(expect.objectContaining({
        date_from: expect.any(String),
        date_to: expect.any(String),
      }));
    });
    expect(openSpy).toHaveBeenCalledWith('blob:executive-report', '_blank', 'noopener,noreferrer');
  });

  it('blocks duplicate executive export submissions while a download is pending', async () => {
    vi.spyOn(apiClient, 'getExecutiveReport').mockResolvedValue(createExecutiveReportFixture());
    vi.spyOn(apiClient, 'getDailyReport').mockResolvedValue({
      date: '2026-06-16',
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
    });
    vi.spyOn(apiClient, 'getCategories').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getAreas').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getCashSessions').mockResolvedValue({ data: [], meta: { current_page: 1, per_page: 50, total: 0 } });
    let resolvePdf: (blob: Blob) => void = () => undefined;
    const pendingPdf = new Promise<Blob>((resolve) => {
      resolvePdf = resolve;
    });
    const downloadExecutivePdf = vi.spyOn(apiClient, 'downloadExecutivePdf').mockReturnValue(pendingPdf);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:executive-report'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(window, 'open').mockReturnValue({} as Window);

    render(
      <ReportsView
        canExport
        canViewCashSessionReport
        canViewManagerial
        onStatus={() => undefined}
      />,
    );

    activateTab(/exportaciones/i);
    expect(await screen.findByText(/PDF ejecutivo y Excel contable/i)).toBeInTheDocument();
    const exportButton = screen.getByRole('button', { name: /exportar pdf ejecutivo/i });
    fireEvent.click(exportButton);
    fireEvent.click(exportButton);

    expect(downloadExecutivePdf).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /exportando pdf/i })).toBeDisabled();
    });

    await act(async () => {
      resolvePdf(new Blob(['pdf-data'], { type: 'application/pdf' }));
      await pendingPdf;
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /exportar pdf ejecutivo/i })).toBeEnabled();
    });
  });

  it('does not fetch or export executive reports when the date range is invalid', async () => {
    const getExecutiveReport = vi.spyOn(apiClient, 'getExecutiveReport').mockResolvedValue(createExecutiveReportFixture());
    vi.spyOn(apiClient, 'getDailyReport').mockResolvedValue({
      date: '2026-06-16',
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
    });
    vi.spyOn(apiClient, 'getCategories').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getAreas').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getCashSessions').mockResolvedValue({ data: [], meta: { current_page: 1, per_page: 50, total: 0 } });
    const downloadExecutivePdf = vi.spyOn(apiClient, 'downloadExecutivePdf').mockResolvedValue(
      new Blob(['pdf-data'], { type: 'application/pdf' }),
    );

    render(
      <ReportsView
        canExport
        canViewCashSessionReport
        canViewManagerial
        onStatus={() => undefined}
      />,
    );

    expect(await screen.findByLabelText(/inicio ejecutivo/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(getExecutiveReport).toHaveBeenCalledTimes(1);
    });
    getExecutiveReport.mockClear();

    fireEvent.change(screen.getByLabelText(/inicio ejecutivo/i), { target: { value: '2026-06-20' } });
    fireEvent.change(screen.getByLabelText(/fin ejecutivo/i), { target: { value: '2026-06-01' } });

    expect(await screen.findAllByText(/la fecha de inicio debe ser anterior o igual/i)).toHaveLength(2);
    expect(screen.getByRole('button', { name: /refrescar ejecutivo/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^pdf ejecutivo$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^excel ejecutivo$/i })).toBeDisabled();

    activateTab(/exportaciones/i);
    const exportButton = screen.getByRole('button', { name: /exportar pdf ejecutivo/i });
    expect(exportButton).toBeDisabled();
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(getExecutiveReport).not.toHaveBeenCalled();
    });
    expect(downloadExecutivePdf).not.toHaveBeenCalled();
  });

  it('clears a stale executive report error after a successful refresh', async () => {
    const getExecutiveReport = vi.spyOn(apiClient, 'getExecutiveReport')
      .mockRejectedValueOnce(new ApiError('Fallo temporal del reporte ejecutivo', 403))
      .mockResolvedValue(createExecutiveReportFixture());
    vi.spyOn(apiClient, 'getDailyReport').mockResolvedValue({
      date: '2026-06-16',
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
    });
    vi.spyOn(apiClient, 'getCategories').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getAreas').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getCashSessions').mockResolvedValue({ data: [], meta: { current_page: 1, per_page: 50, total: 0 } });

    render(
      <ReportsView
        canExport
        canViewCashSessionReport
        canViewManagerial
        onStatus={() => undefined}
      />,
    );

    expect(await screen.findByText(/permiso|no tiene permiso/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /refrescar ejecutivo/i }));

    await waitFor(() => {
      expect(getExecutiveReport).toHaveBeenCalledTimes(2);
      expect(screen.queryByText(/permiso|no tiene permiso/i)).not.toBeInTheDocument();
    });
    expect(await screen.findByText(/resumen ejecutivo/i)).toBeInTheDocument();
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
          json: async () => ({
            data: {
              date_from: '2026-05-17',
              date_to: '2026-05-17',
              cash_session_id: null,
              user_id: null,
              filters: {},
              total_billed: '17.25',
              total_collected: '17.25',
              total_balance_due: '0.00',
              payments_by_method: { cash: '17.25', transfer: '0.00', card: '0.00', other: '0.00' },
              invoices_by_status: {
                issued: { count: 0, total: '0.00' },
                partial: { count: 0, total: '0.00' },
                paid: { count: 1, total: '17.25' },
                void: { count: 0, total: '0.00' },
              },
              payment_count: 1,
              invoice_count: 1,
            },
          }),
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

  it('keeps operational audit details readable without rendering internal ids or backup checksums', () => {
    const operations = {
      date_from: '2026-06-01',
      date_to: '2026-06-01',
      filters: {},
      summary: {
        void_count: 1,
        reprint_count: 1,
        payment_void_count: 0,
        backup_count: 1,
        failed_backup_count: 0,
        cashier_count: 1,
      },
      voids: [{
        invoice_number: '000-001-01-00000001',
        total: '17.25',
        reason: 'Error de captura',
        voided_at: '2026-06-01T08:00:00.000Z',
        user: 'Supervisor Caja',
      }],
      reprints: [{
        invoice_id: 928374,
        invoice_number: '000-001-01-00000002',
        width: '80mm',
        reason: 'Copia para paciente',
        created_at: '2026-06-01T08:10:00.000Z',
        user: 'Cajero Validacion',
      }],
      payment_voids: [],
      backups: [{
        filename: 'hospital-backup-2026-06-01.sql',
        status: 'success',
        type: 'manual',
        size_bytes: 2048,
        checksum_sha256: 'checksum-no-visible-1234567890',
        created_at: '2026-06-01T08:15:00.000Z',
        completed_at: '2026-06-01T08:16:00.000Z',
        creator: 'Admin Hospital',
      }],
      cashiers: [{
        name: 'Cajero Validacion',
        payment_count: 2,
        cash_session_count: 1,
        invoice_count: 2,
        total_collected: '34.50',
      }],
    } as unknown as OperationsReport;

    render(
      <AuditoriaTab
        canExport={false}
        operations={operations}
        dateFrom="2026-06-01"
        dateTo="2026-06-01"
        onDateFromChange={() => undefined}
        onDateToChange={() => undefined}
        onExport={() => undefined}
        onExportPdf={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(screen.getByText('000-001-01-00000001')).toBeInTheDocument();
    expect(screen.getByText('hospital-backup-2026-06-01.sql')).toBeInTheDocument();
    expect(screen.getAllByText('Cajero Validacion').length).toBeGreaterThan(0);
    expect(screen.queryByText('Maria Lopez')).not.toBeInTheDocument();
    expect(screen.queryByText('cajero.validacion')).not.toBeInTheDocument();
    expect(screen.queryByText('918273')).not.toBeInTheDocument();
    expect(screen.queryByText('938475')).not.toBeInTheDocument();
    expect(screen.queryByText('948576')).not.toBeInTheDocument();
    expect(screen.queryByText('checksum-no-visible-1234567890')).not.toBeInTheDocument();
  });

  it('allows cash-session-only report users to open the cash report tab without managerial reports', async () => {
    window.history.pushState({}, '', '/reports');
    const requestedUrls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      requestedUrls.push(url);
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
      if (url.includes('/api/reports/executive')) {
        return { ok: false, status: 403, json: async () => ({ message: 'Forbidden' }) } as Response;
      }
      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    render(<App />);

    expect((await screen.findAllByRole('heading', { name: /^reportes$/i })).length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: /^caja$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/n.mero de caja/i)).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /diario/i })).not.toBeInTheDocument();
    expect(requestedUrls.some((url) => url.includes('/api/reports/executive'))).toBe(false);
    expect(screen.queryByText(/reporte ejecutivo/i)).not.toBeInTheDocument();
  });

  it('exports the loaded cash session using its own opened and closed dates', async () => {
    vi.spyOn(apiClient, 'getDailyReport').mockResolvedValue({
      date: '2026-06-02',
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
    });
    vi.spyOn(apiClient, 'getCategories').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getAreas').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getCashSessionReport').mockResolvedValue({
      cash_session: {
        id: 42,
        user_id: 7,
        status: 'closed',
        opening_amount: '500.00',
        closing_amount: '517.25',
        expected_amount: '517.25',
        difference_amount: '0.00',
        opening_notes: null,
        closing_notes: null,
        opened_at: '2026-05-03T08:00:00.000000Z',
        closed_at: '2026-05-03T16:00:00.000000Z',
        user: { id: 7, name: 'Caja Principal', username: 'caja' },
      },
      totals_by_method: { cash: '17.25', transfer: '0.00', card: '0.00', other: '0.00' },
      total_cash: '17.25',
      total_transfer: '0.00',
      total_card: '0.00',
      total_other: '0.00',
      payments_count: 1,
      payments_total: '17.25',
      expected_cash_amount: '517.25',
      pending_invoice_count: 0,
      pending_amount: '0.00',
      payments: [],
      movements: [],
    });
    const downloadReportExport = vi
      .spyOn(apiClient, 'downloadReportExport')
      .mockResolvedValue(new Blob(['excel-data']));
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:cash-report'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(
      <ReportsView
        canExport
        canViewCashSessionReport
        canViewManagerial
        onStatus={() => undefined}
      />,
    );

    activateTab(/^caja$/i);
    fireEvent.change(await screen.findByLabelText(/n.mero de caja/i), { target: { value: '42' } });
    fireEvent.click(screen.getByRole('button', { name: /ver caja/i }));

    expect(await screen.findByText('Caja Principal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /exportar excel/i }));

    await waitFor(() => {
      expect(downloadReportExport).toHaveBeenCalledWith(expect.objectContaining({
        cash_session_id: '42',
        date_from: '2026-05-03',
        date_to: '2026-05-03',
      }));
    });
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

      if (url.includes('/api/cash-sessions')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 11,
                user_id: 2,
                status: 'open',
                opening_amount: '500.00',
                closing_amount: null,
                expected_amount: '517.25',
                difference_amount: null,
                opening_notes: null,
                closing_notes: null,
                opened_at: '2026-05-17T08:00:00.000000Z',
                closed_at: null,
                user: { id: 2, name: 'Cajero Validacion', username: 'cajero.validacion' },
              },
            ],
            meta: { current_page: 1, per_page: 50, total: 1 },
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
              invoices_by_status: {
                issued: { count: 0, total: '0.00' },
                partial: { count: 0, total: '0.00' },
                paid: { count: 0, total: '0.00' },
                void: { count: 0, total: '0.00' },
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
                audit_event_count: 1,
              },
              voids: [],
              reprints: [],
              audit_events: [
                {
                  id: 1,
                  action: 'payment.voided',
                  result: 'success',
                  entity_type: 'App\\Models\\Payment',
                  entity_id: 7,
                  reason: 'Reversion validada por supervisor',
                  created_at: '2026-05-17T10:30:00.000000Z',
                  user: 'Supervisor Validacion',
                  ip_address: '127.0.0.1',
                  user_agent: 'Caja-LAN/1.0',
                  details: {},
                },
              ],
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
    expect(await screen.findByRole('heading', { name: /^resumen del día$/i })).toBeInTheDocument();
    activateTab(/rango/i);
    expect(await screen.findByLabelText(/desde/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hasta/i)).toBeInTheDocument();
    const cashSessionSelector = await screen.findByRole('combobox', { name: /^caja$/i });
    expect(screen.getByText(/Cajero Validacion.*2026-05-17.*Abierta/i)).toBeInTheDocument();
    fireEvent.change(cashSessionSelector, { target: { value: '11' } });
    const cashierSelector = screen.getByRole('combobox', { name: /^cajero$/i });
    expect(screen.getByText(/Cajero Validacion \(cajero\.validacion\)/i)).toBeInTheDocument();
    fireEvent.change(cashierSelector, { target: { value: '2' } });
    expect(screen.getByLabelText(/^area$/i)).toBeInTheDocument();
    expect(screen.getByText(/puede consultar hasta 31 días por búsqueda/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ver rango/i }));

    expect(await screen.findByText(/^cobrado$/i)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /por area/i })).toBeInTheDocument();
    expect(screen.getByText('Radiologia')).toBeInTheDocument();
    expect(screen.getByText('L 51.75')).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/reports/areas?'))).toBe(true);
    });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('cash_session_id=11'))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('user_id=2'))).toBe(true);
    activateTab(/servicios/i);
    expect(await screen.findByText(/sin categor.as facturadas/i)).toBeInTheDocument();
    expect(await screen.findByText(/sin servicios facturados/i)).toBeInTheDocument();
    expect(screen.queryByText(/sin categorias cobradas/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sin servicios cobrados/i)).not.toBeInTheDocument();
    activateTab(/auditor.a/i);
    expect(await screen.findByText(/eventos de control/i)).toBeInTheDocument();
    expect(await screen.findByText(/reversion de pago/i)).toBeInTheDocument();
    expect(await screen.findByText(/Reversion validada por supervisor/i)).toBeInTheDocument();
  });
});

function createExecutiveReportFixture(): ExecutiveReport {
  return {
    period: {
      from: '2026-06-01',
      to: '2026-06-16',
      timezone: 'America/Tegucigalpa',
      days: 16,
    },
    filters: {
      cash_session_id: null,
      user_id: null,
      category_id: null,
      area_id: null,
      method: null,
      status: null,
    },
    comparison: {
      billed: { current: '17.25', previous: '0.00', delta_cents: 1725, delta_percentage: null },
      collected: { current: '17.25', previous: '0.00', delta_cents: 1725, delta_percentage: null },
      previous_period: { from: '2026-05-16', to: '2026-05-31' },
    },
    summary: {
      billed_total: '17.25',
      collected_total: '17.25',
      collected_total_cents: 1725,
      pending_total: '0.00',
      voided_total: '0.00',
      reversed_total: '0.00',
      invoice_count: 1,
      receipt_count: 1,
      paid_count: 1,
      partial_count: 0,
      pending_count: 0,
      voided_count: 0,
      average_ticket: '17.25',
    },
    payment_methods: [
      { method: 'cash', label: 'Efectivo', amount: '17.25', count: 1, percentage: 100 },
      { method: 'transfer', label: 'Transferencia', amount: '0.00', count: 0, percentage: 0 },
      { method: 'card', label: 'Tarjeta', amount: '0.00', count: 0, percentage: 0 },
      { method: 'other', label: 'Otro', amount: '0.00', count: 0, percentage: 0 },
    ],
    daily_trend: [
      {
        date: '2026-06-16',
        billed: '17.25',
        collected: '17.25',
        pending: '0.00',
        voided_count: 0,
        invoice_count: 1,
      },
    ],
    services: {
      top_by_amount: [],
      top_by_quantity: [],
      by_category: [],
      by_area: [],
    },
    cashiers: [],
    cash_sessions: [],
    pending_aging: {
      '0_7_days': { count: 0, amount: '0.00' },
      '8_30_days': { count: 0, amount: '0.00' },
      '31_plus_days': { count: 0, amount: '0.00' },
      items: [],
    },
    voids_and_reversals: [],
    audit_summary: {
      critical_events: 0,
      reprints: 0,
      fiscal_changes: 0,
      cash_differences: 0,
      backup_events: 0,
    },
  };
}
