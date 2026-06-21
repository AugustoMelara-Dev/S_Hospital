import { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InvoiceHistoryView } from './InvoiceHistoryView';
import { apiClient, institutionalReceipts, type AuthUser, type InstitutionalReceipt, type Invoice } from '../../lib/api';
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

  it('renders the history screen with an accessible heading, filters, semantic table and balance column', async () => {
    const invoice = invoiceFixture({
      id: 10,
      invoice_number: '000-001-01-00000010',
      patient_name: 'Paciente Accesible',
      total: '120.00',
      paid_amount: '40.00',
      balance_due: '80.00',
      status: 'partial',
    });

    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [invoice],
      meta: { current_page: 1, per_page: 10, total: 1 },
    });

    renderWithQueryClient(<InvoiceHistoryView user={adminUser()} onStatus={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1, name: /historial de facturas/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /estado de factura/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/paciente/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/n.mero de factura/i)).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Paciente Accesible')).toBeInTheDocument());

    expect(screen.getByRole('region', { name: /listado de facturas/i })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /facturas filtradas/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /saldo/i })).toHaveAttribute('data-numeric', 'true');
    expect(screen.getByRole('cell', { name: 'L 80.00' })).toHaveAttribute('data-numeric', 'true');
  });

  it('keeps invoice filters controlled and preserves the same query contract', async () => {
    const getInvoices = vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [],
      meta: { current_page: 1, per_page: 10, total: 0 },
    });

    renderWithQueryClient(<InvoiceHistoryView user={adminUser()} onStatus={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('button', { name: /buscar/i })).toBeEnabled());

    fireEvent.change(screen.getByLabelText(/paciente/i), { target: { value: 'Maria Lopez' } });
    fireEvent.change(screen.getByLabelText(/n.mero de factura/i), { target: { value: '00000022' } });

    await waitFor(() => expect(getInvoices).toHaveBeenLastCalledWith(expect.objectContaining({
      patient: 'Maria Lopez',
      invoice_number: '00000022',
      page: 1,
      per_page: 10,
    })));
  });

  it('does not expose restricted history actions or invented payment actions without permissions', async () => {
    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [
        invoiceFixture({
          id: 11,
          invoice_number: '000-001-01-00000011',
          patient_name: 'Paciente Sin Permisos',
          status: 'paid',
          paid_amount: '17.25',
          balance_due: '0.00',
        }),
      ],
      meta: { current_page: 1, per_page: 10, total: 1 },
    });

    renderWithQueryClient(<InvoiceHistoryView user={limitedUser()} onStatus={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Paciente Sin Permisos')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: /ver recibo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reimprimir/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reversar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /anular/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cobrar|registrar pago/i })).not.toBeInTheDocument();
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
    expect(document.body.textContent).toContain('L 0.00');
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

  it('submits reverse only once while the critical action is in flight', async () => {
    const paid = invoiceFixture({
      id: 35,
      invoice_number: '000-001-01-00000035',
      patient_name: 'Paciente Doble Click',
      status: 'paid',
      paid_amount: '17.25',
      balance_due: '0.00',
    });
    let resolveReverse!: (invoice: Invoice) => void;
    const reverseInvoice = vi.spyOn(apiClient, 'reverseInvoice')
      .mockReturnValue(new Promise((resolve) => { resolveReverse = resolve; }));

    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [paid],
      meta: { current_page: 1, per_page: 10, total: 1 },
    });
    vi.spyOn(apiClient, 'getInvoice').mockResolvedValue(paid);

    renderWithQueryClient(<InvoiceHistoryView user={adminUser()} onStatus={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Paciente Doble Click')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /reversar/i }));
    const reasonInput = await screen.findByLabelText(/motivo de reversa/i);
    fireEvent.change(reasonInput, {
      target: { value: 'Doble click accidental en caja' },
    });

    const confirmButton = screen.getByRole('button', { name: /reversar factura/i });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    expect(reverseInvoice).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveReverse({ ...paid, status: 'void' });
    });
  });

  it('keeps void confirmation open when reason is too short', async () => {
    const invoice = invoiceFixture({
      id: 31,
      invoice_number: '000-001-01-00000031',
      patient_name: 'Paciente Anulacion',
    });
    const onStatus = vi.fn();
    const voidInvoice = vi.spyOn(apiClient, 'voidInvoice');

    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [invoice],
      meta: { current_page: 1, per_page: 10, total: 1 },
    });
    vi.spyOn(apiClient, 'getInvoice').mockResolvedValue(invoice);

    renderWithQueryClient(<InvoiceHistoryView user={adminUser()} onStatus={onStatus} />);

    await waitFor(() => expect(screen.getByText('Paciente Anulacion')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /anular/i }));
    await waitFor(() => expect(screen.getByText(/Anular factura 000-001-01-00000031/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/motivo de anulación/i), { target: { value: 'abc' } });
    const confirmButton = screen.getByRole('button', { name: /anular factura/i });
    expect(confirmButton).toBeDisabled();
    fireEvent.click(confirmButton);

    expect(voidInvoice).not.toHaveBeenCalled();
    expect(onStatus).not.toHaveBeenCalledWith('Ingrese un motivo de anulación de al menos 5 caracteres.');
    expect(screen.getByText(/Anular factura 000-001-01-00000031/i)).toBeInTheDocument();
  });

  it('keeps reverse confirmation open when reason is too short', async () => {
    const invoice = invoiceFixture({
      id: 32,
      invoice_number: '000-001-01-00000032',
      patient_name: 'Paciente Reversa',
      status: 'paid',
      paid_amount: '17.25',
      balance_due: '0.00',
    });
    const onStatus = vi.fn();
    const reverseInvoice = vi.spyOn(apiClient, 'reverseInvoice');

    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [invoice],
      meta: { current_page: 1, per_page: 10, total: 1 },
    });
    vi.spyOn(apiClient, 'getInvoice').mockResolvedValue(invoice);

    renderWithQueryClient(<InvoiceHistoryView user={adminUser()} onStatus={onStatus} />);

    await waitFor(() => expect(screen.getByText('Paciente Reversa')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /reversar/i }));
    await waitFor(() => expect(screen.getByText(/Reversar factura 000-001-01-00000032/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/motivo de reversa/i), { target: { value: 'abc' } });
    const confirmButton = screen.getByRole('button', { name: /reversar factura/i });
    expect(confirmButton).toBeDisabled();
    fireEvent.click(confirmButton);

    expect(reverseInvoice).not.toHaveBeenCalled();
    expect(onStatus).not.toHaveBeenCalledWith('Ingrese un motivo de reversa de al menos 5 caracteres.');
    expect(screen.getByText(/Reversar factura 000-001-01-00000032/i)).toBeInTheDocument();
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

  it('generates a missing institutional receipt only once while the request is pending', async () => {
    const paid = invoiceFixture({
      id: 36,
      invoice_number: '000-001-01-00000036',
      patient_name: 'Paciente PDF Pendiente',
      status: 'paid',
      paid_amount: '17.25',
      balance_due: '0.00',
      institutional_receipt: null,
    });
    const receipt = institutionalReceiptRecord({ id: 96, receipt_number_full: 'REC-A-00000096' });
    let resolveStore!: (receipt: InstitutionalReceipt) => void;
    const store = vi.spyOn(institutionalReceipts, 'store')
      .mockReturnValue(new Promise((resolve) => { resolveStore = resolve; }));
    vi.spyOn(apiClient, 'getInstitutionalReceiptPdf')
      .mockResolvedValue(new Blob(['%PDF-generated'], { type: 'application/pdf' }));

    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [paid],
      meta: { current_page: 1, per_page: 10, total: 1 },
    });
    vi.spyOn(apiClient, 'getInvoice').mockResolvedValue({
      ...paid,
      institutional_receipt: institutionalReceiptFixture({ id: 96, receipt_number_full: 'REC-A-00000096' }),
    });

    renderWithQueryClient(<InvoiceHistoryView user={adminUser()} onStatus={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Paciente PDF Pendiente')).toBeInTheDocument());
    const generateButton = screen.getByRole('button', { name: /generar pdf/i });
    fireEvent.click(generateButton);
    fireEvent.click(generateButton);

    expect(store).toHaveBeenCalledTimes(1);
    expect(store).toHaveBeenCalledWith({ invoice_id: 36 });

    await act(async () => {
      resolveStore(receipt);
    });

    await waitFor(() => expect(apiClient.getInstitutionalReceiptPdf).toHaveBeenCalledWith(96, 'Emisión manual de recibo faltante.'));
  });

  it('requires a reprint reason before opening a previously printed institutional receipt from history', async () => {
    const paid = invoiceFixture({
      id: 34,
      invoice_number: '000-001-01-00000034',
      patient_name: 'Paciente Recibo Ya Impreso',
      status: 'paid',
      institutional_receipt: institutionalReceiptFixture({
        id: 94,
        receipt_number_full: 'REC-A-00000094',
        print_events_count: 1,
        has_print_events: true,
      }),
    });
    const onStatus = vi.fn();
    const getPdf = vi.spyOn(apiClient, 'getInstitutionalReceiptPdf')
      .mockResolvedValue(new Blob(['%PDF-reprint-history'], { type: 'application/pdf' }));
    const getReceipt = vi.spyOn(apiClient, 'getReceipt');

    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [paid],
      meta: { current_page: 1, per_page: 10, total: 1 },
    });
    vi.spyOn(apiClient, 'getInvoice').mockResolvedValue(paid);

    renderWithQueryClient(<InvoiceHistoryView user={adminUser()} onStatus={onStatus} />);

    await waitFor(() => expect(screen.getByText('Paciente Recibo Ya Impreso')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /ver recibo/i }));

    await waitFor(() => expect(screen.getByText(/Reimprimir 000-001-01-00000034/i)).toBeInTheDocument());
    expect(getPdf).not.toHaveBeenCalled();
    expect(getReceipt).not.toHaveBeenCalled();
    expect(onStatus).toHaveBeenCalledWith('Ingrese un motivo de reimpresión para abrir nuevamente el PDF institucional.');

    fireEvent.change(screen.getByLabelText(/motivo de reimpresi/i), {
      target: { value: 'Copia solicitada por auditoria interna' },
    });
    fireEvent.click(screen.getByRole('button', { name: /registrar reimpresi/i }));

    await waitFor(() => expect(getPdf).toHaveBeenCalledWith(94, 'Copia solicitada por auditoria interna'));
    expect(openBlobInNewTab).toHaveBeenCalledWith(
      expect.any(Blob),
      'recibo-institucional-REC-A-00000094.pdf',
    );
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
    fireEvent.change(screen.getByLabelText(/motivo de reimpresi/i), {
      target: { value: 'Copia solicitada por el paciente' },
    });
    fireEvent.click(screen.getByRole('button', { name: /registrar reimpresi/i }));

    await waitFor(() => expect(getPdf).toHaveBeenCalledWith(91, 'Copia solicitada por el paciente'));
    expect(registerPrint).not.toHaveBeenCalled();
    expect(openBlobInNewTab).toHaveBeenCalledWith(
      expect.any(Blob),
      'recibo-institucional-REC-A-00000091.pdf',
    );
    expect(reprintInvoice).not.toHaveBeenCalled();
  });

  it('keeps institutional reprint confirmation open when reason is too short', async () => {
    const paid = invoiceFixture({
      id: 33,
      invoice_number: '000-001-01-00000033',
      patient_name: 'Paciente Reimpresion Corta',
      status: 'paid',
      institutional_receipt: institutionalReceiptFixture({ id: 93, receipt_number_full: 'REC-A-00000093' }),
    });
    const onStatus = vi.fn();
    const getPdf = vi.spyOn(apiClient, 'getInstitutionalReceiptPdf');

    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [paid],
      meta: { current_page: 1, per_page: 10, total: 1 },
    });
    vi.spyOn(apiClient, 'getInvoice').mockResolvedValue(paid);

    renderWithQueryClient(<InvoiceHistoryView user={adminUser()} onStatus={onStatus} />);

    await waitFor(() => expect(screen.getByText('Paciente Reimpresion Corta')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /reimprimir/i }));
    await waitFor(() => expect(screen.getByText(/Reimprimir 000-001-01-00000033/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/motivo de reimpresi/i), { target: { value: 'abc' } });
    const confirmButton = screen.getByRole('button', { name: /registrar reimpresi/i });
    expect(confirmButton).toBeDisabled();
    fireEvent.click(confirmButton);

    expect(apiClient.getInvoice).not.toHaveBeenCalledWith(33);
    expect(getPdf).not.toHaveBeenCalled();
    expect(onStatus).not.toHaveBeenCalledWith('Ingrese un motivo de reimpresión de al menos 5 caracteres.');
    expect(screen.getByText(/Reimprimir 000-001-01-00000033/i)).toBeInTheDocument();
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
    print_events_count: 0,
    has_print_events: false,
    ...overrides,
  };
}

function institutionalReceiptRecord(overrides: Partial<InstitutionalReceipt> = {}): InstitutionalReceipt {
  return {
    id: 90,
    invoice_id: 1,
    payment_id: null,
    cash_session_id: 1,
    series_id: 1,
    receipt_number: 90,
    receipt_number_full: 'REC-A-00000090',
    status: 'issued',
    amount: '17.25',
    amount_cents: 1725,
    issued_at: '2026-06-01T12:05:00.000000Z',
    issued_by: 1,
    payer_name: 'Paciente Historial',
    concept: 'Servicios hospitalarios',
    amount_words: 'DIECISIETE LEMPIRAS CON 25/100 CENTAVOS',
    template_code: 'institutional_classic',
    print_profile_code: 'media_carta_horizontal',
    copy_mode: 'original_only',
    reprint_count: 0,
    voided_by: null,
    voided_at: null,
    void_reason: null,
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

function limitedUser(): AuthUser {
  return {
    ...adminUser(),
    roles: ['cashier'],
    permissions: ['invoices.view'],
  };
}
