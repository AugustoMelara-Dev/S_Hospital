import { apiClient } from './base';
import type {
  InstitutionalReceipt,
  InstitutionalReceiptSeries,
  InstitutionalReceiptSettings,
  ReceiptInstitutionPayload,
  ReceiptPrintProfile,
  ReceiptPrintProfilePayload,
  ReceiptProfileAssignment,
  ReceiptSeriesPayload,
  ReceiptTestPrintPayload,
} from './types';

async function pdfPost(
  path: string,
  payload: Record<string, unknown>,
  options: { idempotencyKey?: string } = {},
): Promise<Blob> {
  return options.idempotencyKey
    ? apiClient.postDownload(path, payload, { idempotencyKey: options.idempotencyKey })
    : apiClient.postDownload(path, payload);
}

export const institutionalReceipts = {
  async previewHtml(id: number): Promise<string> {
    const response = await apiClient.download(`/api/institutional-receipts/${id}/pdf?preview=1`);
    return response.text();
  },

  async getSettings(): Promise<InstitutionalReceiptSettings> {
    const response = await apiClient.request<{ data: InstitutionalReceiptSettings }>('/api/settings/institutional-receipts');
    return response.data;
  },

  async updateInstitution(payload: ReceiptInstitutionPayload): Promise<InstitutionalReceiptSettings['institution']> {
    const response = await apiClient.request<{ data: InstitutionalReceiptSettings['institution'] }>(
      '/api/settings/institutional-receipts/institution',
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    );
    return response.data;
  },

  async store(
    payload: { invoice_id: number; payment_id?: number | null; cash_session_id?: number | null },
    options: { idempotencyKey?: string } = {},
  ): Promise<InstitutionalReceipt> {
    const response = await apiClient.request<{ data: InstitutionalReceipt }>('/api/institutional-receipts', {
      method: 'POST',
      idempotencyKey: options.idempotencyKey,
      headers: options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : undefined,
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  async storeSeries(payload: ReceiptSeriesPayload): Promise<InstitutionalReceiptSeries> {
    const response = await apiClient.request<{ data: InstitutionalReceiptSeries }>('/api/settings/institutional-receipts/series', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  async updateSeries(id: number, payload: Partial<ReceiptSeriesPayload>): Promise<InstitutionalReceiptSeries> {
    const response = await apiClient.request<{ data: InstitutionalReceiptSeries }>(`/api/settings/institutional-receipts/series/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  async updatePrintProfile(id: number, payload: ReceiptPrintProfilePayload): Promise<ReceiptPrintProfile> {
    const response = await apiClient.request<{ data: ReceiptPrintProfile }>(`/api/settings/institutional-receipts/print-profiles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  async upsertAssignment(payload: {
    profile_id?: number;
    profile_code?: ReceiptPrintProfile['code'];
    scope_type: ReceiptProfileAssignment['scope_type'];
    scope_id?: number | null;
    active?: boolean;
  }): Promise<ReceiptProfileAssignment> {
    const response = await apiClient.request<{ data: ReceiptProfileAssignment }>('/api/settings/institutional-receipts/assignments', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  async testPrint(payload: ReceiptTestPrintPayload): Promise<Blob> {
    return pdfPost('/api/settings/institutional-receipts/test-print', payload);
  },

  async registerPrintEvent(
    id: number,
    reason?: string | null,
    options: { idempotencyKey?: string } = {},
  ): Promise<InstitutionalReceipt> {
    const response = await apiClient.request<{ data: { receipt: InstitutionalReceipt } }>(
      `/api/institutional-receipts/${id}/print-events`,
      {
        method: 'POST',
        idempotencyKey: options.idempotencyKey,
        headers: options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : undefined,
        body: JSON.stringify({
          ...(reason?.trim() ? { reason: reason.trim() } : {}),
        }),
      },
    );

    return response.data.receipt;
  },

  async pdf(id: number, reason?: string | null, options: { idempotencyKey?: string } = {}): Promise<Blob> {
    const trimmedReason = reason?.trim();
    if (trimmedReason) {
      return pdfPost(`/api/institutional-receipts/${id}/pdf`, { reason: trimmedReason }, options);
    }

    return apiClient.download(`/api/institutional-receipts/${id}/pdf`);
  },
};
