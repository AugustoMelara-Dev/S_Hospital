import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminSessionProvider } from '@/shell/admin/AdminSessionContext';
import type { AuthUser, CashSession } from '@/lib/api';
import { computePresetRange } from '@/features/reports/components/reportDateRanges';
import { ReportesView } from './ReportesView';
import { buildReporteEjecutivo } from './testUtils';

const useReporteEjecutivoMock = vi.hoisted(() => vi.fn());
const downloadExecutivePdf = vi.hoisted(() => vi.fn());
const downloadExecutiveExcel = vi.hoisted(() => vi.fn());
const getCashSessions = vi.hoisted(() => vi.fn());
const downloadBlob = vi.hoisted(() => vi.fn());
const useCategoriesMock = vi.hoisted(() => vi.fn());

vi.mock('./useReporteEjecutivo', () => ({ useReporteEjecutivo: useReporteEjecutivoMock }));

vi.mock('@/hooks/useCategories', () => ({
  useCategories: useCategoriesMock,
}));

vi.mock('@/lib/download', () => ({
  downloadBlob,
  openBlobInNewTab: vi.fn(),
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    cash: { ...actual.cash, getCashSessions },
    reports: {
      ...actual.reports,
      downloadExecutivePdf,
      downloadExecutiveExcel,
    },
  };
});

const user: AuthUser = {
  id: 7,
  name: 'Supervisora Reportes',
  email: 'super@hospital.local',
  username: 'super',
  active: true,
  roles: ['supervisor'],
  permissions: ['reports.managerial.view', 'reports.export'],
  must_change_password: false,
};

const cashSession: CashSession = {
  id: 42,
  user_id: 7,
  user: { id: 7, name: 'Ana Ruiz', username: 'aruiz' },
  opening_amount: '500.00',
  closing_amount: null,
  expected_amount: '0.00',
  expected_cash_amount: '0.00',
  difference_amount: null,
  status: 'open',
  opening_notes: null,
  closing_notes: null,
  opened_at: '2026-06-02T08:00:00-06:00',
  closed_at: null,
  pending_invoice_count: 0,
  pending_amount: '0.00',
};

