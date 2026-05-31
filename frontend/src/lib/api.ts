import { apiClient as baseClient, ApiError, isSessionExpiredError, userSafeErrorMessage } from './api/base';
import { auth } from './api/auth';
import { billing } from './api/billing';
import { catalog } from './api/catalog';
import { cash } from './api/cash';
import { reports } from './api/reports';
import { backups } from './api/backups';
import { fiscal } from './api/fiscal';
import { system } from './api/system';
import { users, type UserPayload } from './api/users';
import type {
  AuthUser,
  FiscalSettings,
  FiscalSequence,
  Category,
  ServiceArea,
  Service,
  CategoryPayload,
  ServicePayload,
  InvoiceItemPayload,
  InvoicePayload,
  InvoiceItem,
  Invoice,
  CashSession,
  Payment,
  ReceiptData,
  MoneyByMethod,
  DailyReport,
  IncomeReport,
  CategoryReport,
  ServiceSalesReport,
  OperationsReport,
  CashSessionReport,
  BackupLog,
  SystemStatus,
  PaginatedMeta,
  ServiceFilters,
  InvoiceFilters,
  ReportFilters,
  DashboardReport,
} from './api/types';

export {
  ApiError,
  isSessionExpiredError,
  userSafeErrorMessage,
  auth,
  billing,
  catalog,
  cash,
  reports,
  backups,
  fiscal,
  system,
  users,
};
export type {
  AuthUser,
  FiscalSettings,
  FiscalSequence,
  Category,
  ServiceArea,
  Service,
  CategoryPayload,
  ServicePayload,
  InvoiceItemPayload,
  InvoicePayload,
  InvoiceItem,
  Invoice,
  CashSession,
  Payment,
  ReceiptData,
  MoneyByMethod,
  DailyReport,
  IncomeReport,
  CategoryReport,
  ServiceSalesReport,
  OperationsReport,
  CashSessionReport,
  BackupLog,
  SystemStatus,
  PaginatedMeta,
  ServiceFilters,
  InvoiceFilters,
  ReportFilters,
  DashboardReport,
  UserPayload,
};



