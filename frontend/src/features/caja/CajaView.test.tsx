import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient, cash, type AuthUser, type CashSession } from '@/lib/api';
import { AdminSessionProvider } from '@/shell/admin/AdminSessionContext';
import { CajaView } from './CajaView';

function user(id: number, permissions: string[]): AuthUser {
  return {
    id,
    name: `Usuario ${id}`,
    email: `usuario${id}@hospital.local`,
    username: `usuario${id}`,
    active: true,
    roles: ['cajero'],
    permissions,
    must_change_password: false,
  };
}

function cashSession(overrides: Partial<CashSession> = {}): CashSession {
  return {
    id: 4,
    cash_register_id: 2,
    cash_register: { id: 2, code: 'AZB-QA', name: 'Caja Azul QA' },
    user_id: 2,
    user: { id: 2, name: 'Cajera Turno', username: 'cajera' },
    opening_amount: '500.00',
    closing_amount: null,
    expected_amount: '1300.00',
    expected_cash_amount: '1300.00',
    difference_amount: null,
    status: 'open',
    opening_notes: null,
    closing_notes: null,
    opened_at: '2026-09-18T08:00:00-06:00',
    closed_at: null,
    ...overrides,
  };
}

function renderCaja({
  authUser,
  session,
}: {
  authUser: AuthUser;
  session: CashSession | null;
}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminSessionProvider
          user={authUser}
          cashSession={session}
          cashSessionLoading={false}
          onStatus={vi.fn()}
        >
          <CajaView />
        </AdminSessionProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CajaView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiClient, 'getCurrentCashSession').mockResolvedValue(cashSession());
    vi.spyOn(cash, 'getCashRegisters').mockResolvedValue([
      { id: 2, code: 'AZB-QA', name: 'Caja Azul QA', active: true },
    ]);
  });

  afterEach(() => {
    cleanup();
  });

  it('distinguishes physical box, user and session', async () => {
    renderCaja({ authUser: user(2, ['cash.view', 'cash.open']), session: cashSession() });

    expect(await screen.findByRole('heading', { level: 1, name: /^caja$/i })).toBeInTheDocument();
    // Un landmark «Caja» por página (axe `landmark-unique`, C4-VISUAL ×4):
    // `getByRole` con el nombre exacto fallaría si hubiera dos; el envoltorio
    // del módulo (#caja) queda sin nombre accesible y sin segundo título.
    const page = screen.getByRole('region', { name: /^caja$/i });
    expect(page).toContainElement(screen.getByRole('heading', { level: 1, name: /^caja$/i }));
    const moduleSurface = document.getElementById('caja');
    expect(moduleSurface).not.toBeNull();
    expect(moduleSurface).not.toHaveAttribute('aria-label');
    expect(screen.queryByRole('heading', { level: 2, name: /^turno de caja$/i })).not.toBeInTheDocument();
    const context = screen.getByRole('region', { name: /caja, usuario y sesión/i });
    expect(context).toHaveTextContent(/caja azul qa/i);
    // Ni el código interno de la caja ni el número de sesión se muestran.
    expect(context).not.toHaveTextContent(/AZB-QA/i);
    expect(context).toHaveTextContent(/usuario 2/i);
    expect(context).not.toHaveTextContent(/#\s*4\b/);
    expect(context).toHaveTextContent(/abierta/i);
    expect(context).toHaveTextContent(/turno abierto por usted/i);
    expect(context).not.toHaveTextContent(/propia/i);
  });

  it('shows supervision when the open session belongs to another cashier', async () => {
    vi.spyOn(apiClient, 'getCurrentCashSession').mockResolvedValue(
      cashSession({ user_id: 77, user: { id: 77, name: 'Cajero Ajeno', username: 'ajeno' } }),
    );
    renderCaja({
      authUser: user(2, ['cash.view', 'cash.close_any']),
      session: cashSession({ user_id: 77, user: { id: 77, name: 'Cajero Ajeno', username: 'ajeno' } }),
    });

    const context = await screen.findByRole('region', { name: /caja, usuario y sesión/i });
    expect(context).toHaveTextContent(/supervisión/i);
    expect(context).toHaveTextContent(/cajero ajeno/i);
  });

  it('blocks the surface without cash.view instead of hiding the reason', async () => {
    renderCaja({ authUser: user(2, ['invoices.view']), session: cashSession() });

    expect(await screen.findByText(/sin permiso de caja/i)).toBeInTheDocument();
    expect(screen.getByText(/solicite acceso a caja a un administrador/i)).toBeInTheDocument();
    expect(screen.queryByText(/cash\.view/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/monto inicial/i)).not.toBeInTheDocument();
  });

  it('hosts the opening workflow when there is no session', async () => {
    vi.spyOn(apiClient, 'getCurrentCashSession').mockResolvedValue(null);
    renderCaja({ authUser: user(2, ['cash.view', 'cash.open']), session: null });

    expect(await screen.findByRole('heading', { level: 1, name: /^caja$/i })).toBeInTheDocument();
    expect(await screen.findByLabelText(/monto inicial/i)).toHaveValue('0.00');
    expect(screen.getByText(/no hay una caja abierta actualmente/i)).toBeInTheDocument();
    expect(screen.getAllByText(/caja cerrada/i).length).toBeGreaterThan(0);
  });
});
