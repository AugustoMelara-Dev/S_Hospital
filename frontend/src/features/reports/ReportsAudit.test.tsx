import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportsAudit } from './ReportsAudit';
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

function renderView(props: Partial<React.ComponentProps<typeof ReportsAudit>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ReportsAudit
        canExport={true}
        canViewExecutiveSummary={true}
        canViewManagerial={true}
        onStatus={vi.fn()}
        {...props}
      />
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

  it('locks audit filters while audit logs are loading', async () => {
    getAuditLogsMock.mockReturnValue(new Promise(() => undefined));

    renderView();

    expect(await screen.findByText(/cargando bitacora de auditoria/i)).toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText(/^desde$/i), { target: { value: '2026-07-10' } });
    fireEvent.change(screen.getByLabelText(/^hasta$/i), { target: { value: '2026-07-01' } });
    fireEvent.click(screen.getByRole('button', { name: /buscar/i }));

    expect(getAuditLogsMock).not.toHaveBeenCalled();
    expect(screen.getByText(/fecha de inicio debe ser anterior o igual/i)).toBeInTheDocument();
  });

  it('fetches audit logs and renders the entries when the API returns data', async () => {
    getAuditLogsMock.mockResolvedValue(oneEntryAuditPage);

    renderView();
    fireEvent.click(screen.getByRole('button', { name: /buscar/i }));

    await waitFor(() => {
      expect(screen.getByText(/invoices void/i)).toBeInTheDocument();
    });
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
