import { apiClient } from './base';
import type { BackupLog } from './types';

export const backups = {
  async getBackups(filters: { page?: number; perPage?: number; status?: BackupLog['status'] | 'all' } = {}): Promise<{ data: BackupLog[]; meta: import('./types').PaginatedMeta }> {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.perPage) params.set('per_page', String(filters.perPage));
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.request<{ data: BackupLog[]; meta: import('./types').PaginatedMeta }>(`/api/backups${query}`);
  },

  async createBackup(options: { idempotencyKey?: string } = {}): Promise<BackupLog> {
    const response = await apiClient.request<{ data: BackupLog }>('/api/backups', {
      method: 'POST',
      idempotencyKey: options.idempotencyKey,
      headers: options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : undefined,
      body: JSON.stringify({}),
    });
    return response.data;
  },

  downloadUrl(id: number): string {
    return apiClient.url(`/api/backups/${encodeURIComponent(id)}/download`);
  },

  async downloadBackup(id: number): Promise<Blob> {
    return apiClient.download(`/api/backups/${encodeURIComponent(id)}/download`);
  },
};
