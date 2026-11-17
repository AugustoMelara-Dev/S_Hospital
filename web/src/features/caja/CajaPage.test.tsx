import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CashSession, Permission, Reconciliation } from '@/api/types';
import { makeMe, mockApi, reply, type MockRequest } from '@/test/mockApi';
import { renderWithProviders } from '@/test/render';
import CajaPage from './CajaPage';

const emptyPage = { items: [], page: 1, per_page: 25, total: 0 };
const registers = [{ id: 1, code: 'principal', name: 'Caja principal', active: true }];

function rec(overrides: Partial<Reconciliation> = {}): Reconciliation {
  return {
    opening_cents: 50_000,
    expected_cash_cents: 150_000,
    method_totals: { cash: 100_000, transfer: 20_000, card: 0, other: 0 },
    payments_count: 3,
    payments_total_cents: 120_000,
    pending_count: 0,
    pending_cents: 0,
    missing_receipts_count: 0,
    can_close: true,
    blockers: [],
    ...overrides,
  };
}

function openSession(overrides: Partial<CashSession> = {}): CashSession {
  return {
    id: 7,
    cash_register: { id: 1, code: 'principal', name: 'Caja principal' },
    user: { id: 1, name: 'Ana Martínez' },
    status: 'open',
    opening_cents: 50_000,
    opening_notes: '',
    opened_at: '2026-11-17T07:02:00-06:00',
    closed_at: null,
    closed_by: null,
    counted_cents: null,
    expected_cash_cents: null,
    difference_cents: null,
    closing_notes: '',
    closing_breakdown: null,
    method_totals: null,
    payments_count: 0,
    payments_total_cents: 0,
    reconciliation: rec(),
    ...overrides,
  };
}

const base = {
  'GET /cash-registers': registers,
  'GET /cash-sessions': emptyPage,
  'GET /users': emptyPage,
};

describe('CajaPage — apertura', () => {
  it('opens a session with an Idempotency-Key and shows the open session', async () => {
    const user = userEvent.setup();
    let current: CashSession | null = null;
    const api = mockApi({
      ...base,
      'GET /auth/me': makeMe(),
      'GET /cash-sessions/current': () => current,
      'POST /cash-sessions/open': ({ body }: MockRequest) => {
        current = openSession({ opening_cents: (body as { opening_cents: number }).opening_cents });
        return reply(201, current);
      },
    });
    renderWithProviders(<CajaPage />, { path: '/caja' });

    expect(await screen.findByRole('heading', { name: 'Apertura de caja' })).toBeInTheDocument();
    // Single register is auto-selected.
    await waitFor(() => expect(screen.getByLabelText(/Caja física/)).toHaveValue('1'));
    const amount = screen.getByLabelText(/Monto inicial/);
    await user.clear(amount);
    await user.type(amount, '500');
    await user.click(screen.getByRole('button', { name: 'Abrir caja' }));

    expect(await screen.findByText('Caja abierta.')).toBeInTheDocument();
    const [call] = api.calls('POST /cash-sessions/open');
    expect(call?.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(call?.body).toEqual({ cash_register_id: 1, opening_cents: 50_000 });
    expect(await screen.findByText('Cobros registrados')).toBeInTheDocument();
    expect(api.unmatched).toEqual([]);
  });

  it('shows "Caja en modo consulta" without cash.open', async () => {
    const perms: Permission[] = ['cash.view'];
    mockApi({ ...base, 'GET /auth/me': makeMe({ permissions: perms }), 'GET /cash-sessions/current': null });
    renderWithProviders(<CajaPage />, { path: '/caja' });
    expect(await screen.findByText('Caja en modo consulta')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir caja' })).not.toBeInTheDocument();
  });
});

describe('CajaPage — arqueo y cierre', () => {
  it('computes the count, requires a note when there is a difference and closes with the breakdown', async () => {
    const user = userEvent.setup();
    const api = mockApi({
      ...base,
      'GET /auth/me': makeMe(),
      'GET /cash-sessions/current': openSession(),
      'POST /cash-sessions/:id/close': ({ body }: MockRequest) => {
        const b = body as { counted_cents: number; notes?: string };
        return openSession({
          status: 'closed',
          closed_at: '2026-11-17T15:00:00-06:00',
          counted_cents: b.counted_cents,
          expected_cash_cents: 150_000,
          difference_cents: b.counted_cents - 150_000,
          closing_notes: b.notes ?? '',
        });
      },
    });
    renderWithProviders(<CajaPage />, { path: '/caja' });

    await user.click(await screen.findByRole('tab', { name: 'Arqueo' }));
    await user.type(screen.getByLabelText('Cantidad de billetes de L 500'), '2');
    const diff = screen.getByTestId('arqueo-diferencia');
    expect(diff).toHaveTextContent('Faltante');
    expect(diff).toHaveTextContent('-L 500.00');
    await user.type(screen.getByLabelText('Cantidad de billetes de L 200'), '3');
    expect(diff).toHaveTextContent('Sobrante');
    expect(diff).toHaveTextContent('+L 100.00');
    await user.clear(screen.getByLabelText('Cantidad de billetes de L 200'));
    await user.type(screen.getByLabelText('Cantidad de billetes de L 200'), '2');
    await user.type(screen.getByLabelText('Cantidad de billetes de L 100'), '1');
    expect(diff).toHaveTextContent('Cuadra');
    await user.clear(screen.getByLabelText('Cantidad de billetes de L 200'));
    await user.clear(screen.getByLabelText('Cantidad de billetes de L 100'));

    await user.click(screen.getByRole('button', { name: 'Continuar al cierre' }));
    await user.click(screen.getByRole('button', { name: 'Cerrar caja' }));
    expect(await screen.findByText('Explique la diferencia (mínimo 5 caracteres).')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/Nota de cierre/), 'Faltan billetes de 500');
    await user.click(screen.getByRole('button', { name: 'Cerrar caja' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cierre de caja' });
    expect(within(dialog).getByText('Faltante')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar caja' }));

    expect(await screen.findByText('Resumen de cierre')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Imprimir resumen' })).toBeInTheDocument();
    const [call] = api.calls('POST /cash-sessions/:id/close');
    expect(call?.path).toBe('/api/cash-sessions/7/close');
    expect(call?.headers['idempotency-key']).toBeDefined();
    expect(call?.body).toEqual({
      counted_cents: 100_000,
      notes: 'Faltan billetes de 500',
      breakdown: { bills: { '500': 2 }, coins_cents: 0 },
    });
  });

  it('lists blockers with a link to resolve them and disables closing', async () => {
    const user = userEvent.setup();
    mockApi({
      ...base,
      'GET /auth/me': makeMe(),
      'GET /cash-sessions/current': openSession({
        reconciliation: rec({
          expected_cash_cents: 50_000,
          pending_count: 2,
          pending_cents: 30_000,
          can_close: false,
          blockers: [{ code: 'pending_invoices', message: 'Hay facturas pendientes de cobro en este turno.', count: 2 }],
        }),
      }),
    });
    renderWithProviders(<CajaPage />, { path: '/caja' });

    await user.click(await screen.findByRole('tab', { name: 'Arqueo' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar conteo en cero' }));
    await user.click(screen.getByRole('button', { name: 'Continuar al cierre' }));

    expect(screen.getByText('Hay facturas pendientes de cobro en este turno.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Resolver en Recibos/ })).toHaveAttribute('href', '/recibos?pending=1');
    expect(screen.getByRole('button', { name: 'Cerrar caja' })).toBeDisabled();
  });
});
