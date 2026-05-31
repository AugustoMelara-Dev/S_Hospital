import { apiClient } from './base';
import type { SystemStatus, SystemStatusSummary } from './types';

export const system = {
  async getStatusSummary(): Promise<SystemStatusSummary> {
    const response = await apiClient.request<{ data: SystemStatusSummary }>('/api/system/status-summary');
    return response.data;
  },

  async getStatus(): Promise<SystemStatus> {
    const response = await apiClient.request<{ data: SystemStatus }>('/api/system/status');
    return response.data;
  },
};
