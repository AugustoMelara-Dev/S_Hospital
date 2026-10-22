import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { billing, reports, type AuthUser, type CashSession, type Invoice, type TodayReport } from '@/lib/api';
import { AdminSessionProvider } from '@/shell/admin/AdminSessionContext';
import { ResumenView } from './ResumenView';

const today: TodayReport = {
  date: '2026-09-18',
  timezone: 'America/Tegucigalpa',
  server_time: '2026-09-18T15:00:00-06:00',
  cash_session_open: true,
  cash_session_id: 4,
  cash_session_opened_at: '2026-09-18T08:00:00-06:00',
  cash_session_opening_amount: '500.00',
  issued_count: 2,
  without_charge_count: 1,
  collected_count: 1,
  billed: '1500.00',
  collected: '900.00',
  pending: '400.00',
  voided_count: 0,
  voided_amount: '0.00',
  reversal_count: 0,
  pending_invoice_count: 1,
  pending_invoice_amount: '700.00',
  payments_by_method: { cash: '800.00', transfer: '0.00', card: '0.00', other: '0.00' },
  payments_count_by_method: { cash: 1, transfer: 0, card: 0, other: 0 },
  backup_pending: false,
  backup_pending_age_hours: null,
};

const cashSession: CashSession = {
  id: 4,
  user_id: 2,
  user: { id: 2, name: 'Cajera Resumen', username: 'cajera' },
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
  pending_invoice_count: 1,
  pending_amount: '700.00',
};

const RECENT_LIMIT = 8;

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1,
    invoice_number: 'F-0001',
    patient_name: 'Paciente Demo',
    subtotal: '0.00',
    tax_amount: '0.00',
    discount_amount: '0.00',
    total: '0.00',
    paid_amount: '0.00',
    balance_due: '0.00',
    status: 'paid',
    issued_at: '2026-09-18T09:00:00-06:00',
    items: [],
    ...overrides,
  };
}

function user(permissions: string[]): AuthUser {
  return {
    id: 2,
    name: 'Cajera Resumen',
    email: 'cajera@hospital.local',
    username: 'cajera',
    active: true,
    roles: ['cajero'],
    permissions,
    must_change_password: false,
  };
}

