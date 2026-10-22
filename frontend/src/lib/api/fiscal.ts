import { apiClient } from './base';
import type { FiscalSettings, FiscalSequence, OperationalSettings, PublicBranding, TaxRate, TaxRatePayload } from './types';

export const fiscal = {
  async getPublicBranding(): Promise<PublicBranding | null> {
    const response = await apiClient.request<{ data: PublicBranding | null }>('/api/settings/branding');
    return response?.data ?? null;
  },

  async getFiscalSettings(): Promise<FiscalSettings | null> {
    const response = await apiClient.request<{ data: FiscalSettings | null }>('/api/settings/fiscal');
    return response?.data ?? null;
  },

  async getOperationalSettings(): Promise<OperationalSettings | null> {
    const response = await apiClient.request<{ data: OperationalSettings | null }>('/api/settings/operational');
    return response?.data ?? null;
  },

  async updateFiscalSettings(payload: Partial<FiscalSettings>): Promise<FiscalSettings> {
    const response = await apiClient.request<{ data: FiscalSettings }>('/api/settings/fiscal', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  async updateOperationalSettings(
    payload: Pick<OperationalSettings, 'scanner_enabled' | 'partial_payments_enabled'>,
  ): Promise<Pick<OperationalSettings, 'scanner_enabled' | 'partial_payments_enabled'>> {
    const response = await apiClient.request<{ data: Pick<OperationalSettings, 'scanner_enabled' | 'partial_payments_enabled'> }>(
      '/api/settings/operational',
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    );
    return response.data;
  },

  async getTaxRates(activeOnly = false): Promise<TaxRate[]> {
    const query = activeOnly ? '?active_only=1' : '';
    const response = await apiClient.request<{ data: TaxRate[] }>(`/api/tax-rates${query}`);
    return response?.data ?? [];
  },

  async createTaxRate(payload: TaxRatePayload): Promise<TaxRate> {
    const response = await apiClient.request<{ data: TaxRate }>('/api/tax-rates', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  async updateTaxRate(id: number, payload: TaxRatePayload): Promise<TaxRate> {
    const response = await apiClient.request<{ data: TaxRate }>(`/api/tax-rates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  async deleteTaxRate(id: number, reason: string): Promise<void> {
    await apiClient.request(`/api/tax-rates/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    });
  },

  async getFiscalSequences(): Promise<FiscalSequence[]> {    const response = await apiClient.request<{ data: FiscalSequence[] }>('/api/fiscal-sequences');
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
