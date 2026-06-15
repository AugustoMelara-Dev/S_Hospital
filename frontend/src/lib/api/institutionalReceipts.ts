import { ApiError, apiClient } from './base';
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

function cookieValue(name: string): string | null {
  const prefix = `${name}=`;
  const cookie = document.cookie
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

async function pdfPost(path: string, payload: Record<string, unknown>): Promise<Blob> {
  await apiClient.csrf();

  const response = await fetch(apiClient.url(path), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/pdf, application/json',
      'Content-Type': 'application/json',
      ...(cookieValue('XSRF-TOKEN') ? { 'X-XSRF-TOKEN': cookieValue('XSRF-TOKEN') ?? '' } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string; errors?: Record<string, string[]> } | null;
    throw new ApiError(error?.message ?? `HTTP ${response.status}`, response.status, error?.errors);
  }

  return response.blob();
}

export const institutionalReceipts = {
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

  async store(payload: { invoice_id: number; payment_id?: number | null; cash_session_id?: number | null }): Promise<InstitutionalReceipt> {
    const response = await apiClient.request<{ data: InstitutionalReceipt }>('/api/institutional-receipts', {
      method: 'POST',
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

  async registerPrintEvent(id: number, reason?: string | null): Promise<InstitutionalReceipt> {
    const response = await apiClient.request<{ data: { receipt: InstitutionalReceipt } }>(
      `/api/institutional-receipts/${id}/print-events`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...(reason?.trim() ? { reason: reason.trim() } : {}),
        }),
      },
    );

    return response.data.receipt;
  },

  async pdf(id: number): Promise<Blob> {
    return apiClient.download(`/api/institutional-receipts/${id}/pdf`);
  },
};
