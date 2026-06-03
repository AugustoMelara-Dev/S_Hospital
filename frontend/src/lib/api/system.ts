import { apiClient } from './base';
import type { OperationalHealth, SystemStatus } from './types';

export const system = {
  async getStatus(): Promise<SystemStatus> {
    const response = await apiClient.request<{ data: SystemStatus }>('/api/system/status');
    return response.data;
  },

  async getHealth(): Promise<OperationalHealth> {
    const response = await apiClient.request<{ data: OperationalHealth }>('/api/system/health');
    return response.data;
  },
};
