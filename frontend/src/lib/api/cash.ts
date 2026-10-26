import { apiClient } from './base';
import type { CashClosingBreakdown, CashRegister, CashSession, PaginatedMeta } from './types';

export type CashSessionHistoryFilters = {
  page?: number;
  perPage?: number;
  status?: CashSession['status'];
  date_from?: string;
  date_to?: string;
  cash_register_id?: number;
  user_id?: number;
  difference?: 'all' | 'balanced' | 'shortage' | 'overage';
};
export type CashOption = { value: string; label: string };
export type CashOptionKind = 'sessions' | 'cashiers' | 'registers';
export type CashOptionsPage = { data: CashOption[]; meta: PaginatedMeta; selected: CashOption | null };

export const cash = {
  async getCashSessionOptions(filters: { kind: CashOptionKind; search?: string; page?: number; selectedId?: number }): Promise<CashOptionsPage> {
    const params = new URLSearchParams({ kind: filters.kind, per_page: '20', page: String(filters.page ?? 1) });
    if (filters.search?.trim()) params.set('search', filters.search.trim());
    if (filters.selectedId !== undefined) params.set('selected_id', String(filters.selectedId));
    return apiClient.request<CashOptionsPage>(`/api/cash-sessions/options?${params.toString()}`);
  },
  async getCashRegisters(): Promise<CashRegister[]> {
    const response = await apiClient.request<{ data: CashRegister[] }>('/api/cash-registers');
    return response.data;
  },

  async getCashSessions(
    filters: CashSessionHistoryFilters = {},
  ): Promise<{ data: CashSession[]; meta: PaginatedMeta }> {
    const params = new URLSearchParams();
    params.set('per_page', String(filters.perPage ?? 50));

    if (filters.page) {
      params.set('page', String(filters.page));
    }

    if (filters.status) {
      params.set('status', filters.status);
    }
    for (const key of ['date_from', 'date_to', 'cash_register_id', 'user_id', 'difference'] as const) {
      if (filters[key] !== undefined && filters[key] !== '') params.set(key, String(filters[key]));
    }

    return apiClient.request<{ data: CashSession[]; meta: PaginatedMeta }>(`/api/cash-sessions?${params.toString()}`);
  },

  async getCurrentCashSession(options: { scope?: 'own' | 'closable' } = {}): Promise<CashSession | null> {
    const suffix = options.scope === 'closable' ? '?scope=closable' : '';
    const response = await apiClient.request<{ data?: CashSession | null }>(`/api/cash-sessions/current${suffix}`);
    return response.data ?? null;
  },

  async openCashSession(
    payload: { opening_amount: string; cash_register_id?: number; notes?: string | null },
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
