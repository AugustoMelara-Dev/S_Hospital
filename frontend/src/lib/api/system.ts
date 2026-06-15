import { apiClient } from './base';
import type { OperationalHealth, SystemStatus } from './types';

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
    return response.data;
  },
};
