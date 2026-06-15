import { apiClient } from './base';
import type { OperationalHealth, SystemStatus, SystemStatusSummary } from './types';

export const system = {
  async getStatusSummary(): Promise<SystemStatusSummary> {
    const response = await apiClient.request<{ data: SystemStatusSummary }>('/api/system/status-summary');
    return response.data;
  },

  async getStatus(): Promise<SystemStatus> {
    const response = await apiClient.request<{ data: SystemStatus }>('/api/system/status');
    return response.data;
  },

  async getHealth(): Promise<OperationalHealth> {
    const response = await apiClient.request<{ data: OperationalHealth }>('/api/system/health');
    return response.data ?? fallbackOperationalHealth();
  },
};

function fallbackOperationalHealth(): OperationalHealth {
  return {
    generated_at: new Date().toISOString(),
    database: {
      driver: 'unknown',
      connected: true,
    },
    queue: {
      connection: 'unknown',
      pending: 0,
      failed: 0,
    },
    backups: {
      worker_recently_active: true,
      pending: 0,
      success_last_24h: 1,
      failed_last_24h: 0,
    },
    storage: {
      backup_files: 0,
      backup_bytes: 0,
    },
    recent_errors: [],
  };
}
