/// <reference types="node" />
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '../../App';
import { apiClient, type CashSession } from '../../lib/api';
import { queryClient } from '../../lib/query-client';
import { resetRequestChain } from '../../lib/api/base';
import { CashBoxView } from './CashBoxView';

describe('CashBoxView', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
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
              permissions: ['cash.view', 'cash.open', 'cash.close'],
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

    expect(await screen.findByRole('link', { name: /caja/i })).toHaveAttribute('href', '/cashbox');
    expect(screen.queryByRole('link', { name: /backups/i })).not.toBeInTheDocument();
    expect((await screen.findAllByRole('heading', { name: /^caja$/i })).length).toBeGreaterThan(0);
    expect(await screen.findByText(/no hay una caja abierta actualmente/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/monto inicial/i)).toHaveValue('0.00');
    fireEvent.click(screen.getByRole('button', { name: /abrir caja/i }));
    const openingDialog = await screen.findByRole('alertdialog', { name: /confirmar apertura de caja/i });
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
    expect(await screen.findByText(/caja lista para facturar/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /nueva factura/i }).length).toBeGreaterThan(0);
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

    expect((await screen.findAllByText(/saldo pendiente/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/L 23\.75/i).length).toBeGreaterThan(0);
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
    expect(screen.getAllByText('L 0.00').length).toBeGreaterThanOrEqual(5);
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

    const dialog = await screen.findByRole('alertdialog', { name: /confirmar apertura de caja/i });
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

  it('locks the open cash form while the opening confirmation is active', async () => {
    vi.spyOn(apiClient, 'openCashSession').mockResolvedValue(cashSessionFixture({ id: 53, opening_amount: '75.00' }));
    vi.spyOn(apiClient, 'getCurrentCashSession').mockResolvedValue(null);

    renderCashBox(<CashBoxView onStatus={vi.fn()} />);

    const amount = await screen.findByLabelText(/monto inicial/i);
    fireEvent.change(amount, { target: { value: '75.00' } });
    fireEvent.click(screen.getByRole('button', { name: /abrir caja/i }));

    expect(await screen.findByRole('alertdialog', { name: /confirmar apertura de caja/i })).toBeInTheDocument();
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

    const dialog = await screen.findByRole('alertdialog', { name: /confirmar apertura de caja/i });
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

    const closeButton = await screen.findByRole('button', { name: /^cerrar caja$/i });
    expect(closeButton).toBeDisabled();
    expect(screen.getByText(/solo usuarios con permiso de cierre/i)).toBeInTheDocument();
    expect(closeCashSession).not.toHaveBeenCalled();

    cleanup();
    vi.spyOn(apiClient, 'getCurrentCashSession').mockResolvedValue(cashSessionFixture());
    renderCashBox(<CashBoxView onStatus={vi.fn()} />);

    const counted = await screen.findByLabelText(/monto contado/i);
    expect(document.activeElement).toHaveAttribute('id', 'closing_amount');
    fireEvent.change(counted, { target: { value: '100.00' } });
    fireEvent.click(screen.getByRole('button', { name: /^cerrar caja$/i }));

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
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

  it('trims close difference notes before sending the audited payload', async () => {
    const closeCashSession = vi.spyOn(apiClient, 'closeCashSession').mockResolvedValue(cashSessionFixture({ status: 'closed' }));
    vi.spyOn(apiClient, 'getCurrentCashSession').mockResolvedValue(cashSessionFixture());

    renderCashBox(<CashBoxView onStatus={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText(/monto contado/i), { target: { value: '99.00' } });
    fireEvent.change(screen.getByLabelText(/nota de cierre/i), { target: { value: '  Faltante validado  ' } });
    fireEvent.click(screen.getByRole('button', { name: /^cerrar caja$/i }));
    fireEvent.click((await screen.findAllByRole('button', { name: /^cerrar caja$/i })).at(-1)!);

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

    fireEvent.change(await screen.findByLabelText(/monto contado/i), { target: { value: ' 100.00 ' } });
    fireEvent.click(screen.getByRole('button', { name: /^cerrar caja$/i }));
    fireEvent.click((await screen.findAllByRole('button', { name: /^cerrar caja$/i })).at(-1)!);

    await waitFor(() => expect(closeCashSession).toHaveBeenCalledWith(
      1,
      {
        closing_amount: '100.00',
        notes: null,
      },
      { idempotencyKey: expect.any(String) },
    ));
  });

  it('locks close cash fields while the close request is pending', async () => {
    let resolveClose!: (session: CashSession) => void;
    const closeCashSession = vi.spyOn(apiClient, 'closeCashSession')
      .mockReturnValue(new Promise((resolve) => { resolveClose = resolve; }));
    vi.spyOn(apiClient, 'getCurrentCashSession').mockResolvedValue(cashSessionFixture());

    renderCashBox(<CashBoxView onStatus={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText(/monto contado/i), { target: { value: '100.00' } });
    fireEvent.change(screen.getByLabelText(/nota de cierre/i), { target: { value: 'Turno contado' } });
    fireEvent.click(screen.getByRole('button', { name: /^cerrar caja$/i }));
    fireEvent.click((await screen.findAllByRole('button', { name: /^cerrar caja$/i })).at(-1)!);

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