function renderResumen(permissions: string[], session: CashSession | null = cashSession) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <AdminSessionProvider
                user={user(permissions)}
                cashSession={session}
                cashSessionLoading={false}
                onStatus={vi.fn()}
              >
                <ResumenView />
              </AdminSessionProvider>
            }
          />
          <Route path="/recibos" element={<RecibosRouteProbe />} />
          <Route path="/cobrar" element={<div data-testid="cobrar-route">Cobrar destino</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function RecibosRouteProbe() {
  const location = useLocation();
  return <div data-testid="recibos-route">recibos{location.search}</div>;
}

describe('ResumenView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(reports, 'getTodayReport').mockResolvedValue(today);
    vi.spyOn(billing, 'getInvoices').mockImplementation(async () => {
      return {
        data: [
          invoice({ id: 9, invoice_number: 'F-0009', total: '0.00' }),
          invoice({
            id: 10,
            invoice_number: 'F-0010',
            patient_name: 'Paciente Cobrado',
            total: '800.00',
            paid_amount: '800.00',
            status: 'paid',
          }),
        ],
        meta: { current_page: 1, per_page: 8, total: 2 },
      };
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the four cohorts with explicit scope, period and zero-total operations', async () => {
    renderResumen(['invoices.view', 'cash.view']);

    expect(await screen.findByRole('heading', { level: 1, name: /^resumen$/i })).toBeInTheDocument();
    // Composición nueva: el ámbito y el período son chips, no una frase técnica.
    expect(screen.getByText(/tus operaciones/i)).toBeInTheDocument();
    expect(screen.getByText(/^hoy/i)).toBeInTheDocument();

    for (const label of ['Emitido / facturado', 'Cobrado', 'Saldo al corte', 'Operaciones sin cobro']) {
      expect(await screen.findByText(label)).toBeInTheDocument();
    }

    expect(await screen.findByText(/L\.\s*1,500\.00/)).toBeInTheDocument();
    expect(screen.getAllByText(/L\.\s*900\.00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/L\.\s*400\.00/).length).toBeGreaterThanOrEqual(1);
    // Contexto breve junto a la cifra; la definición extensa vive bajo demanda.
    expect(screen.getByText(/por cobrar de la emisión/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^definición$/i).length).toBe(4);

    // Un solo patrón de KPI (C4-VISUAL): la banda vive dentro de la tarjeta
    // del corte, como `group` con nombre propio (paridad con ReporteResumen).
    const corte = await screen.findByRole('region', { name: /métricas del corte/i });
    expect(corte).toContainElement(screen.getByRole('group', { name: /cohortes del corte/i }));
    expect(within(corte).getByText('1 operación')).toBeInTheDocument();
    expect(billing.getInvoices).toHaveBeenCalledTimes(1);
    expect(billing.getInvoices).toHaveBeenCalledWith({ per_page: RECENT_LIMIT });

    expect(await screen.findAllByText('Emitida sin cobro')).not.toHaveLength(0);
    expect(screen.getAllByText('F-0009').length).toBeGreaterThanOrEqual(1);
  });

  it('does not invent a zero-charge count when the server field is absent', async () => {
    vi.spyOn(reports, 'getTodayReport').mockResolvedValue({
      ...today,
      without_charge_count: undefined,
    });
    renderResumen(['cash.view']);

    expect(await screen.findByText('Operaciones sin cobro')).toBeInTheDocument();
    expect(await screen.findByText('No disponible')).toBeInTheDocument();
    expect(screen.getByText(/sin permiso para el listado/i)).toBeInTheDocument();
    expect(screen.queryAllByText('F-0009')).toHaveLength(0);
  });

  it('shows a retry on a failed cut instead of zeros', async () => {
    vi.spyOn(reports, 'getTodayReport').mockRejectedValue(new Error('SQLSTATE[HY000] LAN caida'));
    renderResumen(['invoices.view']);

    expect((await screen.findAllByText(/no se pudo cargar el corte del día/i)).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/SQLSTATE|LAN caida/i);
  });

  it('shows an actionable "Atención ahora" strip from the session and period cohorts', async () => {
    renderResumen(
      ['invoices.view', 'cash.view'],
      { ...cashSession, missing_institutional_receipt_count: 2 },
    );

    const strip = await screen.findByRole('region', { name: /atención ahora/i });
    expect(strip).toHaveTextContent(/operaciones pendientes de cobro/i);
    expect(strip).toHaveTextContent(/1 operación/i);
    expect(strip).toHaveTextContent(/L\.\s*700\.00/i);
    expect(strip).toHaveTextContent(/recibos institucionales pendientes/i);
    // Una caja abierta durante el turno es operación normal, no una incidencia.
    expect(strip).not.toHaveTextContent(/caja abierta sin cerrar/i);
    expect(strip).not.toHaveTextContent(/caja con diferencia/i);

    expect(within(strip).getAllByRole('link', { name: /ver en recibos/i })[0]).toHaveAttribute('href', '/recibos');
    expect(within(strip).getByRole('link', { name: /emitir recibos/i })).toHaveAttribute('href', '/recibos');
  });

  it('declara la caja con diferencia como pendiente accionable y no el turno abierto', async () => {
    renderResumen(['invoices.view', 'cash.view'], {
      ...cashSession,
      difference_amount: '-15.50',
      missing_institutional_receipt_count: 0,
    });

    const strip = await screen.findByRole('region', { name: /atención ahora/i });
    expect(strip).toHaveTextContent(/caja con diferencia/i);
    expect(within(strip).getByRole('link', { name: /ir a caja/i })).toHaveAttribute('href', '/caja');
    expect(strip).not.toHaveTextContent(/caja abierta sin cerrar/i);
  });

  it('hides "Atención ahora" when there is nothing to attend', async () => {
    vi.spyOn(reports, 'getTodayReport').mockResolvedValue({
      ...today,
      cash_session_open: false,
      pending_invoice_count: 0,
      pending_invoice_amount: '0.00',
    });

    renderResumen(['invoices.view', 'cash.view'], null);

    expect(await screen.findByText('Emitido / facturado')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /atención ahora/i })).not.toBeInTheDocument();
  });

  it('makes recent operations rows activatable by keyboard and navigates to the deep link', async () => {
    renderResumen(['invoices.view', 'cash.view']);

    const row = await screen.findByRole('row', { name: /abrir operación f-0010 de paciente cobrado/i });
    expect(row).toHaveAttribute('tabindex', '0');

    fireEvent.keyDown(row, { key: 'Enter' });

    expect(await screen.findByText('recibos?operacion=10')).toBeInTheDocument();
  });

  it('activates a recent operation by click', async () => {
    renderResumen(['invoices.view', 'cash.view']);

    fireEvent.click(await screen.findByRole('row', { name: /abrir operación f-0009/i }));

    expect(await screen.findByText('recibos?operacion=9')).toBeInTheDocument();
  });

  it('points the empty state to Cobrar instead of a generic message', async () => {
    vi.spyOn(billing, 'getInvoices').mockResolvedValue({
      data: [],
      meta: { current_page: 1, per_page: 8, total: 0 },
    });

    renderResumen(['invoices.view', 'invoices.create', 'cash.view']);

    expect(await screen.findByText(/aún no hay operaciones en el período/i)).toBeInTheDocument();
    expect(screen.getByText(/cree una en cobrar/i)).toBeInTheDocument();
    const cobrarLinks = screen.getAllByRole('link', { name: /^cobrar$/i });
    expect(cobrarLinks.length).toBeGreaterThan(0);
    for (const link of cobrarLinks) {
      expect(link).toHaveAttribute('href', '/cobrar');
    }
    expect(screen.queryByText(/sin registros/i)).not.toBeInTheDocument();
  });

  it('declara el estado de caja una sola vez y omite las filas en cero', async () => {
    renderResumen(['invoices.view', 'cash.view'], {
      ...cashSession,
      pending_amount: '0.00',
      pending_invoice_count: 0,
    });

    const panel = await screen.findByRole('region', { name: /caja y turno actual/i });
    expect(within(panel).getAllByText(/caja abierta/i)).toHaveLength(1);
    expect(within(panel).getByText(/sesión #4/i)).toBeInTheDocument();
    // Un saldo en cero no ocupa una fila.
    expect(within(panel).queryByText(/saldo pendiente/i)).toBeNull();
  });

  it('en móvil lista cada operación en tres líneas compactas, sin tarjeta de tabla', async () => {
    renderResumen(['invoices.view', 'cash.view']);

    const list = await screen.findByRole('list', { name: /operaciones recientes/i });
    expect(list).toHaveClass('md:hidden');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);

    const link = within(items[0]).getByRole('link');
    // Tres líneas: número + importe, paciente + fecha, estado.
    expect(link.children).toHaveLength(3);
    expect(items[0]).toHaveTextContent(/F-0009/);
    expect(items[0]).toHaveTextContent(/L\.\s*0\.00/);
    expect(items[0]).toHaveTextContent(/paciente demo/i);
    expect(items[0]).toHaveTextContent(/18\/09\/2026/);
    expect(items[0]).toHaveTextContent(/emitida sin cobro/i);
    // No repite las etiquetas de la tarjeta etiqueta/valor de la tabla.
    expect(within(items[0]).queryByText(/^documento$/i)).toBeNull();
    expect(within(items[0]).queryByText(/^total$/i)).toBeNull();
    expect(link).toHaveAttribute('href', '/recibos?operacion=9');
  });

  it('mantiene altura natural en operaciones recientes con 0, 2 y 30 registros', async () => {
    const getInvoices = vi.spyOn(billing, 'getInvoices');
    function mockRecent(rows: Invoice[], total = rows.length) {
      getInvoices.mockImplementation(async () => {
        return { data: rows, meta: { current_page: 1, per_page: RECENT_LIMIT, total } };
      });
    }

    // 0 registros: estado vacío accionable, sin tabla y sin contenedor alto.
    mockRecent([]);
    const first = renderResumen(['invoices.view', 'cash.view']);
    expect(await screen.findByText(/aún no hay operaciones en el período/i)).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: /operaciones recientes/i })).toBeNull();
    first.unmount();

    // 2 registros: la superficie no se estira a la altura de la columna vecina.
    mockRecent([
      invoice({ id: 1, invoice_number: 'F-0001', total: '120.00' }),
      invoice({ id: 2, invoice_number: 'F-0002', total: '130.00', status: 'issued' }),
    ]);
    const second = renderResumen(['invoices.view', 'cash.view']);
    const twoTable = await screen.findByRole('table', { name: /operaciones recientes/i });
    expect(within(twoTable).getAllByRole('row')).toHaveLength(3);
    const panel = screen.getByRole('region', { name: /operaciones recientes/i });
    expect(panel.parentElement?.className).toMatch(/items-start/);
    expect(screen.queryByRole('link', { name: /ver todas las operaciones/i })).toBeNull();
    second.unmount();

    // 30 registros: se despliegan completos, sin altura máxima que recorte.
    mockRecent(
      Array.from({ length: RECENT_LIMIT }, (_, index) =>
        invoice({
          id: 100 + index,
          invoice_number: `F-${String(index + 1).padStart(4, '0')}`,
          patient_name: `Paciente ${index + 1}`,
          total: '120.00',
        }),
      ),
      30,
    );
    renderResumen(['invoices.view', 'cash.view']);
    const manyTable = await screen.findByRole('table', { name: /operaciones recientes/i });
    expect(within(manyTable).getAllByRole('row')).toHaveLength(RECENT_LIMIT + 1);
    expect(manyTable.closest('[class*="max-h"]')).toBeNull();
    expect(screen.getByRole('link', { name: /ver todas las operaciones/i })).toHaveAttribute(
      'href',
      '/recibos',
    );
  });

  it('no presenta violaciones axe en la franja de métricas ni en caja actual', async () => {
    const { container } = renderResumen(['invoices.view', 'cash.view']);

    expect(await screen.findByText('Emitido / facturado')).toBeInTheDocument();
    await screen.findAllByText('F-0009');
    await waitFor(() => expect(screen.queryByText('No disponible')).not.toBeInTheDocument());
    // Regresión T-UI-24: la franja de métricas no es un `<dl>` mal formado
    // (`definition-list`, serious). AdminMetric renderiza `<p>`, no `<dt>/<dd>`.
    expect(await axe(container)).toHaveNoViolations();
  });
});
