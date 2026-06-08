import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { InvoiceHistoryView } from './InvoiceHistoryView';
import { apiClient, type AuthUser, type Invoice, type ReceiptData } from '../../lib/api';

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
          balance_due: 'no-número',
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
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|no-número|undefined/);
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

  it('opens receipt history with institutional copy instead of preview wording', async () => {
    const invoice = historyInvoice({
      id: 12,
      invoice_number: '000-001-01-00000012',
      patient_name: 'Paciente Recibo',
      status: 'paid',
      paid_amount: '100.00',
      balance_due: '0.00',
      issuer: { id: 1, name: 'Admin Hospital', username: 'admin' },
    });

    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [invoice],
      meta: { current_page: 1, per_page: 10, total: 1 },
    });
    vi.spyOn(apiClient, 'getInvoice').mockResolvedValue(invoice);
    vi.spyOn(apiClient, 'getReceipt').mockResolvedValue(receiptForInvoice(invoice));

    renderWithQueryClient(<InvoiceHistoryView user={adminUser()} onStatus={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Paciente Recibo')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /ver recibo/i }));

    expect(await screen.findByText(/recibo institucional listo para revisar/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tamano del recibo institucional/i)).toBeInTheDocument();
    expect(screen.queryByText(/vista previa de recibo institucional/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/tamano de vista previa/i)).not.toBeInTheDocument();
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

function historyInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1,
    invoice_number: '000-001-01-00000001',
    patient_name: 'Paciente Historial',
    subtotal: '100.00',
    tax_amount: '0.00',
    discount_amount: '0.00',
    total: '100.00',
    paid_amount: '0.00',
    balance_due: '100.00',
    status: 'issued',
    issued_at: '2026-06-01T12:00:00.000000Z',
    items: [],
    ...overrides,
  };
}

function receiptForInvoice(invoice: Invoice): ReceiptData {
  return {
    width: 'half_letter',
    hospital: {
      name: 'Hospital San Isidro',
      rtn: null,
      address: 'Tocoa, Colon',
      slogan: null,
    },
    institutional: {
      template_mode: 'institutional',
      paper_size: 'half_letter',
      government_line: 'Gobierno de Honduras',
      secretariat_line: 'Secretaria de Salud',
      location: 'Tocoa, Colon',
      footer_text: null,
      copy_label: 'Original / Copia',
      signature_label: 'Firma y sello del receptor de fondos',
    },
    fiscal: {
      cai: null,
      authorized_range: null,
      valid_until: null,
    },
    invoice: {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      patient_name: invoice.patient_name,
      subtotal: invoice.subtotal,
      tax_amount: invoice.tax_amount,
      discount_amount: invoice.discount_amount,
      total: invoice.total,
      paid_amount: invoice.paid_amount,
      balance_due: invoice.balance_due,
      status: invoice.status,
      issued_at: invoice.issued_at,
      cashier: 'Admin Hospital',
      tax_label: 'ISV',
      tax_rate: '0.00',
      total_in_words: 'CIEN LEMPIRAS EXACTOS',
    },
    items: [
      {
        service_name: 'Consulta',
        category_name: 'Consulta externa',
        quantity: '1',
        unit_price: '100.00',
        tax_amount: '0.00',
        line_total: '100.00',
        notes: null,
      },
    ],
    payments: [
      {
        id: 1,
        method: 'cash',
        amount: '100.00',
        reference: null,
        paid_at: '2026-06-01T12:10:00.000000Z',
        cashier: 'Admin Hospital',
      },
    ],
  };
}
