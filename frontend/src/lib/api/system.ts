import { apiClient } from './base';
import type { AuditLogPage, OperationalHealth, SystemHealthLiveness, SystemStatus, SystemStatusSummary } from './types';

export type AuditLogFilters = {
  action?: string;
  user_id?: number;
  user?: string;
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
};

export const system = {
  async getStatusSummary(): Promise<SystemStatusSummary> {
    const response = await apiClient.request<{ data: SystemStatusSummary }>('/api/system/status-summary');
    return response.data;
  },

  async getStatus(): Promise<SystemStatus> {
    const response = await apiClient.request<{ data: SystemStatus }>('/api/system/status');
    return response.data;
  },

  async getHealthLiveness(): Promise<SystemHealthLiveness> {
    const response = await apiClient.request<{ data: SystemHealthLiveness }>('/api/system/health');
    return response.data ?? fallbackLiveness();
  },

  /**
   * Authenticated operational snapshot. Requires the `system.status.view`
   * permission; callers must gate the request (see useServerStatus).
   */
  async getHealth(): Promise<OperationalHealth> {
    const response = await apiClient.request<{ data: OperationalHealth }>('/api/system/health/detail');
    return response.data ?? fallbackOperationalHealth();
  },

  async getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogPage> {
    const params = new URLSearchParams();
    if (filters.user) params.set('user', filters.user);
    if (filters.action) params.set('action', filters.action);
    if (filters.user_id !== undefined) params.set('user_id', String(filters.user_id));
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.per_page) params.set('per_page', String(filters.per_page));
    const qs = params.toString();
    const response = await apiClient.request<AuditLogPage>(
      `/api/system/audit-logs${qs ? `?${qs}` : ''}`,
    );
    return response;
  },
};

function fallbackLiveness(): SystemHealthLiveness {
  return {
    status: 'ok',
    service: 'Sistema de Caja Hospitalaria',
    version: 'local',
  };
}

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
