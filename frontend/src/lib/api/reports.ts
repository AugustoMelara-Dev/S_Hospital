import { apiClient } from './base';
import type {
  DailyReport,
  IncomeReport,
  CategoryReport,
  ServiceSalesReport,
  OperationsReport,
  CashSessionReport,
  ReportFilters,
  PaginatedMeta,
  DashboardReport,
} from './types';

function buildReportParams(filters: ReportFilters): URLSearchParams {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });
  return params;
}

export const reports = {
  async getDashboardReport(): Promise<DashboardReport> {
    const response = await apiClient.request<{ data: DashboardReport }>(`/api/reports/dashboard`);
    return response.data;
  },

  async getDailyReport(date?: string): Promise<DailyReport> {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    const response = await apiClient.request<{ data: DailyReport }>(`/api/reports/daily${query}`);
    return response.data;
  },

  async getIncomeReport(filters: ReportFilters): Promise<IncomeReport> {
    const params = buildReportParams(filters);
    const response = await apiClient.request<{ data: IncomeReport }>(
      `/api/reports/income?${params.toString()}`,
    );
    return response.data;
  },

  async getCategoryReport(filters: ReportFilters): Promise<CategoryReport> {
    const params = buildReportParams(filters);
    const response = await apiClient.request<{ data: CategoryReport }>(
      `/api/reports/categories?${params.toString()}`,
    );
    return response.data;
  },

  async getServiceSalesReport(filters: ReportFilters): Promise<ServiceSalesReport> {
    const params = buildReportParams(filters);
    const response = await apiClient.request<{ data: ServiceSalesReport }>(
      `/api/reports/services?${params.toString()}`,
    );
    return response.data;
  },

  async getOperationsReport(filters: ReportFilters): Promise<OperationsReport> {
    const params = buildReportParams(filters);
    const response = await apiClient.request<{ data: OperationsReport }>(
      `/api/reports/operations?${params.toString()}`,
    );
    return response.data;
  },

  async getCashSessionReport(id: string): Promise<CashSessionReport> {
    const response = await apiClient.request<{ data: CashSessionReport }>(
      `/api/reports/cash-sessions/${encodeURIComponent(id)}`,
    );
    return response.data;
  },

  async getBackups(filters: { page?: number; perPage?: number } = {}): Promise<{ data: import('./types').BackupLog[]; meta: PaginatedMeta }> {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.perPage) params.set('per_page', String(filters.perPage));
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.request<{ data: import('./types').BackupLog[]; meta: PaginatedMeta }>(`/api/backups${query}`);
  },

  exportUrl(filters: ReportFilters): string {
    const params = buildReportParams(filters);
    return apiClient.url(`/api/reports/export?${params.toString()}`);
  },

  async downloadExport(filters: ReportFilters): Promise<Blob> {
    const params = buildReportParams(filters);
    return apiClient.download(`/api/reports/export?${params.toString()}`);
  },

  async downloadPdf(filters: ReportFilters & { date?: string }): Promise<Blob> {
    const params = buildReportParams(filters as ReportFilters);
    if (filters.date) {
      params.set('date', filters.date);
    }
    return apiClient.download(`/api/reports/pdf?${params.toString()}`);
  },
};