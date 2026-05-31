/// <reference types="node" />
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { apiClient } from '../../lib/api';
import { queryClient } from '../../lib/query-client';
import { resetRequestChain } from '../../lib/api/base';

describe('CashBoxView', () => {
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

      return {
        ok: true,
        json: async () => ({ data: [] }),
      } as Response;
    });

    render(<App />);

    expect((await screen.findAllByText(/saldo pendiente/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/L\. 23\.75/i).length).toBeGreaterThan(0);
    expect(await screen.findByText(/revise los cobros antes de cerrar/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cerrar caja$/i })).toBeDisabled();
  });
});
