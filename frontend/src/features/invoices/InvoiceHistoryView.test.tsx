import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { InvoiceHistoryView } from './InvoiceHistoryView';
import { apiClient, type AuthUser, type Invoice } from '../../lib/api';

function renderWithQueryClient(node: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('InvoiceHistoryView', () => {
  it('renders malformed invoice history amounts as safe financial values', async () => {
    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [
        {
          id: 1,
          invoice_number: '000-001-01-00000001',
          patient_name: 'Paciente Historial',
          subtotal: 'monto-danado',
          tax_amount: 'NaN',
          discount_amount: '0.00',
          total: 'monto-danado',
          paid_amount: 'NaN',
          balance_due: 'no-numero',
          status: 'partial',
          issued_at: '2026-06-01T12:00:00.000000Z',
          items: [],
        },
      ] satisfies Invoice[],
      meta: { current_page: 1, per_page: 10, total: 1 },
    });

    renderWithQueryClient(<InvoiceHistoryView user={adminUser()} onStatus={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Paciente Historial')).toBeInTheDocument());

    expect(document.body.textContent).toContain('L. 0.00');
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|no-numero|undefined/);
  });

  it('closes the invoice actions menu through an accessible control', async () => {
    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [
        {
          id: 7,
          invoice_number: '000-001-01-00000007',
          patient_name: 'Paciente Accesible',
          subtotal: '100.00',
          tax_amount: '0.00',
          discount_amount: '0.00',
          total: '100.00',
          paid_amount: '0.00',
          balance_due: '100.00',
          status: 'issued',
          issued_at: '2026-06-01T12:00:00.000000Z',
          items: [],
        },
      ] satisfies Invoice[],
      meta: { current_page: 1, per_page: 10, total: 1 },
    });

    renderWithQueryClient(<InvoiceHistoryView user={adminUser()} onStatus={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Paciente Accesible')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText(/ver acciones de factura 000-001-01-00000007/i));

    expect(screen.getByRole('button', { name: /anular/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cerrar menu de acciones/i }));

    expect(screen.queryByRole('button', { name: /anular/i })).not.toBeInTheDocument();
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
