import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportsAudit } from './ReportsAudit';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import type { AuditLogPage, OperationsReport } from '@/lib/api/types';

const emptyAuditPage: AuditLogPage = {
  data: [],
  meta: { current_page: 1, per_page: 25, total: 0 },
};

const oneEntryAuditPage: AuditLogPage = {
  data: [
    {
      id: 1,
      action: 'invoices.void',
      result: 'success',
      reason: 'error operativo',
      entity_type: 'App\\Models\\Invoice',
      entity_id: 77,
      ip: '192.168.1.24',
      created_at: '2026-06-30T15:00:00.000000Z',
      user: { id: 1, name: 'Cajero Demo', username: 'cajero' },
    },
  ],
  meta: { current_page: 1, per_page: 25, total: 1 },
};

const getAuditLogsMock = vi.fn<(filters?: Record<string, unknown>) => Promise<AuditLogPage>>();
const getExecutiveReportMock = vi.fn();
const getOperationsReportMock = vi.fn<(filters: Record<string, unknown>) => Promise<OperationsReport>>();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getExecutiveReport: (filters: Record<string, unknown>) => getExecutiveReportMock(filters),
      getOperationsReport: (filters: Record<string, unknown>) => getOperationsReportMock(filters),
    },
    system: {
      ...actual.system,
      getAuditLogs: (filters: Record<string, unknown> = {}) => getAuditLogsMock(filters),
    },
  };
});

function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output aria-label="url actual">{location.pathname}{location.search}</output>
      <button type="button" onClick={() => navigate(-1)}>Volver filtros</button>
    </>
  );
}

