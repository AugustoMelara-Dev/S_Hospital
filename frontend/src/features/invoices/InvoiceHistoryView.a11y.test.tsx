import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'vitest-axe';
import type { ReactNode } from 'react';
import { InvoiceHistoryView } from './InvoiceHistoryView';
import { apiClient, type AuthUser, type Invoice } from '../../lib/api';

function withQueryClient(node: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('InvoiceHistoryView accessibility', () => {
  it('has no axe-core violations on the view', async () => {
    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [
        {
          id: 1,
          invoice_number: '000-001-01-00000001',
          patient_name: 'Paciente Historial',
          subtotal: '100.00',
          tax_amount: '15.00',
          discount_amount: '0.00',
          total: '115.00',
          paid_amount: '115.00',
          balance_due: '0.00',
          status: 'paid',
          issued_at: '2026-06-01T12:00:00.000000Z',
          items: [],
          issuer: { id: 1, name: 'Admin Hospital', username: 'admin' },
        },
      ] satisfies Invoice[],
      meta: { current_page: 1, per_page: 10, total: 1 },
    });

    const { container } = withQueryClient(
      <InvoiceHistoryView user={adminUser()} onStatus={vi.fn()} />,
    );

    await waitFor(() => {
      expect(container.textContent).toContain('Paciente Historial');
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});

function adminUser(): AuthUser {
  return {
    id: 1,
    name: 'Admin Hospital',
    email: 'admin@hospital-san-isidro.local',
    username: 'admin',
    active: true,
    roles: ['admin'],
    permissions: ['receipts.view', 'receipts.reprint', 'receipts.reprint_any', 'invoices.void'],
    must_change_password: false,
  };
}
