import { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InvoiceHistoryView } from './InvoiceHistoryView';
import { apiClient, type AuthUser, type Invoice } from '../../lib/api';
import { openBlobInNewTab } from '../../lib/download';

vi.mock('../../lib/download', () => ({
  openBlobInNewTab: vi.fn(),
}));

function renderWithQueryClient(node: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('InvoiceHistoryView', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

    expect(screen.getByRole('combobox', { name: /estado de factura/i })).toBeInTheDocument();
    expect(document.body.textContent).toContain('L. 0.00');
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|no-numero|undefined/);
  });

  it('opens void confirmation only for the latest loaded invoice detail', async () => {
    const first = invoiceFixture({ id: 1, invoice_number: '000-001-01-00000001', patient_name: 'Paciente Lento' });
    const second = invoiceFixture({ id: 2, invoice_number: '000-001-01-00000002', patient_name: 'Paciente Correcto' });
    let resolveFirst!: (invoice: Invoice) => void;
    let resolveSecond!: (invoice: Invoice) => void;

    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [first, second],
      meta: { current_page: 1, per_page: 10, total: 2 },
    });
    vi.spyOn(apiClient, 'getInvoice')
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveSecond = resolve; }));

    renderWithQueryClient(<InvoiceHistoryView user={adminUser()} onStatus={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Paciente Lento')).toBeInTheDocument());
    const voidButtons = screen.getAllByRole('button', { name: /anular/i });

    fireEvent.click(voidButtons[0]);
    fireEvent.click(voidButtons[1]);

    expect(screen.queryByText('¿Anular factura 000-001-01-00000001?')).not.toBeInTheDocument();

    await act(async () => {
      resolveSecond(second);
    });

    await waitFor(() => expect(screen.getByText('¿Anular factura 000-001-01-00000002?')).toBeInTheDocument());

    await act(async () => {
      resolveFirst(first);
    });

    expect(screen.getByText('¿Anular factura 000-001-01-00000002?')).toBeInTheDocument();
    expect(screen.queryByText('¿Anular factura 000-001-01-00000001?')).not.toBeInTheDocument();
  });

  it('exposes paid invoice reverse flow with reason', async () => {
    const paid = invoiceFixture({
      id: 3,
      invoice_number: '000-001-01-00000003',
      patient_name: 'Paciente Pagado',
      status: 'paid',
      paid_amount: '17.25',
      balance_due: '0.00',
    });
    const reverseInvoice = vi.spyOn(apiClient, 'reverseInvoice').mockResolvedValue({ ...paid, status: 'void' });

    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [paid],
      meta: { current_page: 1, per_page: 10, total: 1 },
    });
    vi.spyOn(apiClient, 'getInvoice').mockResolvedValue(paid);

    renderWithQueryClient(<InvoiceHistoryView user={adminUser()} onStatus={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Paciente Pagado')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /reversar/i }));

    await waitFor(() => expect(screen.getByText('¿Reversar factura 000-001-01-00000003?')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/motivo de reversa/i), {
      target: { value: 'Pago aplicado a factura equivocada' },
    });
    fireEvent.click(screen.getByRole('button', { name: /reversar factura/i }));

    await waitFor(() => expect(reverseInvoice).toHaveBeenCalledWith(3, 'Pago aplicado a factura equivocada'));
  });

  it('opens institutional receipt pdf from history when the invoice has one', async () => {
    const paid = invoiceFixture({
      id: 4,
      invoice_number: '000-001-01-00000004',
      patient_name: 'Paciente Recibo Institucional',
      status: 'paid',
      institutional_receipt: institutionalReceiptFixture({ id: 90, receipt_number_full: 'REC-A-00000090' }),
    });
    const getReceipt = vi.spyOn(apiClient, 'getReceipt');
    const registerPrint = vi.spyOn(apiClient, 'registerInstitutionalReceiptPrintEvent');
    const getPdf = vi.spyOn(apiClient, 'getInstitutionalReceiptPdf')
      .mockResolvedValue(new Blob(['%PDF-institutional'], { type: 'application/pdf' }));

    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [paid],
      meta: { current_page: 1, per_page: 10, total: 1 },
    });
    vi.spyOn(apiClient, 'getInvoice').mockResolvedValue(paid);

    renderWithQueryClient(<InvoiceHistoryView user={adminUser()} onStatus={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Paciente Recibo Institucional')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /ver recibo/i }));

    await waitFor(() => expect(getPdf).toHaveBeenCalledWith(90));
    expect(openBlobInNewTab).toHaveBeenCalledWith(
      expect.any(Blob),
      'recibo-institucional-REC-A-00000090.pdf',
    );
    expect(registerPrint).not.toHaveBeenCalled();
    expect(getReceipt).not.toHaveBeenCalled();
  });

  it('reprints institutional receipt from history before falling back to legacy receipt', async () => {
    const paid = invoiceFixture({
      id: 5,
      invoice_number: '000-001-01-00000005',
      patient_name: 'Paciente Reimpresion Institucional',
      status: 'paid',
      institutional_receipt: institutionalReceiptFixture({ id: 91, receipt_number_full: 'REC-A-00000091' }),
    });
    const reprintInvoice = vi.spyOn(apiClient, 'reprintInvoice');
    const registerPrint = vi.spyOn(apiClient, 'registerInstitutionalReceiptPrintEvent')
      .mockResolvedValue({} as never);
    const getPdf = vi.spyOn(apiClient, 'getInstitutionalReceiptPdf')
      .mockResolvedValue(new Blob(['%PDF-reprint'], { type: 'application/pdf' }));

    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [paid],
      meta: { current_page: 1, per_page: 10, total: 1 },
    });
    vi.spyOn(apiClient, 'getInvoice').mockResolvedValue(paid);

    renderWithQueryClient(<InvoiceHistoryView user={adminUser()} onStatus={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Paciente Reimpresion Institucional')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /reimprimir/i }));
    fireEvent.change(screen.getByLabelText(/motivo opcional/i), {
      target: { value: 'Copia solicitada por el paciente' },
    });
    fireEvent.click(screen.getByRole('button', { name: /registrar reimpresi/i }));

    await waitFor(() => expect(registerPrint).toHaveBeenCalledWith(91, 'Copia solicitada por el paciente'));
    expect(getPdf).toHaveBeenCalledWith(91);
    expect(openBlobInNewTab).toHaveBeenCalledWith(
      expect.any(Blob),
      'recibo-institucional-REC-A-00000091.pdf',
    );
    expect(reprintInvoice).not.toHaveBeenCalled();
  });

  it('keeps legacy receipt preview fallback when invoice has no institutional receipt', async () => {
    const paid = invoiceFixture({
      id: 6,
      invoice_number: '000-001-01-00000006',
      patient_name: 'Paciente Legacy',
      status: 'paid',
      institutional_receipt: null,
    });
    const receipt = receiptFixture(paid);
    const getPdf = vi.spyOn(apiClient, 'getInstitutionalReceiptPdf');

    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [paid],
      meta: { current_page: 1, per_page: 10, total: 1 },
    });
    vi.spyOn(apiClient, 'getInvoice').mockResolvedValue(paid);
    vi.spyOn(apiClient, 'getReceipt').mockResolvedValue(receipt);

    renderWithQueryClient(<InvoiceHistoryView user={adminUser()} onStatus={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Paciente Legacy')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /ver recibo/i }));

    await waitFor(() => expect(screen.getByText(/fallback legacy para facturas sin recibo institucional pdf/i)).toBeInTheDocument());
    expect(apiClient.getReceipt).toHaveBeenCalledWith(6, 'half_letter');
    expect(getPdf).not.toHaveBeenCalled();
  });
});

function invoiceFixture(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1,
    invoice_number: '000-001-01-00000001',
    patient_name: 'Paciente Historial',
    subtotal: '15.00',
    tax_amount: '2.25',
    discount_amount: '0.00',
    total: '17.25',
    paid_amount: '0.00',
    balance_due: '17.25',
    status: 'issued',
    issued_at: '2026-06-01T12:00:00.000000Z',
    items: [],
    ...overrides,
  };
}

function institutionalReceiptFixture(
  overrides: Partial<NonNullable<Invoice['institutional_receipt']>> = {},
): NonNullable<Invoice['institutional_receipt']> {
  return {
    id: 90,
    receipt_number_full: 'REC-A-00000090',
    status: 'issued',
    issued_at: '2026-06-01T12:05:00.000000Z',
    reprint_count: 0,
    ...overrides,
  };
}

function receiptFixture(invoice: Invoice) {
  return {
    width: 'half_letter' as const,
    hospital: {
      name: 'Hospital San Isidro',
      rtn: null,
      address: 'Tocoa',
      slogan: null,
    },
    institutional: {
      template_mode: 'institutional',
      paper_size: 'half_letter' as const,
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