function renderView(
  props: Partial<React.ComponentProps<typeof ReportsAudit>> = {},
  initialEntry = '/reports/audit',
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <ReportsAudit
          canExport={true}
          canViewExecutiveSummary={true}
          canViewManagerial={true}
          onStatus={vi.fn()}
          {...props}
        />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReportsAudit', () => {
  beforeEach(() => {
    getAuditLogsMock.mockReset();
    getAuditLogsMock.mockResolvedValue(emptyAuditPage);
    getExecutiveReportMock.mockReset();
    getExecutiveReportMock.mockRejectedValue(new Error('empty executive report'));
    getOperationsReportMock.mockReset();
    getOperationsReportMock.mockRejectedValue(new Error('empty operations report'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the audit log search form with all filters', () => {
    renderView();
    expect(screen.getByLabelText(/^acción$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^desde$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^hasta$/i)).toBeInTheDocument();
  });

  it('restores audit filters from the URL and keeps the applied scope there', async () => {
    renderView({}, '/reports/audit?action=anulacion&from=2026-07-01&to=2026-07-10&page=2');

    expect(screen.getByLabelText(/^acci.n$/i)).toHaveValue('anulacion');
    expect(screen.getByLabelText(/^desde$/i)).toHaveValue('2026-07-01');
    expect(screen.getByLabelText(/^hasta$/i)).toHaveValue('2026-07-10');
    await waitFor(() => {
      expect(getAuditLogsMock).toHaveBeenCalledWith(expect.objectContaining({
        action: 'invoice.voided',
        from: '2026-07-01',
        to: '2026-07-10',
        page: 2,
      }));
    });
    expect(screen.getByLabelText(/url actual/i)).toHaveTextContent(
      '/reports/audit?action=anulacion&from=2026-07-01&to=2026-07-10&page=2',
    );
    expect(screen.getByRole('region', { name: /alcance del reporte de auditoria/i })).toHaveTextContent(
      /1 de julio de 2026.*10 de julio de 2026/i,
    );
    expect(screen.getByRole('region', { name: /alcance del reporte de auditoria/i })).toHaveTextContent(
      'Bitácora filtrada por “anulacion”',
    );
    expect(document.body.textContent).not.toMatch(/Ã|Â|â€œ|â€|�/);
  });

  it('creates navigable history when audit filters are applied from the UI', async () => {
    renderView({}, '/reports/audit?from=2026-07-01&to=2026-07-10');

    await waitFor(() => expect(screen.getByRole('button', { name: /buscar/i })).toBeEnabled());
    fireEvent.change(screen.getByLabelText(/^acci.n$/i), { target: { value: 'anulacion' } });
    fireEvent.click(screen.getByRole('button', { name: /buscar/i }));
    await waitFor(() => expect(screen.getByLabelText(/url actual/i)).toHaveTextContent('action=anulacion'));

    await waitFor(() => expect(screen.getByRole('button', { name: /buscar/i })).toBeEnabled());
    fireEvent.change(screen.getByLabelText(/^acci.n$/i), { target: { value: 'reimpresion' } });
    fireEvent.click(screen.getByRole('button', { name: /buscar/i }));
    await waitFor(() => expect(screen.getByLabelText(/url actual/i)).toHaveTextContent('action=reimpresion'));

    fireEvent.click(screen.getByRole('button', { name: /volver filtros/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/^acci.n$/i)).toHaveValue('anulacion');
      expect(screen.getByLabelText(/url actual/i)).toHaveTextContent('action=anulacion');
      expect(getAuditLogsMock).toHaveBeenCalledWith(expect.objectContaining({ action: 'invoice.voided' }));
    });
  });

  it('does not request audit data for an invalid URL date range', () => {
    renderView({}, '/reports/audit?from=2026-07-10&to=2026-07-01');

    expect(getAuditLogsMock).not.toHaveBeenCalled();
    expect(screen.getByText(/fecha de inicio debe ser anterior o igual/i)).toBeInTheDocument();
  });

  it('does not request audit data for nonexistent calendar dates', () => {
    renderView({}, '/reports/audit?from=2026-02-31&to=2026-03-02');

    expect(getAuditLogsMock).not.toHaveBeenCalled();
    expect(screen.getByText(/seleccione fechas validas/i)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /alcance del reporte de auditoria/i })).not.toBeInTheDocument();
  });

  it('locks audit filters while audit logs are loading', async () => {
    getAuditLogsMock.mockReturnValue(new Promise(() => undefined));

    renderView();

    expect(await screen.findByRole('status', { name: /cargando bit.cora de auditor.a/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^acci.n$/i)).toBeDisabled();
    expect(screen.getByLabelText(/^desde$/i)).toBeDisabled();
    expect(screen.getByLabelText(/^hasta$/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /^buscar$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^limpiar$/i })).toBeDisabled();
  });

  it('maps common human action filters to backend audit action codes', async () => {
    renderView();

    await waitFor(() => {
      expect(getAuditLogsMock).toHaveBeenCalledTimes(1);
    });
    getAuditLogsMock.mockClear();

    const actionInput = screen.getByLabelText(/^acci.n$/i);
    expect(actionInput).toHaveAttribute('placeholder', expect.stringMatching(/anulaci/i));
    expect(actionInput).not.toHaveAttribute('placeholder', expect.stringMatching(/fiscal\.update|login/i));

    fireEvent.change(actionInput, { target: { value: 'anulacion' } });
    fireEvent.click(screen.getByRole('button', { name: /buscar/i }));

    await waitFor(() => {
      expect(getAuditLogsMock).toHaveBeenLastCalledWith(expect.objectContaining({
        action: 'invoice.voided',
      }));
    });
  });

  it('renders the access denied message when the user lacks managerial permission', () => {
    renderView({ canViewManagerial: false });
    expect(screen.getByText(/sin permisos para auditor/i)).toBeInTheDocument();
  });

  it('does not fetch the executive summary for audit-only users', async () => {
    renderView({ canViewManagerial: true, canViewExecutiveSummary: false });

    await waitFor(() => {
      expect(getAuditLogsMock).toHaveBeenCalledTimes(1);
    });
    expect(getExecutiveReportMock).not.toHaveBeenCalled();
  });

  it('blocks inverted audit date ranges before requesting logs', async () => {
    renderView();

    await waitFor(() => {
      expect(getAuditLogsMock).toHaveBeenCalledTimes(1);
    });
    getAuditLogsMock.mockClear();

    await selectDate(/^desde$/i, '2026-07-10');
    await selectDate(/^hasta$/i, '2026-07-01');
    await userEvent.setup().click(screen.getByRole('button', { name: /buscar/i }));

    expect(getAuditLogsMock).not.toHaveBeenCalled();
    expect(screen.getByText(/fecha de inicio debe ser anterior o igual/i)).toBeInTheDocument();
  });

  it('fetches audit logs and renders the entries when the API returns data', async () => {
    getAuditLogsMock.mockResolvedValue(oneEntryAuditPage);

    renderView();
    fireEvent.click(screen.getByRole('button', { name: /buscar/i }));

    await waitFor(() => {
      expect(screen.getByText(/factura anulada/i)).toBeInTheDocument();
      expect(screen.getByText('Factura · registro 77')).toBeInTheDocument();
      expect(screen.getByText('192.168.1.24')).toBeInTheDocument();
      expect(screen.getByText('Completado')).toHaveAttribute('data-variant', 'outline');
      expect(document.body.textContent).not.toMatch(/invoices\.void|Cajero Demo \(cajero\)/i);
    });
  });

  it('uses the persisted audit id when otherwise identical events are rendered', async () => {
    const repeatedEntry = oneEntryAuditPage.data[0];
    getAuditLogsMock.mockResolvedValue({
      data: [
        { ...repeatedEntry, id: 101 },
        { ...repeatedEntry, id: 102 },
      ],
      meta: { current_page: 1, per_page: 25, total: 2 },
    });

    renderView();

    await screen.findAllByText(/factura anulada/i);
    const rows = Array.from(document.querySelectorAll('tbody tr'));
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.getAttribute('data-row-id'))).toEqual(['101', '102']);
    expect(screen.getAllByText(/factura anulada/i)).toHaveLength(2);
  });

  it('renders a failed audit result with a human status', async () => {
    getAuditLogsMock.mockResolvedValue({
      data: [{ ...oneEntryAuditPage.data[0], result: 'failed' }],
      meta: oneEntryAuditPage.meta,
    });

    renderView();

    expect(await screen.findByText(/con error/i)).toBeInTheDocument();
    expect(screen.getByText(/con error/i)).toHaveAttribute('data-variant', 'destructive');
    expect(document.body.textContent).not.toMatch(/\bfailed\b/i);
  });

  it('renders an empty state when the API returns no entries', async () => {
    getAuditLogsMock.mockResolvedValue(emptyAuditPage);

    renderView();
    fireEvent.click(screen.getByRole('button', { name: /buscar/i }));

    await waitFor(() => {
      expect(screen.getByText(/no hay entradas/i)).toBeInTheDocument();
    });
  });

  it('renders the operations snapshot without exposing backup internals', async () => {
    getOperationsReportMock.mockResolvedValue({
      date_from: '2026-07-01',
      date_to: '2026-07-31',
      filters: {},
      summary: {
        void_count: 0,
        reprint_count: 2,
        audit_event_count: 2,
        service_change_count: 0,
        payment_void_count: 1,
        backup_count: 1,
        failed_backup_count: 1,
        cashier_count: 0,
      },
      voids: [],
      reprints: [
        {
          invoice_number: '000-001-01-00000044',
          reason: 'Reimpresion para expediente administrativo',
          user: 'Cajero Demo',
          source: 'institutional_receipt',
          created_at: '2026-07-15T10:00:00.000000Z',
        },
        {
          invoice_number: null,
          receipt_number_full: 'REC-A-00000009',
          reason: 'Copia solicitada por caja',
          user: 'Cajero Demo',
          source: 'institutional_receipt',
          created_at: '2026-07-15T10:03:00.000000Z',
        } as never,
      ],
      catalog_changes: [],
      payment_voids: [
        {
          invoice_number: '000-001-01-00000045',
          method: 'cash',
          amount: '17.25',
          reason: 'Cobro registrado por error',
          voided_by: 'Supervisor',
          created_at: '2026-07-15T10:05:00.000000Z',
        },
      ],
      backups: [
        {
          status: 'failed',
          type: 'manual',
          completed_at: '2026-07-15T10:10:00.000000Z',
          filename: 'hospital-backup-technical.sql',
          checksum_sha256: 'sha256-secret-value',
          id: 98765,
        } as never,
      ],
      cashiers: [],
    });

    renderView();

    expect(await screen.findByText(/operaciones del periodo/i)).toBeInTheDocument();
    expect(screen.getByText(/respaldos fallidos/i)).toBeInTheDocument();
    expect(screen.getByText(/pagos anulados/i)).toBeInTheDocument();
    expect(screen.getAllByText('1')).toHaveLength(2);
    expect(screen.getByText(/cobro registrado por error/i)).toBeInTheDocument();
    expect(screen.getByText(/Reimpresion REC-A-00000009/i)).toBeInTheDocument();
    expect(screen.queryByText(/Reimpresion institucional/i)).not.toBeInTheDocument();
    expect(screen.getByText(/respaldo fallido/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/hospital-backup|checksum|sha256|98765/);
  });
});

async function selectDate(label: RegExp, date: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value: date } });
}
