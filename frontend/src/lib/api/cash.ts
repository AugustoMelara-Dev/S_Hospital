import { apiClient } from './base';
import type { CashClosingBreakdown, CashSession, PaginatedMeta } from './types';

export const cash = {
  async getCashSessions(
    filters: { page?: number; perPage?: number; status?: CashSession['status'] } = {},
  ): Promise<{ data: CashSession[]; meta: PaginatedMeta }> {
    const params = new URLSearchParams();
    params.set('per_page', String(filters.perPage ?? 50));

    if (filters.page) {
      params.set('page', String(filters.page));
    }

    if (filters.status) {
      params.set('status', filters.status);
    }

    return apiClient.request<{ data: CashSession[]; meta: PaginatedMeta }>(`/api/cash-sessions?${params.toString()}`);
  },

  async getCurrentCashSession(options: { scope?: 'own' | 'closable' } = {}): Promise<CashSession | null> {
    const suffix = options.scope === 'closable' ? '?scope=closable' : '';
    const response = await apiClient.request<{ data?: CashSession | null }>(`/api/cash-sessions/current${suffix}`);
    return response.data ?? null;
  },

  async openCashSession(
    payload: { opening_amount: string; notes?: string | null },
    options: { idempotencyKey?: string } = {},
  ): Promise<CashSession> {
    const response = await apiClient.request<{ data: CashSession }>('/api/cash-sessions/open', {
      method: 'POST',
      idempotencyKey: options.idempotencyKey,
      headers: options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : undefined,
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  async closeCashSession(
    id: number,
    payload: { closing_amount: string; notes?: string | null; closing_breakdown?: CashClosingBreakdown },
    options: { idempotencyKey?: string } = {},
  ): Promise<CashSession> {
    const response = await apiClient.request<{ data: CashSession }>(`/api/cash-sessions/${id}/close`, {
      method: 'POST',
      idempotencyKey: options.idempotencyKey,
      headers: options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : undefined,
      body: JSON.stringify(payload),
    });
    return response.data;
  },
};
