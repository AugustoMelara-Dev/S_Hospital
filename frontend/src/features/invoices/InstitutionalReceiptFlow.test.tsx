import { type ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { InvoiceHistoryView } from './InvoiceHistoryView';
import { apiClient, type AuthUser, type Invoice, type ReceiptData } from '../../lib/api';
import { openBlobInNewTab } from '../../lib/download';

vi.mock('../../lib/download', () => ({
  openBlobInNewTab: vi.fn(),
}));

describe('InstitutionalReceiptFlow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the institutional receipt PDF from history when available', async () => {
    const invoice = invoiceFixture({
      id: 10,
      invoice_number: '000-001-01-00000010',
      patient_name: 'Paciente Institucional',
      status: 'paid',
      institutional_receipt: {
        id: 501,
        receipt_number_full: 'REC-A-00000501',
        status: 'issued',
        issued_at: '2026-06-01T12:05:00.000000Z',
        reprint_count: 0,
      },
    });
    const getReceipt = vi.spyOn(apiClient, 'getReceipt');
    const getPdf = vi.spyOn(apiClient, 'getInstitutionalReceiptPdf')
      .mockResolvedValue(new Blob(['%PDF-institutional'], { type: 'application/pdf' }));

    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [invoice],
      meta: { current_page: 1, per_page: 10, total: 1 },
    });
    vi.spyOn(apiClient, 'getInvoice').mockResolvedValue(invoice);

    renderWithQueryClient(<InvoiceHistoryView user={adminUser()} onStatus={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Paciente Institucional')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /ver recibo/i }));

    await waitFor(() => expect(getPdf).toHaveBeenCalledWith(501, 'Consulta desde historial de facturas.'));
    expect(openBlobInNewTab).toHaveBeenCalledWith(expect.any(Blob), 'recibo-institucional-REC-A-00000501.pdf');
    expect(getReceipt).not.toHaveBeenCalled();
  });

  it('falls back to legacy receipt preview for old invoices without institutional receipt', async () => {
    const invoice = invoiceFixture({
      id: 11,
      invoice_number: '000-001-01-00000011',
      patient_name: 'Paciente Legacy',
      status: 'paid',
      institutional_receipt: null,
    });
    const getPdf = vi.spyOn(apiClient, 'getInstitutionalReceiptPdf');

    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [invoice],
      meta: { current_page: 1, per_page: 10, total: 1 },
    });
    vi.spyOn(apiClient, 'getInvoice').mockResolvedValue(invoice);
    vi.spyOn(apiClient, 'getReceipt').mockResolvedValue(receiptFixture(invoice));

    renderWithQueryClient(<InvoiceHistoryView user={adminUser()} onStatus={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Paciente Legacy')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /ver recibo/i }));

    await waitFor(() => expect(apiClient.getReceipt).toHaveBeenCalledWith(11, 'half_letter'));
    expect(getPdf).not.toHaveBeenCalled();
  });
});

function renderWithQueryClient(node: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

function invoiceFixture(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 10,
    invoice_number: '000-001-01-00000010',
    patient_name: 'Paciente',
    subtotal: '15.00',
    tax_amount: '2.25',
    discount_amount: '0.00',
    total: '17.25',
    paid_amount: '17.25',
    balance_due: '0.00',
    status: 'paid',
    issued_at: '2026-06-01T12:00:00.000000Z',
    items: [],
    ...overrides,
  };
}

function receiptFixture(invoice: Invoice): ReceiptData {
  return {
    width: 'half_letter',
    hospital: {
      name: 'Hospital San Isidro',
      rtn: null,
      address: 'Tocoa',
      slogan: null,
    },
    institutional: {
      template_mode: 'institutional',
      paper_size: 'half_letter',
      government_line: 'Gobierno de Honduras',
      secretariat_line: 'Secretaria de Salud',
      location: 'Tocoa, Colon',
      footer_text: 'Original: Oficina Recaudadora',
      copy_label: 'ORIGINAL',
      signature_label: 'Firma del enterante',
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
      tax_rate: '15.00',
    },
    items: [],
    payments: [],
  };
}

function adminUser(): AuthUser {
  return {
    id: 1,
    name: 'Admin Hospital',
    email: 'admin@hospital-san-isidro.local',
    username: 'admin',
    active: true,
    roles: ['admin'],
    permissions: ['receipts.view', 'receipts.reprint', 'receipts.reprint_any', 'invoices.void', 'invoices.reverse'],
    must_change_password: false,
  };
}
