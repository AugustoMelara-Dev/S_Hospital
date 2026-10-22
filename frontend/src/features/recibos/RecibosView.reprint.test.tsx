import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { apiClient, institutionalReceipts, type AuthUser, type Invoice } from '@/lib/api';
import { AdminSessionProvider } from '@/shell/admin/AdminSessionContext';
import { downloadBlob, openBlobInNewTab } from '../../lib/download';
import { RecibosView } from './RecibosView';

vi.mock('../../lib/download', async () => {
  const actual = await vi.importActual<typeof import('../../lib/download')>('../../lib/download');

  return {
    ...actual,
    downloadBlob: vi.fn(),
    openBlobInNewTab: vi.fn(),
  };
});

function authUser(permissions: string[]): AuthUser {
  return {
    id: 1,
    name: 'Admin Hospital',
    email: 'admin@hospital.local',
    username: 'admin',
    active: true,
    roles: ['admin'],
    permissions,
    must_change_password: false,
  };
}

const invoiceWithReceipt: Invoice = {
  id: 21,
  invoice_number: '000-001-01-00000021',
  patient_name: 'Paciente Recibo',
  subtotal: '100.00',
  tax_amount: '15.00',
  discount_amount: '0.00',
  total: '115.00',
  paid_amount: '115.00',
  balance_due: '0.00',
  status: 'paid',
  issued_at: '2026-09-18T12:00:00.000000Z',
  items: [],
  payments: [],
  institutional_receipt: {
    id: 90,
    receipt_number_full: 'REC-A-00000090',
    status: 'issued',
    issued_at: '2026-09-18T12:05:00.000000Z',
    reprint_count: 0,
    print_events_count: 0,
    has_print_events: false,
    copy_mode: 'original_first',
  },
};

function renderView() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/recibos']}>
        <AdminSessionProvider
          user={authUser(['invoices.view', 'receipts.view', 'payments.create', 'invoices.operate_any'])}
          cashSession={null}
          cashSessionLoading={false}
          onStatus={vi.fn()}
        >
          <RecibosView />
        </AdminSessionProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RecibosView · primera impresión y reimpresión', () => {
  it('la primera impresión del comprobante no crea cobros ni números nuevos', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [invoiceWithReceipt],
      meta: { current_page: 1, per_page: 10, total: 1 },
    });
    vi.spyOn(apiClient, 'getInvoice').mockResolvedValue(invoiceWithReceipt);
    vi.spyOn(apiClient, 'getInstitutionalReceiptPdf').mockResolvedValue(
      new Blob(['pdf'], { type: 'application/pdf' }),
    );
    vi.spyOn(apiClient, 'registerInstitutionalReceiptPrintEvent').mockResolvedValue({
      id: 90,
      receipt_number_full: 'REC-A-00000090',
      status: 'issued',
    } as never);
    const createInvoice = vi.spyOn(apiClient, 'createInvoice');
    const registerPayment = vi.spyOn(apiClient, 'registerPayment');
    vi.spyOn(institutionalReceipts, 'previewHtml').mockResolvedValue('<html><body>recibo</body></html>');

    renderView();

    const results = within(await screen.findByRole('table', { name: /operaciones filtradas/i }));
    await user.click(results.getByRole('button', { name: /Ver recibo/ }));
    expect(await screen.findByText(/se abrirá el PDF con 2 ejemplares/i)).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /Abrir para imprimir/i }));

    await waitFor(() => expect(apiClient.getInstitutionalReceiptPdf).toHaveBeenCalledWith(90));
    await waitFor(() =>
      expect(apiClient.registerInstitutionalReceiptPrintEvent).toHaveBeenCalledWith(90, undefined, {
        idempotencyKey: expect.any(String),
      }),
    );
    await waitFor(() => expect(openBlobInNewTab).toHaveBeenCalled());

    expect(createInvoice).not.toHaveBeenCalled();
    expect(registerPayment).not.toHaveBeenCalled();
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('la reimpresión exige un motivo humano y lo registra en el evento durable', async () => {
    const user = userEvent.setup();
    const alreadyPrinted: Invoice = {
      ...invoiceWithReceipt,
      institutional_receipt: {
        ...invoiceWithReceipt.institutional_receipt!,
        reprint_count: 1,
        print_events_count: 2,
        has_print_events: true,
      },
    };

    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [alreadyPrinted],
      meta: { current_page: 1, per_page: 10, total: 1 },
    });
    vi.spyOn(apiClient, 'getInvoice').mockResolvedValue(alreadyPrinted);
    vi.spyOn(apiClient, 'getInstitutionalReceiptPdf').mockResolvedValue(
      new Blob(['pdf'], { type: 'application/pdf' }),
    );
    const registerPrint = vi
      .spyOn(apiClient, 'registerInstitutionalReceiptPrintEvent')
      .mockResolvedValue({ id: 90, receipt_number_full: 'REC-A-00000090', status: 'issued' } as never);
    vi.spyOn(institutionalReceipts, 'previewHtml').mockResolvedValue('<html><body>recibo</body></html>');

    renderView();

    const results = within(await screen.findByRole('table', { name: /operaciones filtradas/i }));
    await user.click(results.getByRole('button', { name: /Ver recibo/ }));
    await user.click(await screen.findByRole('button', { name: /^Registrar reimpresión$/i }));

    const reason = 'Copia solicitada por el paciente para su expediente.';
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/motivo/i), reason);
    await user.click(within(dialog).getByRole('button', { name: /^Reimprimir$/i }));

    await waitFor(() =>
      expect(registerPrint).toHaveBeenCalledWith(90, reason, { idempotencyKey: expect.any(String) }),
    );
    await waitFor(() => expect(openBlobInNewTab).toHaveBeenCalled());
  });
});
