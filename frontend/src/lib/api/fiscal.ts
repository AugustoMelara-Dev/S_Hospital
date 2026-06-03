import { apiClient } from './base';
import type { FiscalSettings, FiscalSequence, PublicBranding } from './types';

export const fiscal = {
  async getPublicBranding(): Promise<PublicBranding | null> {
    const response = await apiClient.request<{ data: PublicBranding | null }>('/api/settings/branding');
    return response?.data ?? null;
  },

  async getFiscalSettings(): Promise<FiscalSettings | null> {
    const response = await apiClient.request<{ data: FiscalSettings | null }>('/api/settings/fiscal');
    return response?.data ?? null;
  },

  async updateFiscalSettings(payload: FiscalSettings): Promise<FiscalSettings> {
    const response = await apiClient.request<{ data: FiscalSettings }>('/api/settings/fiscal', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  async getFiscalSequences(): Promise<FiscalSequence[]> {
    const response = await apiClient.request<{ data: FiscalSequence[] }>('/api/fiscal-sequences');
    return response?.data ?? [];
  },

  async saveFiscalSequence(payload: FiscalSequence): Promise<FiscalSequence> {
    const response = await apiClient.request<{ data: FiscalSequence }>(
      payload.id ? `/api/fiscal-sequences/${payload.id}` : '/api/fiscal-sequences',
      {
        method: payload.id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      },
    );
    return response.data;
  },

  async getLogo(): Promise<string | null> {
    const response = await apiClient.request<{ logo_url: string | null }>('/api/settings/logo');
    return response?.logo_url ?? null;
  },

  async uploadLogo(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('logo', file);
    const response = await apiClient.request<{ message: string; logo_url: string }>('/api/settings/logo', {
      method: 'POST',
      body: formData,
    });
    return response.logo_url;
  },
};
