import { apiClient } from './base';
import type { SystemStatus } from './types';

export const system = {
  async getStatus(): Promise<SystemStatus> {
    const response = await apiClient.request<{ data: SystemStatus }>('/api/system/status');
    return response.data;
  },
};