function renderReportes(
  permissions: string[] = user.permissions,
  session: CashSession | null = cashSession,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/reportes']}>
        <AdminSessionProvider
          user={{ ...user, permissions }}
          cashSession={session}
          cashSessionLoading={false}
          onStatus={vi.fn()}
        >
          <ReportesView />
        </AdminSessionProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReportesView', () => {
  beforeEach(() => {
    useReporteEjecutivoMock.mockReset();
    useReporteEjecutivoMock.mockReturnValue({
      data: buildReporteEjecutivo(),
      dataUpdatedAt: 1,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
      error: null,
    });
    getCashSessions.mockReset();
    getCashSessions.mockResolvedValue({ data: [cashSession], meta: { current_page: 1, per_page: 50, total: 1 } });
    useCategoriesMock.mockReset();
    useCategoriesMock.mockReturnValue({
      data: [{ id: 1, name: 'Laboratorio' }],
      isError: false,
      isPending: false,
      refetch: vi.fn(),
    });
    downloadExecutivePdf.mockReset();
    downloadExecutiveExcel.mockReset();
    downloadBlob.mockReset();
    downloadExecutivePdf.mockResolvedValue(new Blob(['pdf']));
    downloadExecutiveExcel.mockResolvedValue(new Blob(['xlsx']));
  });

  it('denies the screen without a reports permission', () => {
    renderReportes([]);
    expect(screen.getByRole('heading', { level: 1, name: 'Reportes' })).toBeInTheDocument();
    expect(screen.getByText(/reportes no disponibles/i)).toBeInTheDocument();
    expect(screen.getByTestId('reporte-scope')).toHaveTextContent('Acceso no habilitado');
  });

  it('muestra un desglose activo a la vez y permite recorrer los cinco', () => {
    renderReportes();

    expect(screen.getByRole('heading', { name: 'Reportes' })).toBeInTheDocument();
    expect(screen.getByText(/resumen del período/i)).toBeInTheDocument();

    const tabs = screen.getByRole('tablist', { name: 'Desglose del reporte' });
    for (const label of ['Operaciones', 'Detalle', 'Cobros', 'Caja', 'Gratuidades']) {
      expect(within(tabs).getByRole('tab', { name: new RegExp(`^${label} \\(`) })).toBeInTheDocument();
    }

    // V07: una sola tabla visible; las cinco no se apilan.
    expect(screen.getByRole('region', { name: 'Operaciones' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Caja' })).not.toBeInTheDocument();
    expect(screen.getByText('Pagada', { selector: '[data-ui-status]' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Operaciones' })).not.toHaveTextContent(/CAJA-01/);

    fireEvent.click(within(tabs).getByRole('tab', { name: /^Caja \(/ }));
    expect(screen.getByRole('region', { name: 'Caja' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Operaciones' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Caja Principal').length).toBeGreaterThanOrEqual(1);
    // Solo el nombre de la caja: ni su código interno ni el número de sesión.
    expect(screen.getByRole('region', { name: 'Caja' })).not.toHaveTextContent(/CAJA-01|#\d+/);

    fireEvent.click(within(tabs).getByRole('tab', { name: /^Gratuidades \(/ }));
    expect(screen.getByRole('region', { name: 'Gratuidades' })).toBeInTheDocument();
    expect(screen.getAllByText(/EPO por línea/i).length).toBeGreaterThanOrEqual(1);
  });

  it('expone un único landmark de página «Reportes»', () => {
    renderReportes();

    const page = screen.getByRole('region', { name: 'Reportes' });
    expect(page).toContainElement(screen.getByRole('heading', { level: 1, name: 'Reportes' }));
    expect(screen.getAllByRole('region', { name: /^reportes$/i })).toHaveLength(1);

    expect(screen.getByRole('region', { name: 'Resumen del período' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Desglose' })).toBeInTheDocument();
  });

  it('compone la banda de cohortes con las cuatro métricas y sus bases', () => {
    renderReportes();

    const band = screen.getByRole('group', { name: 'Indicadores del período' });
    ['Facturado', 'Cobrado', 'Saldo al corte', 'Sin cobro'].forEach((label) => {
      expect(within(band).getByText(label)).toBeInTheDocument();
    });

    // Cada cohorte declara su base; el saldo no se lee como facturado − cobrado.
    expect(within(band).getByText(/emisión del período/i)).toBeInTheDocument();
    expect(within(band).getByText(/fecha de cobro/i)).toBeInTheDocument();
    expect(within(band).getByText(/a la fecha de corte/i)).toBeInTheDocument();
    expect(within(band).getByText(/sin cobro por regla o precio cero/i)).toBeInTheDocument();
  });

  it('resume el alcance en chips en lugar de un párrafo técnico', () => {
    renderReportes();

    const scope = screen.getByTestId('reporte-scope');
    expect(scope).toHaveTextContent('Todas las cajas');
    expect(scope).not.toHaveTextContent(/ámbito/i);
    // El período se lee en formato local, nunca como fecha ISO de máquina.
    expect(scope).toHaveTextContent(/(Del|Día) \d{2}\/\d{2}\/\d{4}/);
    expect(scope).not.toHaveTextContent(/\d{4}-\d{2}-\d{2}|→/);
    expect(screen.queryByText(/ámbito autorizado del servidor/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/misma fuente/i)).not.toBeInTheDocument();
  });

  it('agrupa el desglose en un cuerpo único con un selector de cinco destinos', () => {
    renderReportes();

    const desglose = screen.getByRole('region', { name: 'Desglose' });
    const tabs = within(desglose).getByRole('tablist', { name: 'Desglose del reporte' });

    expect(within(tabs).getAllByRole('tab')).toHaveLength(5);
    // Exactamente un desglose renderizado dentro del panel activo.
    expect(within(desglose).getAllByRole('region')).toHaveLength(1);
    expect(within(desglose).getByRole('region', { name: 'Operaciones' })).toBeInTheDocument();
  });

  it('no dibuja la distribución por método cuando no aporta lectura', () => {
    renderReportes();

    const tabs = screen.getByRole('tablist', { name: 'Desglose del reporte' });
    fireEvent.click(within(tabs).getByRole('tab', { name: /^Cobros \(/ }));

    expect(screen.queryByText('Cobros por método')).not.toBeInTheDocument();
    expect(screen.queryByText('75%')).not.toBeInTheDocument();
  });

  it('dibuja la distribución por método con dos o más métodos', () => {
    const base = buildReporteEjecutivo();
    const [firstCollection] = base.collections;

    useReporteEjecutivoMock.mockReturnValue({
      data: buildReporteEjecutivo({
        collections: [
          { ...firstCollection, amount: '100.00' },
          { ...firstCollection, method: 'card', method_label: 'Tarjeta', amount: '300.00', reference: 'TRX-9', paid_at: '2026-06-02T10:15:00-06:00' },
        ],
      }),
      dataUpdatedAt: 1,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
      error: null,
    });

    renderReportes();

    const tabs = screen.getByRole('tablist', { name: 'Desglose del reporte' });
    fireEvent.click(within(tabs).getByRole('tab', { name: /^Cobros \(/ }));

    expect(screen.getByText('Cobros por método')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('exports PDF and Excel with the applied filters', async () => {
    renderReportes();

    fireEvent.click(screen.getByRole('button', { name: /exportar pdf/i }));
    await waitFor(() => expect(downloadExecutivePdf).toHaveBeenCalledTimes(1));
    expect(downloadExecutivePdf.mock.calls[0][0]).toMatchObject({ date_from: expect.any(String), date_to: expect.any(String) });
    await waitFor(() =>
      expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/\.pdf$/)),
    );

    fireEvent.click(screen.getByRole('button', { name: /exportar excel/i }));
    await waitFor(() => expect(downloadExecutiveExcel).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(downloadBlob).toHaveBeenLastCalledWith(expect.any(Blob), expect.stringMatching(/\.xlsx$/)),
    );
  });

  it('hides export actions without reports.export and keeps filters usable', () => {
    renderReportes(['reports.managerial.view']);

    expect(screen.queryByRole('button', { name: /exportar pdf/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /exportar excel/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aplicar/i })).toBeInTheDocument();
  });

  it('paints filters and actions with admin identity instead of R2 primary teal', () => {
    renderReportes();

    const apply = screen.getByRole('button', { name: /aplicar/i });
    // Relleno de acción + etiqueta dark-AA (§1.3 regla 2: nunca text-white).
    // Prefijo sin `)`: válido con o sin fallback hex en el puente de tokens.
    expect(apply.className).toContain('bg-[var(--ui-action');
    expect(apply.className).toContain('text-[color:var(--ui-action-foreground');
    expect(apply.className).not.toContain('bg-primary');
    expect(apply.className).not.toContain('text-white');

    const exportPdf = screen.getByRole('button', { name: /exportar pdf/i });
    // Dark (§1.1): el límite de la acción secundaria es un límite de control;
    // `--ui-line-strong` queda reservado a estructura no interactiva.
    expect(exportPdf.className).toContain('border-[var(--ui-control-border');
    expect(exportPdf.className).not.toContain('--ui-line-strong');
    expect(exportPdf.className).not.toContain('bg-primary');
    expect(exportPdf.className).not.toContain('bg-background');
    // Acciones de exportación con icono contextual (PDF/Excel distinguibles).
    expect(exportPdf.querySelector('svg.lucide-file-down')).not.toBeNull();

    const desde = screen.getByLabelText(/^desde$/i);
    expect(desde.className).toContain('h-[var(--ui-control-h)');
    expect(desde.className).toContain('border-[var(--ui-control-border');
    expect(desde.className).not.toContain('border-input');
    expect(desde.className).not.toContain('ring-ring');

    // El período es un control segmentado, no un select.
    const esteMes = screen.getByRole('button', { name: 'Este mes' });
    expect(esteMes).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByLabelText(/periodo rápido/i)).not.toBeInTheDocument();

    // Los filtros secundarios están plegados por defecto (período y rango
    // siempre visibles). Se abren desde el control «Filtros».
    expect(screen.queryByLabelText(/método de cobro/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^filtros/i }));

    const metodo = screen.getByLabelText(/método de cobro/i);
    expect(metodo.tagName).toBe('SELECT');
    expect(metodo.className).toContain('border-[var(--ui-control-border');
    expect(metodo.className).not.toContain('border-input');
  });

  it('pinta el badge de gratuidad con el tinte cobalto de la identidad dark', () => {
    renderReportes();

    fireEvent.click(screen.getByRole('tab', { name: /^Detalle \(/ }));

    const badge = screen.getByText(/Receta de diálisis/i).closest('[data-ui-free-badge]');
    expect(badge).not.toBeNull();
    // Dark (§2): la gratuidad es cobalto translúcido con etiqueta textual;
    // el violeta de la identidad anterior y el gris neutro quedan retirados.
    // Prefijos sin `)`: válidos con o sin fallback hex del puente.
    expect(badge?.className).toContain('bg-[var(--ui-action-subtle');
    expect(badge?.className).toContain('border-[color:var(--ui-action-border');
    expect(badge?.className).not.toContain('var(--ui-surface-alt)');
  });

  it('abre el plegado de filtros con el énfasis cobalto de la identidad dark', () => {
    renderReportes();

    const toggle = screen.getByRole('button', { name: /^filtros/i });
    fireEvent.click(toggle);

    // Estado abierto = selección (§1.3 regla 4): tinte translúcido 14 % con
    // borde 36 %; sin `--ui-line-strong`, reservado a estructura decorativa.
    expect(toggle.className).toContain('bg-[var(--ui-action-subtle');
    expect(toggle.className).toContain('border-[var(--ui-action-border');
    expect(screen.getByLabelText(/método de cobro/i)).toBeEnabled();

    // El contador de filtros activos leyese sobre la variante fuerte del tinte,
    // distinguible del fondo del propio estado abierto.
    fireEvent.change(screen.getByLabelText(/método de cobro/i), { target: { value: 'cash' } });
    const badge = within(toggle).getByText('1');
    expect(badge.className).toContain('--ui-action-subtle-strong');
  });

  it('sellos de estado de operaciones siguen los semánticos dark', () => {
    const base = buildReporteEjecutivo();
    useReporteEjecutivoMock.mockReturnValue({
      data: buildReporteEjecutivo({
        operations: [
          ...base.operations,
          {
            ...base.operations[0],
            invoice_number: '000-001-01-00000131',
            patient: 'Ana Carrasco',
            status: 'void',
            status_label: 'Anulada',
            settlement: 'void',
            settlement_label: 'Anulada',
          },
        ],
      }),
      dataUpdatedAt: 1,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
      error: null,
    });

    renderReportes();

    // Pagada = éxito del cobro (§2): fondo success translúcido + borde + texto
    // del tono; la etiqueta textual acompaña (nunca solo color).
    const pagada = screen.getByText('Pagada', { selector: '[data-ui-status]' });
    expect(pagada.getAttribute('data-ui-status')).toBe('cobrado');
    expect(pagada.className).toContain('--ui-success-subtle');
    expect(pagada.className).toContain('--ui-success-border');

    // Pendiente de cobro = neutro (§5 «cero legítimo»): surface-alt + tinta;
    // warn se reserva para diferencia de caja, no para un saldo esperado.
    const pendiente = screen.getByText('Pendiente de cobro', { selector: '[data-ui-status]' });
    expect(pendiente.getAttribute('data-ui-status')).toBe('valorada');
    expect(pendiente.className).toContain('--ui-surface-alt');
    expect(pendiente.className).not.toContain('--ui-warn');

    // Anulada = danger (§2: error/anulación).
    const anulada = screen.getByText('Anulada', { selector: '[data-ui-status]' });
    expect(anulada.getAttribute('data-ui-status')).toBe('anulado');
    expect(anulada.className).toContain('--ui-danger-subtle');
    expect(anulada.className).toContain('--ui-danger-border');
  });

  it('pliega los filtros secundarios y muestra cuántos están activos', () => {
    renderReportes();

    const toggle = screen.getByRole('button', { name: /^filtros/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.change(screen.getByLabelText(/método de cobro/i), { target: { value: 'cash' } });
    expect(screen.getByRole('button', { name: /^filtros/i })).toHaveTextContent('1');
  });

  it('distinguishes a failed cash options query and recovers it without hiding the report', async () => {
    getCashSessions.mockRejectedValueOnce(new Error('backend unavailable'));
    renderReportes();

    fireEvent.click(screen.getByRole('button', { name: /^filtros/i }));

    expect(await screen.findByText(/cajeros y cajas no disponibles/i)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Resumen del período' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^cajero$/i)).toBeDisabled();
    expect(screen.getByLabelText(/caja o turno/i)).toBeDisabled();
    expect(screen.queryByRole('option', { name: /todos los cajeros/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /exportar pdf/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /^reintentar$/i }));

    await waitFor(() => expect(screen.getByLabelText(/^cajero$/i)).toBeEnabled());
    expect(screen.getByRole('option', { name: /todos los cajeros/i })).toBeInTheDocument();
    expect(screen.queryByText(/cajeros y cajas no disponibles/i)).not.toBeInTheDocument();
  });

  it('shows a legitimate empty category list without presenting it as an error', () => {
    useCategoriesMock.mockReturnValue({
      data: [],
      isError: false,
      isPending: false,
      refetch: vi.fn(),
    });
    renderReportes();

    fireEvent.click(screen.getByRole('button', { name: /^filtros/i }));

    expect(screen.getByText(/no hay categorías activas disponibles para filtrar/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^categoría$/i)).toBeDisabled();
    expect(screen.getByRole('option', { name: /sin categorías disponibles/i })).toBeInTheDocument();
    expect(screen.queryByText(/categorías no disponibles/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aplicar/i })).toBeEnabled();
  });

  it('preserves a selected category and blocks applying it while its list is unknown', () => {
    const { rerender } = renderReportes();
    fireEvent.click(screen.getByRole('button', { name: /^filtros/i }));
    fireEvent.change(screen.getByLabelText(/^categoría$/i), { target: { value: '1' } });

    useCategoriesMock.mockReturnValue({
      data: undefined,
      isError: true,
      isPending: false,
      refetch: vi.fn(),
    });
    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/reportes']}>
          <AdminSessionProvider user={user} cashSession={cashSession} cashSessionLoading={false} onStatus={vi.fn()}>
            <ReportesView />
          </AdminSessionProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByLabelText(/^categoría$/i)).toHaveValue('1');
    expect(screen.getByRole('option', { name: /categoría seleccionada · selección conservada/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /#1/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aplicar/i })).toBeDisabled();
    expect(screen.getByText(/vuelva a cargar los filtros antes de aplicar esta selección o exportar/i)).toBeInTheDocument();
  });

  it('applies the edited period to the query', async () => {
    renderReportes();

    // Rango de prueba propio y robusto al calendario (siempre ≤ 92 días):
    // debe seguir valiendo aunque el día de la ejecución cambie el default.
    const recent = computePresetRange('last7');
    fireEvent.change(screen.getByLabelText(/^desde$/i), { target: { value: recent.from } });
    fireEvent.click(screen.getByRole('button', { name: /aplicar/i }));

    await waitFor(() => {
      const lastCall = useReporteEjecutivoMock.mock.calls.at(-1);
      expect(lastCall?.[0]).toMatchObject({ date_from: recent.from });
    });
  });

  it('aplica el período elegido desde el control segmentado', async () => {
    renderReportes();
    const previousMonth = computePresetRange('lastMonth');

    fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
    fireEvent.click(screen.getByRole('button', { name: /aplicar/i }));

    await waitFor(() => {
      const lastCall = useReporteEjecutivoMock.mock.calls.at(-1);
      expect(lastCall?.[0]).toMatchObject({ date_from: previousMonth.from, date_to: previousMonth.to });
    });
  });

  it('scopes a cash-session viewer to their own session', async () => {
    renderReportes(['reports.cash_session.view', 'reports.export']);

    await waitFor(() => {
      const firstCall = useReporteEjecutivoMock.mock.calls[0];
      expect(firstCall?.[0]).toMatchObject({ cash_session_id: 42 });
    });
    expect(screen.queryByLabelText(/^cajero$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^filtros$/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /^filtros$/i })).not.toHaveTextContent('1');
  });

  it('keeps the Reportes heading and scope context when a cashier has no open session', () => {
    renderReportes(['reports.cash_session.view', 'reports.export'], null);

    expect(screen.getByRole('heading', { level: 1, name: 'Reportes' })).toBeInTheDocument();
    expect(screen.getByText(/sin caja activa/i)).toBeInTheDocument();
    expect(screen.getByTestId('reporte-scope')).toHaveTextContent('Solo su caja');
    expect(screen.queryByRole('button', { name: /exportar/i })).not.toBeInTheDocument();
  });

  it('shows the empty state when all tables are empty', () => {
    useReporteEjecutivoMock.mockReturnValue({
      data: buildReporteEjecutivo({
        summary: {
          ...buildReporteEjecutivo().summary,
          invoice_count: 0,
          receipt_count: 0,
          without_charge_count: 0,
          gratuity_item_count: 0,
        },
        operations: [],
        detail: [],
        collections: [],
        cash_sessions: [],
        gratuities: [],
      }),
      dataUpdatedAt: 1,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
      error: null,
    });

    renderReportes();
    expect(screen.getByText(/sin datos en el rango/i)).toBeInTheDocument();
  });
});
