import { apiClient } from './base';
import type {
  DailyReport,
  MonthlyReport,
  IncomeReport,
  CategoryReport,
  AreaIncomeReport,
  ServiceSalesReport,
  OperationsReport,
  CashSessionReport,
  ReportFilters,
  PdfReportFilters,
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

  async getMonthlyReport(month?: string): Promise<MonthlyReport> {
    const query = month ? `?month=${encodeURIComponent(month)}` : '';
    const response = await apiClient.request<{ data: MonthlyReport }>(`/api/reports/monthly${query}`);
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

  async getAreaIncomeReport(filters: ReportFilters): Promise<AreaIncomeReport> {
    const params = buildReportParams(filters);
    const response = await apiClient.request<{ data: AreaIncomeReport }>(
      `/api/reports/areas?${params.toString()}`,
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

  async getTodayReport(): Promise<import('./types').TodayReport> {
    const response = await apiClient.request<{ data: import('./types').TodayReport }>(`/api/reports/today`);
    return response.data;
  },

  async getExecutiveReport(filters: import('./types').ExecutiveReportFilters): Promise<import('./types').ExecutiveReport> {
    const params = buildReportParams(filters);
    const response = await apiClient.request<{ data: import('./types').ExecutiveReport }>(
      `/api/reports/executive?${params.toString()}`,
    );
    return response.data;
  },

  exportUrl(filters: ReportFilters): string {
    const params = buildReportParams(filters);
    return apiClient.url(`/api/reports/export?${params.toString()}`);
  },

  executivePdfUrl(filters: import('./types').ExecutiveReportFilters): string {
    const params = buildReportParams(filters);
    return apiClient.url(`/api/reports/executive/pdf?${params.toString()}`);
  },

  executiveExcelUrl(filters: import('./types').ExecutiveReportFilters): string {
    const params = buildReportParams(filters);
    return apiClient.url(`/api/reports/executive/excel?${params.toString()}`);
  },

  async downloadExport(filters: ReportFilters): Promise<Blob> {
    const params = buildReportParams(filters);
    return apiClient.download(`/api/reports/export?${params.toString()}`);
  },

  async downloadPdf(filters: PdfReportFilters): Promise<Blob> {
    const params = buildReportParams(filters);
    if (filters.date) {
      params.set('date', filters.date);
    }
    return apiClient.download(`/api/reports/pdf?${params.toString()}`);
  },

  async downloadExecutivePdf(filters: import('./types').ExecutiveReportFilters): Promise<Blob> {
    const params = buildReportParams(filters);
    return apiClient.download(`/api/reports/executive/pdf?${params.toString()}`);
  },

  async downloadExecutiveExcel(filters: import('./types').ExecutiveReportFilters): Promise<Blob> {
    const params = buildReportParams(filters);
    return apiClient.download(`/api/reports/executive/excel?${params.toString()}`);
  },
};
