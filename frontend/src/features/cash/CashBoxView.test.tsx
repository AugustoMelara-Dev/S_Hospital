/// <reference types="node" />
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '../../App';
import { ApiError, apiClient, type CashSession } from '../../lib/api';
import { queryClient } from '../../lib/query-client';
import { resetRequestChain } from '../../lib/api/base';
import { CashBoxView } from './CashBoxView';

describe('CashBoxView', () => {
  it('opens on Resumen and focuses the counted amount only when Cierre is activated', async () => {
    vi.spyOn(apiClient, 'getCurrentCashSession').mockResolvedValue(cashSessionFixture());

    renderCashBox(<CashBoxView canViewCashSessionReport onStatus={vi.fn()} />);

    const summaryTab = await screen.findByRole('radio', { name: /^resumen$/i });
    expect(summaryTab).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /^movimientos$/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^arqueo$/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^cierre$/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/monto contado/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /control contable de caja/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /cierre guiado/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Conciliaci.n de caja/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /^cierre$/i }));

    const countedAmount = await screen.findByLabelText(/monto contado/i);
    await waitFor(() => expect(countedAmount).toHaveFocus());

    fireEvent.click(screen.getByRole('radio', { name: /^resumen$/i }));
    expect(screen.queryByLabelText(/monto contado/i)).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^resumen$/i })).toHaveAttribute('aria-checked', 'true');
  });

  it('reports the manual refresh as a typed user action', async () => {
    vi.spyOn(apiClient, 'getCurrentCashSession').mockResolvedValue(cashSessionFixture());
    const onStatus = vi.fn();

    renderCashBox(<CashBoxView onStatus={onStatus} />);
    await screen.findByRole('radio', { name: /^resumen$/i });
    onStatus.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));

    expect(onStatus).toHaveBeenCalledWith({
      key: 'cash:refresh',
      level: 'info',
      message: 'Actualizando caja...',
    });
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.stubGlobal('scrollTo', vi.fn());
    resetRequestChain();
    await queryClient.cancelQueries();
    queryClient.clear();
    window.history.pushState({}, '', '/');
    vi.spyOn(apiClient, 'getLogo').mockResolvedValue(null);
    document.body.removeAttribute('data-printing-receipt');
    document.body.removeAttribute('data-receipt-width');
  });

  afterEach(async () => {
    cleanup();
    vi.unstubAllGlobals();
    await queryClient.cancelQueries();
    queryClient.clear();
  });

  it('shows cash status and allows opening a cash session', async () => {
    window.history.pushState({}, '', '/cashbox');
    const openedSession = {
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
    let currentSession: typeof openedSession | null = null;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, options) => {
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
              permissions: ['cash.view', 'cash.open', 'cash.close', 'invoices.create'],
              must_change_password: false,
            },
          }),
        } as Response;
      }

      if (url.includes('/api/cash-sessions/open') && options?.method === 'POST') {
        currentSession = openedSession;
        return {
          ok: true,
          json: async () => ({ data: openedSession }),
        } as Response;
      }

      if (url.includes('/api/cash-sessions/current')) {
        return {
          ok: true,
          json: async () => ({ data: currentSession }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ data: [] }),
      } as Response;
    });

    render(<App />);

    expect((await screen.findAllByRole('link', { name: /caja/i }))[0]).toHaveAttribute('href', '/cashbox');
    expect(screen.queryByRole('link', { name: /backups/i })).not.toBeInTheDocument();
    expect((await screen.findAllByRole('heading', { name: /^caja$/i })).length).toBeGreaterThan(0);
    expect(await screen.findByText(/no hay una caja abierta actualmente/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/monto inicial/i)).toHaveValue('0.00');
    fireEvent.click(screen.getByRole('button', { name: /abrir caja/i }));
    const openingDialog = await screen.findByRole('dialog', { name: /confirmar apertura de caja/i });
    fireEvent.click(within(openingDialog).getByRole('button', { name: /^abrir caja$/i }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url, options]) => {
          const requestOptions = options as RequestInit | undefined;
          return String(url).includes('/api/cash-sessions/open') && requestOptions?.method === 'POST';
        }),
      ).toBe(true);
    });
    expect((await screen.findAllByText(/caja abierta/i)).length).toBeGreaterThan(0);
    expect(await screen.findByText(/caja abierta en modo consulta/i)).toBeInTheDocument();
    expect(screen.queryByText(/caja lista para facturar/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /nueva factura/i })).not.toBeInTheDocument();
  });

  it('keeps close-session difference hidden until counted amount is entered', async () => {
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
              permissions: ['cash.view', 'cash.close'],
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
              id: 9,
              user_id: 2,
              opening_amount: '100.00',
              closing_amount: null,
              expected_amount: null,
              expected_cash_amount: '100.00',
              difference_amount: null,
              payments_count: 0,
              payments_by_method: {
                cash: '0.00',
                transfer: '0.00',
                card: '0.00',
                other: '0.00',
              },
              status: 'open',
              opening_notes: null,
              closing_notes: null,
              opened_at: '2026-05-17T08:00:00-06:00',
              closed_at: null,
            },
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ data: [] }),
      } as Response;
    });

    render(<App />);
    await activateCashView('Cierre');

    expect(await screen.findByLabelText(/monto contado/i)).toBeInTheDocument();
    expect(screen.queryByText(/hay una diferencia/i)).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(/monto contado/i)).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /^cerrar caja$/i }));

    expect(await screen.findByText(/falta ingresar el monto contado/i)).toBeInTheDocument();
    expect(document.activeElement).toHaveAttribute('id', 'closing_amount');
  });

  it('shows pending balance and prevents client-side close while invoices are partial', async () => {
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
              permissions: ['cash.view', 'cash.close', 'reports.cash_session.view'],
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
              id: 10,
              user_id: 2,
              opening_amount: '500.00',
              closing_amount: null,
              expected_amount: null,
              expected_cash_amount: '517.25',
              difference_amount: null,
              payments_count: 3,
              payments_total: '33.75',
              payments_by_method: {
                cash: '17.25',
                transfer: '11.50',
                card: '5.00',
                other: '0.00',
              },
              pending_invoice_count: 1,
              pending_amount: '23.75',
              status: 'open',
              opening_notes: null,
              closing_notes: null,
              opened_at: '2026-05-17T08:00:00-06:00',
              closed_at: null,
            },
          }),
        } as Response;
      }

      if (url.includes('/api/reports/cash-sessions/10')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              movements: [
                {
                  id: 1,
                  cash_session_id: 11,
                  payment_id: null,
                  user_id: 2,
                  type: 'income',
                  method: 'cash',
                  amount: 'monto-danado',
                  notes: null,
                  occurred_at: '2026-05-17T09:30:00-06:00',
                },
              ],
            },
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ data: [] }),
      } as Response;
    });

    render(<App />);

    expect(await screen.findByText(/^Ingresos$/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/^Ingresos$/i).closest('dl')).toHaveTextContent(/33\.75/));
    expect(screen.getByText(/^Recibos pendientes$/i).closest('dl')).toHaveTextContent('0');
    expect((await screen.findAllByText(/saldo pendiente/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/L 23\.75/i).length).toBeGreaterThan(0);
    await activateCashView('Cierre');
    expect(await screen.findByText(/revise los cobros antes de cerrar/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cerrar caja$/i })).toBeDisabled();
  });

  it('renders malformed cash reconciliation amounts as zero instead of NaN', async () => {
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
              permissions: ['cash.view', 'cash.close'],
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
              id: 11,
              user_id: 2,
              opening_amount: 'monto-danado',
              closing_amount: null,
              expected_amount: null,
              expected_cash_amount: 'no-numero',
              difference_amount: null,
              payments_count: 3,
              payments_total: 'monto-danado',
              payments_by_method: {
                cash: 'monto-danado',
                transfer: '',
                card: 'NaN',
                other: 'no-numero',
              },
              pending_invoice_count: 0,
              pending_amount: 'monto-danado',
              status: 'open',
              opening_notes: null,
              closing_notes: null,
              opened_at: '2026-05-17T08:00:00-06:00',
              closed_at: null,
            },
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ data: [] }),
      } as Response;
    });

    render(<App />);

    expect((await screen.findAllByText(/efectivo esperado/i)).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getAllByText('L 0.00').length).toBeGreaterThanOrEqual(5));
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|no-numero/);
  });

  it('renders one accessible cashbox heading and textual status without extra requests', async () => {
    const getCurrentCashSession = vi.spyOn(apiClient, 'getCurrentCashSession').mockResolvedValue(null);

    renderCashBox(<CashBoxView onStatus={vi.fn()} />);

    expect(await screen.findByRole('heading', { level: 1, name: /^caja$/i })).toBeInTheDocument();
    expect(await screen.findByLabelText(/monto inicial/i)).toHaveValue('0.00');
    expect(screen.getAllByText(/caja cerrada/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/no hay una caja abierta actualmente/i)).toBeInTheDocument();
    expect(getCurrentCashSession).toHaveBeenCalledTimes(1);
  });

  it('requests a closable session when the operator can close any cashbox', async () => {
    const getCurrentCashSession = vi.spyOn(apiClient, 'getCurrentCashSession').mockResolvedValue(cashSessionFixture({
      user_id: 77,
    }));

    renderCashBox(<CashBoxView canCloseAnyCash currentUserId={2} onStatus={vi.fn()} />);

    expect(await screen.findByRole('heading', { level: 1, name: /^caja$/i })).toBeInTheDocument();
    expect(getCurrentCashSession).toHaveBeenCalledWith({ scope: 'closable' });
    expect(await screen.findByText(/cajero #77/i)).toBeVisible();
    expect(screen.queryByRole('link', { name: /nueva factura/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/caja lista para facturar/i)).not.toBeInTheDocument();
    expect(screen.getByText(/supervisión habilitada/i)).toBeVisible();
  });

  it('offers billing only for the own session with invoices.create', async () => {
    vi.spyOn(apiClient, 'getCurrentCashSession').mockResolvedValue(cashSessionFixture({ user_id: 2 }));

    renderCashBox(
      <CashBoxView canCreateInvoices currentUserId={2} onStatus={vi.fn()} />,
    );

    expect(await screen.findByRole('link', { name: /nueva factura/i })).toHaveAttribute('href', '/billing/new');
    expect(screen.queryByText(/caja lista para facturar/i)).not.toBeInTheDocument();
    const operationalHeader = screen.getByRole('region', { name: /estado operativo de caja/i });
    expect(within(operationalHeader).getByText(/^apertura$/i)).toBeVisible();
    expect(within(operationalHeader).getByText(/^efectivo esperado$/i)).toBeVisible();
    expect(within(operationalHeader).getByText(/^saldo pendiente$/i)).toBeVisible();
  });

  it('shows a sanitized load error with retry and does not present a closed cashbox as loaded data', async () => {
    const getCurrentCashSession = vi.spyOn(apiClient, 'getCurrentCashSession')
      .mockRejectedValueOnce(new Error('SQLSTATE[40001]: Deadlock found in cash_register_sessions'))
      .mockResolvedValueOnce(null);

    renderCashBox(<CashBoxView onStatus={vi.fn()} />);

    expect((await screen.findAllByText(/no se pudo cargar caja/i)).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/SQLSTATE|Deadlock|cash_register_sessions/i);
    expect(screen.queryByLabelText(/monto inicial/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));

    await waitFor(() => expect(getCurrentCashSession).toHaveBeenCalledTimes(2));
  });

  it('requires confirmation before opening cash and prevents duplicate opening while pending', async () => {
    let resolveOpen!: (session: CashSession) => void;
    const opened = cashSessionFixture({ id: 51, opening_amount: '0.00' });
    const openCashSession = vi.spyOn(apiClient, 'openCashSession')
      .mockReturnValue(new Promise((resolve) => { resolveOpen = resolve; }));

    vi.spyOn(apiClient, 'getCurrentCashSession').mockResolvedValue(null);

    renderCashBox(<CashBoxView onStatus={vi.fn()} />);

    const amount = await screen.findByLabelText(/monto inicial/i);
    expect(amount).toHaveValue('0.00');

    const openButton = screen.getByRole('button', { name: /abrir caja/i });
    fireEvent.click(openButton);
    fireEvent.click(openButton);

    expect(openCashSession).not.toHaveBeenCalled();

    const dialog = await screen.findByRole('dialog', { name: /confirmar apertura de caja/i });
    expect(dialog).toHaveTextContent(/monto inicial/i);
    expect(dialog).toHaveTextContent(/L 0\.00/i);

    fireEvent.click(within(dialog).getByRole('button', { name: /^abrir caja$/i }));

    await waitFor(() => expect(openCashSession).toHaveBeenCalledTimes(1));
    expect(openCashSession).toHaveBeenCalledWith(
      { opening_amount: '0.00' },
      { idempotencyKey: expect.any(String) },
    );

    await act(async () => {
      resolveOpen(opened);
    });
  });

  it('shows a clear local drawer conflict when another cash session is already open', async () => {
    const onStatus = vi.fn();
    const openCashSession = vi.spyOn(apiClient, 'openCashSession').mockRejectedValue(new ApiError(
      'Revise los datos del formulario.',
      422,
      {
        cash_session: ['Ya existe una caja abierta en esta terminal. Cierre la caja actual antes de abrir otra.'],
      },
    ));
    vi.spyOn(apiClient, 'getCurrentCashSession').mockResolvedValue(null);

    renderCashBox(<CashBoxView onStatus={onStatus} />);

    expect(await screen.findByLabelText(/monto inicial/i)).toHaveValue('0.00');
    fireEvent.click(screen.getByRole('button', { name: /abrir caja/i }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: /confirmar apertura de caja/i }))
      .getByRole('button', { name: /^abrir caja$/i }));

    await waitFor(() => expect(openCashSession).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Caja: Ya existe una caja abierta/i)).toBeInTheDocument();
    expect(screen.queryByText(/caja lista para facturar/i)).not.toBeInTheDocument();
    expect(onStatus).toHaveBeenLastCalledWith(expect.objectContaining({
      level: 'error',
      message: expect.stringMatching(/Caja: Ya existe una caja abierta/i),
      toast: false,
    }));
  });

  it('locks the open cash form while the opening confirmation is active', async () => {
    vi.spyOn(apiClient, 'openCashSession').mockResolvedValue(cashSessionFixture({ id: 53, opening_amount: '75.00' }));
    vi.spyOn(apiClient, 'getCurrentCashSession').mockResolvedValue(null);

    renderCashBox(<CashBoxView onStatus={vi.fn()} />);

    const amount = await screen.findByLabelText(/monto inicial/i);
    fireEvent.change(amount, { target: { value: '75.00' } });
    fireEvent.click(screen.getByRole('button', { name: /abrir caja/i }));

    expect(await screen.findByRole('dialog', { name: /confirmar apertura de caja/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/monto inicial/i)).toBeDisabled();
    expect(within(amount.closest('form')!).getByText(/abriendo/i).closest('button')).toBeDisabled();
  });

  it('accepts a pasted opening amount with spaces and sends the trimmed value', async () => {
    const opened = cashSessionFixture({ id: 52, opening_amount: '100.00' });
    const openCashSession = vi.spyOn(apiClient, 'openCashSession').mockResolvedValue(opened);
    vi.spyOn(apiClient, 'getCurrentCashSession').mockResolvedValue(null);

    renderCashBox(<CashBoxView onStatus={vi.fn()} />);

    const amount = await screen.findByLabelText(/monto inicial/i);
    fireEvent.change(amount, { target: { value: ' 100.00 ' } });
    fireEvent.click(screen.getByRole('button', { name: /abrir caja/i }));

    const dialog = await screen.findByRole('dialog', { name: /confirmar apertura de caja/i });
    expect(dialog).toHaveTextContent(/L 100\.00/i);
    fireEvent.click(within(dialog).getByRole('button', { name: /^abrir caja$/i }));

    await waitFor(() => expect(openCashSession).toHaveBeenCalledWith(
      { opening_amount: '100.00' },
      { idempotencyKey: expect.any(String) },
    ));
  });

  it('preserves close cash payload, permission gating and focus before confirmation', async () => {
    const closeCashSession = vi.spyOn(apiClient, 'closeCashSession').mockResolvedValue(cashSessionFixture({ status: 'closed' }));
    vi.spyOn(apiClient, 'getCurrentCashSession').mockResolvedValue(cashSessionFixture());

    renderCashBox(<CashBoxView canCloseCash={false} onStatus={vi.fn()} />);
    await activateCashView('Cierre');

    const closeButton = await screen.findByRole('button', { name: /^cerrar caja$/i });
    expect(closeButton).toBeDisabled();
    expect(screen.getByText(/solo usuarios con permiso de cierre/i)).toBeInTheDocument();
    expect(closeCashSession).not.toHaveBeenCalled();

    cleanup();
    vi.spyOn(apiClient, 'getCurrentCashSession').mockResolvedValue(cashSessionFixture());
    renderCashBox(<CashBoxView onStatus={vi.fn()} />);
    await activateCashView('Cierre');

    const counted = await screen.findByLabelText(/monto contado/i);
    expect(document.activeElement).toHaveAttribute('id', 'closing_amount');
    fireEvent.change(counted, { target: { value: '100.00' } });
    fireEvent.click(screen.getByRole('button', { name: /^cerrar caja$/i }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    const confirmButtons = screen.getAllByRole('button', { name: /^cerrar caja$/i });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(closeCashSession).toHaveBeenCalledWith(
      1,
      {
        closing_amount: '100.00',
        notes: null,
      },
      { idempotencyKey: expect.any(String) },
    ));
  });

  it('shows an accessible live difference while counting cash before opening the close dialog', async () => {
    vi.spyOn(apiClient, 'getCurrentCashSession').mockResolvedValue(cashSessionFixture({
      expected_cash_amount: '125.00',
    }));

    renderCashBox(<CashBoxView onStatus={vi.fn()} />);
    await activateCashView('Cierre');

    fireEvent.change(await screen.findByLabelText(/monto contado/i), {
      target: { value: '120.00' },
    });

    expect(screen.getByRole('status', { name: /diferencia en vivo/i }))
      .toHaveTextContent(/- L 5\.00/i);
    expect(screen.queryByRole('dialog', { name: /cierre de caja/i })).not.toBeInTheDocument();
  });

  it('keeps a confirmed close summary printable after the cash session closes', async () => {
    const print = vi.fn(() => {
      expect(document.body.dataset.printingCashClose).toBe('true');
    });
    vi.stubGlobal('print', print);
    const createObjectURL = vi.fn((blob: Blob) => {
      void blob;
      return 'blob:cash-close-confirmed-summary';
    });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const closedSession = cashSessionFixture({
      id: 12,
      status: 'closed',
      closing_amount: '101.00',
      difference_amount: '1.00',
      closing_notes: 'Sobrante confirmado',
      closed_at: '2026-07-06T17:30:00-06:00',
      payments_by_method: {
        cash: '1.00',
        transfer: '0.00',
        card: '0.00',
        other: '0.00',
      },
    });
    const closeCashSession = vi.spyOn(apiClient, 'closeCashSession').mockResolvedValue(closedSession);
    vi.spyOn(apiClient, 'getCurrentCashSession')
      .mockResolvedValueOnce(cashSessionFixture({
        expected_cash_amount: '100.00',
        payments_by_method: closedSession.payments_by_method,
      }))
      .mockResolvedValueOnce(cashSessionFixture({
        expected_cash_amount: '100.00',
        payments_by_method: closedSession.payments_by_method,
      }))
      .mockResolvedValue(null);

    renderCashBox(<CashBoxView onStatus={vi.fn()} />);
    await activateCashView('Cierre');

    fireEvent.change(await screen.findByLabelText(/monto contado/i), { target: { value: '101.00' } });
    fireEvent.change(screen.getByLabelText(/nota de cierre/i), { target: { value: 'Sobrante confirmado' } });
    fireEvent.click(screen.getByRole('button', { name: /^cerrar caja$/i }));
    const closeDialog = await screen.findByRole('dialog');
    fireEvent.click(within(closeDialog).getByRole('button', { name: /^cerrar caja$/i }));

    const confirmedSummary = await screen.findByRole('region', { name: /resumen de cierre confirmado/i });
    expect(confirmedSummary).toHaveTextContent(/caja:\s*caja #12/i);
    expect(confirmedSummary).toHaveTextContent(/cerrada:\s*06\/07\/2026/i);
    expect(confirmedSummary).toHaveTextContent(/monto contado:\s*L 101\.00/i);
    expect(confirmedSummary).toHaveTextContent(/diferencia:\s*L 1\.00/i);
    expect(closeCashSession).toHaveBeenCalledTimes(1);

    fireEvent.click(within(confirmedSummary).getByRole('button', { name: /imprimir resumen/i }));
    fireEvent.click(within(confirmedSummary).getByRole('button', { name: /exportar resumen/i }));

    expect(print).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:cash-close-confirmed-summary');
    expect(closeCashSession).toHaveBeenCalledTimes(1);
  });

  it('trims close difference notes before sending the audited payload', async () => {
    const closeCashSession = vi.spyOn(apiClient, 'closeCashSession').mockResolvedValue(cashSessionFixture({ status: 'closed' }));
    vi.spyOn(apiClient, 'getCurrentCashSession').mockResolvedValue(cashSessionFixture());

    renderCashBox(<CashBoxView onStatus={vi.fn()} />);
    await activateCashView('Cierre');

    fireEvent.change(await screen.findByLabelText(/monto contado/i), { target: { value: '99.00' } });
    fireEvent.change(screen.getByLabelText(/nota de cierre/i), { target: { value: '  Faltante validado  ' } });
    fireEvent.click(screen.getByRole('button', { name: /^cerrar caja$/i }));
    const closeDialog = await screen.findByRole('dialog');
    fireEvent.click(within(closeDialog).getByRole('button', { name: /^cerrar caja$/i }));

    await waitFor(() => expect(closeCashSession).toHaveBeenCalledWith(
      1,
      {
        closing_amount: '99.00',
        notes: 'Faltante validado',
      },
      { idempotencyKey: expect.any(String) },
    ));
  });

  it('trims the counted amount before sending the close payload', async () => {
    const closeCashSession = vi.spyOn(apiClient, 'closeCashSession').mockResolvedValue(cashSessionFixture({ status: 'closed' }));
    vi.spyOn(apiClient, 'getCurrentCashSession').mockResolvedValue(cashSessionFixture());

    renderCashBox(<CashBoxView onStatus={vi.fn()} />);
    await activateCashView('Cierre');

    fireEvent.change(await screen.findByLabelText(/monto contado/i), { target: { value: ' 100.00 ' } });
    fireEvent.click(screen.getByRole('button', { name: /^cerrar caja$/i }));
    const closeDialog = await screen.findByRole('dialog');
    fireEvent.click(within(closeDialog).getByRole('button', { name: /^cerrar caja$/i }));

    await waitFor(() => expect(closeCashSession).toHaveBeenCalledWith(
      1,
      {
        closing_amount: '100.00',
        notes: null,
      },
      { idempotencyKey: expect.any(String) },
    ));
  });

  it('refreshes cash reconciliation before opening the close confirmation', async () => {
    const getCurrentCashSession = vi.spyOn(apiClient, 'getCurrentCashSession')
      .mockResolvedValueOnce(cashSessionFixture())
      .mockResolvedValueOnce(cashSessionFixture({
        expected_cash_amount: '125.00',
        pending_invoice_count: 1,
        pending_amount: '25.00',
      }));
    const closeCashSession = vi.spyOn(apiClient, 'closeCashSession').mockResolvedValue(cashSessionFixture({ status: 'closed' }));

    renderCashBox(<CashBoxView onStatus={vi.fn()} />);
    await activateCashView('Cierre');

    fireEvent.change(await screen.findByLabelText(/monto contado/i), { target: { value: '100.00' } });
    fireEvent.click(screen.getByRole('button', { name: /^cerrar caja$/i }));

    await waitFor(() => expect(getCurrentCashSession).toHaveBeenCalledTimes(2), { timeout: 250 });
    expect(screen.queryByRole('dialog', { name: /cierre de caja/i })).not.toBeInTheDocument();
    expect(await screen.findByText(/no se puede cerrar caja con 1 factura\(s\) pendientes/i)).toBeInTheDocument();
    expect(closeCashSession).not.toHaveBeenCalled();
  });

  it('blocks close after refresh when paid invoices are missing institutional receipts', async () => {
    const getCurrentCashSession = vi.spyOn(apiClient, 'getCurrentCashSession')
      .mockResolvedValueOnce(cashSessionFixture())
      .mockResolvedValueOnce(cashSessionFixture({
        expected_cash_amount: '125.00',
        missing_institutional_receipt_count: 1,
      } as Partial<CashSession>));
    const closeCashSession = vi.spyOn(apiClient, 'closeCashSession').mockResolvedValue(cashSessionFixture({ status: 'closed' }));

    renderCashBox(<CashBoxView onStatus={vi.fn()} />);
    await activateCashView('Cierre');

    fireEvent.change(await screen.findByLabelText(/monto contado/i), { target: { value: '100.00' } });
    fireEvent.click(screen.getByRole('button', { name: /^cerrar caja$/i }));

    await waitFor(() => expect(getCurrentCashSession).toHaveBeenCalledTimes(2), { timeout: 250 });
    expect(screen.queryByRole('dialog', { name: /cierre de caja/i })).not.toBeInTheDocument();
    expect((await screen.findAllByText(/recibo institucional pendiente/i)).length).toBeGreaterThan(0);
    expect(closeCashSession).not.toHaveBeenCalled();
  });

  it('shows known receipt blockers before the cashier attempts to close', async () => {
    vi.spyOn(apiClient, 'getCurrentCashSession').mockResolvedValue(cashSessionFixture({
      missing_institutional_receipt_count: 2,
      reversed_payments_count: 1,
      reversed_payments_total: '10.00',
    }));

    renderCashBox(<CashBoxView canViewInvoices onStatus={vi.fn()} />);
    await activateCashView('Arqueo');

    expect(await screen.findByRole('heading', { name: /control contable de caja/i })).toBeInTheDocument();
    expect(screen.getByText(/2 recibos institucionales pendientes/i)).toBeInTheDocument();
    expect(screen.getByText(/1 pago reversado/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /resolver en historial/i })).toHaveAttribute('href', '/invoices');
    await activateCashView('Cierre');
    expect(screen.getByRole('button', { name: /^cerrar caja$/i })).toBeDisabled();
  });

  it('carries a denomination count from Arqueo into the audited close amount', async () => {
    const closingBreakdown = {
      bills: {
        '500': 0,
        '200': 0,
        '100': 0,
        '50': 2,
        '20': 1,
        '10': 0,
        '5': 0,
        '2': 0,
        '1': 0,
      },
      other_amount: '5.50',
    };
    const closedSession = cashSessionFixture({
      status: 'closed',
      closing_amount: '125.50',
      closing_breakdown: closingBreakdown,
    });
    const closeCashSession = vi.spyOn(apiClient, 'closeCashSession').mockResolvedValue(closedSession);
    const openSession = cashSessionFixture({
      expected_cash_amount: '125.50',
    });
    vi.spyOn(apiClient, 'getCurrentCashSession')
      .mockResolvedValueOnce(openSession)
      .mockResolvedValueOnce(openSession)
      .mockResolvedValue(null);

    renderCashBox(<CashBoxView onStatus={vi.fn()} />);
    await activateCashView('Arqueo');

    fireEvent.change(await screen.findByLabelText(/cantidad de billetes de L 50$/i), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText(/cantidad de billetes de L 20$/i), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText(/monedas y otros/i), {
      target: { value: '5.50' },
    });

    expect(screen.getByRole('status', { name: /total contado por denominaciones/i }))
      .toHaveTextContent(/L 125\.50/i);

    fireEvent.click(screen.getByRole('button', { name: /continuar al cierre/i }));

    expect(screen.getByRole('radio', { name: /^cierre$/i })).toHaveAttribute('aria-checked', 'true');
    expect(await screen.findByLabelText(/monto contado/i)).toHaveValue('125.50');
    expect(screen.getByLabelText(/monto contado/i)).toHaveAttribute('readonly');
    expect(screen.getByText(/calculado desde el arqueo por denominaciones/i)).toBeInTheDocument();


    await activateCashView('Arqueo');
    expect(screen.getByLabelText(/cantidad de billetes de L 50$/i)).toHaveValue('2');
    expect(screen.getByLabelText(/cantidad de billetes de L 20$/i)).toHaveValue('1');
    expect(screen.getByLabelText(/monedas y otros/i)).toHaveValue('5.50');

    fireEvent.click(screen.getByRole('button', { name: /continuar al cierre/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^cerrar caja$/i }));
    const closeDialog = await screen.findByRole('dialog', { name: /cierre de caja/i });
    fireEvent.click(within(closeDialog).getByRole('button', { name: /^cerrar caja$/i }));

    await waitFor(() => expect(closeCashSession).toHaveBeenCalledWith(
      1,
      {
        closing_amount: '125.50',
        notes: null,
        closing_breakdown: closingBreakdown,
      },
      { idempotencyKey: expect.any(String) },
    ));
    const confirmedSummary = await screen.findByRole('region', { name: /resumen de cierre confirmado/i });
    const confirmedBreakdown = within(confirmedSummary)
      .getByRole('region', { name: /desglose del conteo físico/i });
    expect(confirmedBreakdown).toHaveTextContent(/Billetes L 50\s*2/i);
    expect(confirmedBreakdown).toHaveTextContent(/Billetes L 20\s*1/i);
    expect(confirmedBreakdown).toHaveTextContent(/Monedas y otros\s*L 5\.50/i);
  });

  it('does not open close confirmation when the reconciliation refresh fails', async () => {
    const getCurrentCashSession = vi.spyOn(apiClient, 'getCurrentCashSession')
      .mockResolvedValueOnce(cashSessionFixture())
      .mockRejectedValueOnce(new Error('SQLSTATE[HY000]: LAN timeout'));
    const closeCashSession = vi.spyOn(apiClient, 'closeCashSession').mockResolvedValue(cashSessionFixture({ status: 'closed' }));

    renderCashBox(<CashBoxView onStatus={vi.fn()} />);
    await activateCashView('Cierre');

    fireEvent.change(await screen.findByLabelText(/monto contado/i), { target: { value: '100.00' } });
    fireEvent.click(screen.getByRole('button', { name: /^cerrar caja$/i }));

    await waitFor(() => expect(getCurrentCashSession).toHaveBeenCalledTimes(2), { timeout: 250 });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText(/no se pudo actualizar caja antes de cerrar/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/SQLSTATE|LAN timeout/i);
    expect(closeCashSession).not.toHaveBeenCalled();
  });

  it('locks close cash fields while the close request is pending', async () => {
    let resolveClose!: (session: CashSession) => void;
    const closeCashSession = vi.spyOn(apiClient, 'closeCashSession')
      .mockReturnValue(new Promise((resolve) => { resolveClose = resolve; }));
    vi.spyOn(apiClient, 'getCurrentCashSession').mockResolvedValue(cashSessionFixture());

    renderCashBox(<CashBoxView onStatus={vi.fn()} />);
    await activateCashView('Cierre');

    fireEvent.change(await screen.findByLabelText(/monto contado/i), { target: { value: '100.00' } });
    fireEvent.change(screen.getByLabelText(/nota de cierre/i), { target: { value: 'Turno contado' } });
    fireEvent.click(screen.getByRole('button', { name: /^cerrar caja$/i }));
    const closeDialog = await screen.findByRole('dialog');
    fireEvent.click(within(closeDialog).getByRole('button', { name: /^cerrar caja$/i }));

    await waitFor(() => expect(closeCashSession).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText(/monto contado/i)).toBeDisabled();
    expect(screen.getByLabelText(/nota de cierre/i)).toBeDisabled();

    await act(async () => {
      resolveClose(cashSessionFixture({ status: 'closed' }));
    });
  });
});

function renderCashBox(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

async function activateCashView(name: 'Resumen' | 'Movimientos' | 'Arqueo' | 'Cierre') {
  fireEvent.click(await screen.findByRole('radio', { name: new RegExp(`^${name}$`, 'i') }));
}

function cashSessionFixture(overrides: Partial<CashSession> = {}): CashSession {
  return {
    id: 1,
    user_id: 2,
    opening_amount: '100.00',
    closing_amount: null,
    expected_amount: null,
    expected_cash_amount: '100.00',
    difference_amount: null,
    payments_count: 0,
    payments_total: '0.00',
    payments_by_method: {
      cash: '0.00',
      transfer: '0.00',
      card: '0.00',
      other: '0.00',
    },
    pending_invoice_count: 0,
    pending_amount: '0.00',
    status: 'open',
    opening_notes: null,
    closing_notes: null,
    opened_at: '2026-05-17T08:00:00-06:00',
    closed_at: null,
    ...overrides,
  };
}