export const apiClient = {
  ...baseClient,

  async getUsers(): Promise<AuthUser[]> {
    return users.getUsers();
  },

  async createUser(payload: UserPayload): Promise<AuthUser> {
    return users.createUser(payload);
  },

  async updateUser(id: number, payload: Omit<UserPayload, 'password'>): Promise<AuthUser> {
    return users.updateUser(id, payload);
  },

  async toggleUserActive(id: number): Promise<AuthUser> {
    return users.toggleActive(id);
  },

  async resetUserPassword(id: number, password: string): Promise<AuthUser> {
    return users.resetPassword(id, password);
  },

  async getCategories(active?: boolean): Promise<Category[]> {
    return catalog.getCategories(active);
  },

  async saveCategory(payload: CategoryPayload, id?: number): Promise<Category> {
    return catalog.saveCategory(payload, id);
  },

  async getServiceAreas(active?: boolean): Promise<ServiceArea[]> {
    return catalog.getServiceAreas(active);
  },

  async getServicesPage(filters: ServiceFilters = {}): Promise<{ data: Service[]; meta: PaginatedMeta }> {
    return catalog.getServicesPage(filters);
  },

  async getServices(filters: ServiceFilters = {}): Promise<Service[]> {
    return catalog.getServices(filters);
  },

  async saveService(payload: ServicePayload, id?: number): Promise<Service> {
    return catalog.saveService(payload, id);
  },

  async createInvoice(payload: InvoicePayload): Promise<Invoice> {
    return billing.createInvoice(payload);
  },

  async getInvoices(filters: InvoiceFilters = {}): Promise<{ data: Invoice[]; meta: PaginatedMeta }> {
    return billing.getInvoices(filters);
  },

  async getInvoice(id: number): Promise<Invoice> {
    return billing.getInvoice(id);
  },

  async registerPayment(
    invoiceId: number,
    payload: { cash_session_id: number; method: Payment['method']; amount: string; reference?: string | null },
  ): Promise<{ payment: Payment; invoice: Invoice }> {
    return billing.registerPayment(invoiceId, payload);
  },

  async getReceipt(invoiceId: number, width?: ReceiptData['width']): Promise<ReceiptData> {
    return billing.getReceipt(invoiceId, width);
  },

  async reprintInvoice(
    invoiceId: number,
    payload: { width: ReceiptData['width']; reason?: string | null },
  ): Promise<ReceiptData> {
    return billing.reprintInvoice(invoiceId, payload);
  },

  async voidInvoice(invoiceId: number, reason: string): Promise<Invoice> {
    return billing.voidInvoice(invoiceId, reason);
  },

  async getCurrentCashSession(): Promise<CashSession | null> {
    return cash.getCurrentCashSession();
  },

  async openCashSession(payload: { opening_amount: string; notes?: string | null }): Promise<CashSession> {
    return cash.openCashSession(payload);
  },

  async closeCashSession(id: number, payload: { closing_amount: string; notes?: string | null }): Promise<CashSession> {
    return cash.closeCashSession(id, payload);
  },

  async getDashboardReport(): Promise<DashboardReport> {
    return reports.getDashboardReport();
  },

  async getDailyReport(date?: string): Promise<DailyReport> {
    return reports.getDailyReport(date);
  },

  async getIncomeReport(filters: ReportFilters): Promise<IncomeReport> {
    return reports.getIncomeReport(filters);
  },

  async getCategoryReport(filters: ReportFilters): Promise<CategoryReport> {
    return reports.getCategoryReport(filters);
  },

  async getServiceSalesReport(filters: ReportFilters): Promise<ServiceSalesReport> {
    return reports.getServiceSalesReport(filters);
  },

  async getOperationsReport(filters: ReportFilters): Promise<OperationsReport> {
    return reports.getOperationsReport(filters);
  },

  async getCashSessionReport(id: string): Promise<CashSessionReport> {
    return reports.getCashSessionReport(id);
  },

  reportExportUrl(filters: ReportFilters): string {
    return reports.exportUrl(filters);
  },

  async downloadReportExport(filters: ReportFilters): Promise<Blob> {
    return reports.downloadExport(filters);
  },

  async downloadReportPdf(filters: ReportFilters & { date?: string }): Promise<Blob> {
    return reports.downloadPdf(filters);
  },

  async getBackups(filters: { page?: number; perPage?: number; status?: BackupLog['status'] | 'all' } = {}): Promise<{ data: BackupLog[]; meta: PaginatedMeta }> {
    return backups.getBackups(filters);
  },

  async createBackup(): Promise<BackupLog> {
    return backups.createBackup();
  },

  backupDownloadUrl(id: number): string {
    return backups.downloadUrl(id);
  },

  async downloadBackup(id: number): Promise<Blob> {
    return backups.downloadBackup(id);
  },

  async getSystemStatus(): Promise<SystemStatus> {
    return system.getStatus();
  },

  async getFiscalSettings(): Promise<FiscalSettings | null> {
    return fiscal.getFiscalSettings();
  },

  async updateFiscalSettings(payload: FiscalSettings): Promise<FiscalSettings> {
    return fiscal.updateFiscalSettings(payload);
  },

  async getFiscalSequences(): Promise<FiscalSequence[]> {
    return fiscal.getFiscalSequences();
  },

  async saveFiscalSequence(payload: FiscalSequence): Promise<FiscalSequence> {
    return fiscal.saveFiscalSequence(payload);
  },

  async getLogo(): Promise<string | null> {
    return fiscal.getLogo();
  },

  async uploadLogo(file: File): Promise<string> {
    return fiscal.uploadLogo(file);
  },

  async login(login: string, password: string): Promise<AuthUser> {
    return auth.login({ login, password });
  },

  async me(): Promise<AuthUser> {
    return auth.me();
  },

  async session(): Promise<AuthUser | null> {
    return auth.session();
  },

  async logout(): Promise<void> {
    return auth.logout();
  },

  async changePassword(payload: { current_password: string; password: string; password_confirmation: string }): Promise<AuthUser> {
    return auth.changePassword(payload);
  },
};
