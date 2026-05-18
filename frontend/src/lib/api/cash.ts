import { apiClient } from './base';
import type { CashSession } from './types';

export const cash = {
  async getCurrentCashSession(): Promise<CashSession | null> {
    const response = await apiClient.request<{ data: CashSession | null }>('/api/cash-sessions/current');
    return response.data;
  },

  async openCashSession(payload: { opening_amount: string; notes?: string | null }): Promise<CashSession> {
    const response = await apiClient.request<{ data: CashSession }>('/api/cash-sessions/open', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  async closeCashSession(id: number, payload: { closing_amount: string; notes?: string | null }): Promise<CashSession> {
    const response = await apiClient.request<{ data: CashSession }>(`/api/cash-sessions/${id}/close`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },
};