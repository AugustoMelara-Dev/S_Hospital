import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportsAudit } from './ReportsAudit';
import type { AuditLogPage } from '@/lib/api/types';

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

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
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
      <ReportsAudit canExport={true} canViewManagerial={true} onStatus={vi.fn()} {...props} />
    </QueryClientProvider>,
  );
}

describe('ReportsAudit', () => {
  beforeEach(() => {
    getAuditLogsMock.mockReset();
    getAuditLogsMock.mockResolvedValue(emptyAuditPage);
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

  it('renders the access denied message when the user lacks managerial permission', () => {
    renderView({ canViewManagerial: false });
    expect(screen.getByText(/sin permisos para auditor/i)).toBeInTheDocument();
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
});