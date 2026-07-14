import { apiClient } from './base';
import type {
  Invoice,
  InvoiceFilters,
  InvoicePayload,
  Payment,
  PaymentRegistrationResult,
  ReceiptData,
  PaginatedMeta,
} from './types';

export const billing = {
  async createInvoice(payload: InvoicePayload, options: { idempotencyKey?: string } = {}): Promise<Invoice> {
    const response = await apiClient.request<{ data: Invoice }>('/api/invoices', {
      method: 'POST',
      idempotencyKey: options.idempotencyKey,
      headers: options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : undefined,
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  async getInvoices(filters: InvoiceFilters = {}): Promise<{ data: Invoice[]; meta: PaginatedMeta }> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.set(key, String(value));
      }
    });
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.request<{ data: Invoice[]; meta: PaginatedMeta }>(`/api/invoices${query}`);
  },

  async getInvoice(id: number): Promise<Invoice> {
    const response = await apiClient.request<{ data: Invoice }>(`/api/invoices/${id}`);
    return response.data;
  },

  async registerPayment(
    invoiceId: number,
    payload: { cash_session_id: number; method: Payment['method']; amount: string; reference?: string | null },
    options: { idempotencyKey?: string } = {},
  ): Promise<PaymentRegistrationResult> {
    const response = await apiClient.request<{ data: PaymentRegistrationResult }>(
      `/api/invoices/${invoiceId}/payments`,
      {
        method: 'POST',
        idempotencyKey: options.idempotencyKey,
        headers: options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : undefined,
        body: JSON.stringify(payload),
      },
    );
    return response.data;
  },

  async voidPayment(
    invoiceId: number,
    paymentId: number,
    payload: { reason: string },
    options: { idempotencyKey?: string } = {},
  ): Promise<{ payment: Payment; invoice: Invoice }> {
    const response = await apiClient.request<{ data: { payment: Payment; invoice: Invoice } }>(
      `/api/invoices/${invoiceId}/payments/${paymentId}/void`,
      {
        method: 'POST',
        idempotencyKey: options.idempotencyKey,
        headers: options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : undefined,
        body: JSON.stringify(payload),
      },
    );
    return response.data;
  },

  async getReceipt(invoiceId: number, width?: ReceiptData['width']): Promise<ReceiptData> {
    const query = width ? `?width=${width}` : '';
    const response = await apiClient.request<{ data: ReceiptData }>(
      `/api/invoices/${invoiceId}/receipt${query}`,
    );
    return response.data;
  },

  async reprintInvoice(
    invoiceId: number,
    payload: { width: ReceiptData['width']; reason?: string | null },
    options: { idempotencyKey?: string } = {},
  ): Promise<ReceiptData> {
    const response = await apiClient.request<{ data: { receipt: ReceiptData } }>(
      `/api/invoices/${invoiceId}/reprint`,
      {
        method: 'POST',
        idempotencyKey: options.idempotencyKey,
        headers: options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : undefined,
        body: JSON.stringify(payload),
      },
    );
    return response.data.receipt;
  },

  async voidInvoice(invoiceId: number, reason: string, options: { idempotencyKey?: string } = {}): Promise<Invoice> {
    const response = await apiClient.request<{ data: Invoice }>(`/api/invoices/${invoiceId}/void`, {
      method: 'POST',
      idempotencyKey: options.idempotencyKey,
      headers: options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : undefined,
      body: JSON.stringify({ reason }),
    });
    return response.data;
  },

  async reverseInvoice(invoiceId: number, reason: string, options: { idempotencyKey?: string } = {}): Promise<Invoice> {
    const response = await apiClient.request<{ data: Invoice }>(`/api/invoices/${invoiceId}/reverse`, {
      method: 'POST',
      idempotencyKey: options.idempotencyKey,
      headers: options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : undefined,
      body: JSON.stringify({ reason }),
    });
    return response.data;
  },
};
