import { apiClient as baseClient, ApiError, isSessionExpiredError, userSafeErrorMessage } from './api/base';
import { auth } from './api/auth';
import { billing } from './api/billing';
import { catalog } from './api/catalog';
import { cash } from './api/cash';
import { reports } from './api/reports';
import { backups } from './api/backups';
import { fiscal } from './api/fiscal';
import { institutionalReceipts } from './api/institutionalReceipts';
import { system } from './api/system';
import { users, type RolePayload, type UserPayload } from './api/users';
import type {
  AuthUser,
  FiscalSettings,
  OperationalSettings,
  PublicBranding,
  FiscalSequence,
  Category,
  Area,
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
  PaymentRegistrationResult,
  InvoiceInstitutionalReceipt,
  ReceiptData,
  MoneyByMethod,
  CashSessionReport,
  BackupLog,
  SystemStatus,
  SystemStatusCheck,
  SystemStatusSummary,
  OperationalHealth,
  PaginatedMeta,
  ServiceFilters,
  InvoiceFilters,
  ReportFilters,
  PdfReportFilters,
  DashboardReport,
  TodayReport,
  ExecutiveReport,
  ExecutiveReportFilters,
  InstitutionalReceiptSettings,
  InstitutionalReceipt,
  InstitutionalReceiptSeries,
  ReceiptInstitutionPayload,
  ReceiptPrintProfile,
  ReceiptPrintProfilePayload,
  ReceiptProfileAssignment,
  ReceiptSeriesPayload,
  ReceiptTestPrintPayload,
  RoleDefinition,
  PermissionCatalogGroup,
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
  institutionalReceipts,
  system,
  users,
};
export type {
  AuthUser,
  FiscalSettings,
  OperationalSettings,
  PublicBranding,
  FiscalSequence,
  Category,
  Area,
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
  PaymentRegistrationResult,
  InvoiceInstitutionalReceipt,
  ReceiptData,
  MoneyByMethod,
  CashSessionReport,
  BackupLog,
  SystemStatus,
  SystemStatusCheck,
  SystemStatusSummary,
  OperationalHealth,
  PaginatedMeta,
  ServiceFilters,
  InvoiceFilters,
  ReportFilters,
  PdfReportFilters,
  DashboardReport,
  InstitutionalReceiptSettings,
  InstitutionalReceipt,
  InstitutionalReceiptSeries,
  ReceiptInstitutionPayload,
  ReceiptPrintProfile,
  ReceiptPrintProfilePayload,
  ReceiptProfileAssignment,
  ReceiptSeriesPayload,
  ReceiptTestPrintPayload,
  RoleDefinition,
  PermissionCatalogGroup,
  UserPayload,
  RolePayload,
  TodayReport,
  ExecutiveReport,
  ExecutiveReportFilters,
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

  async toggleUserActive(id: number, reason?: string | null): Promise<AuthUser> {
    return users.toggleActive(id, reason);
  },

  async resetUserPassword(id: number, password: string, reason: string): Promise<AuthUser> {
    return users.resetPassword(id, password, reason);
  },

  async getRoles(): Promise<{ roles: RoleDefinition[]; permissionCatalog: PermissionCatalogGroup[] }> {
    return users.getRoles();
  },

  async createRole(payload: RolePayload): Promise<RoleDefinition> {
    return users.createRole(payload);
  },

  async updateRole(id: number, payload: RolePayload): Promise<RoleDefinition> {
    return users.updateRole(id, payload);
  },

  async getCategories(active?: boolean): Promise<Category[]> {
    return catalog.getCategories(active);
  },

  async getAreas(active?: boolean): Promise<Area[]> {
    return catalog.getAreas(active);
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

  async deleteService(id: number): Promise<Service> {
    return catalog.deleteService(id);
  },

  async createInvoice(payload: InvoicePayload, options: { idempotencyKey?: string } = {}): Promise<Invoice> {
    return billing.createInvoice(payload, options);
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
    options: { idempotencyKey?: string } = {},
  ): Promise<PaymentRegistrationResult> {
    return billing.registerPayment(invoiceId, payload, options);
  },

  async getReceipt(invoiceId: number, width?: ReceiptData['width']): Promise<ReceiptData> {
    return billing.getReceipt(invoiceId, width);
  },

  async reprintInvoice(
    invoiceId: number,
    payload: { width: ReceiptData['width']; reason?: string | null },
    options: { idempotencyKey?: string } = {},
  ): Promise<ReceiptData> {
    return billing.reprintInvoice(invoiceId, payload, options);
  },

  async voidInvoice(invoiceId: number, reason: string, options: { idempotencyKey?: string } = {}): Promise<Invoice> {
    return billing.voidInvoice(invoiceId, reason, options);
  },

  async reverseInvoice(invoiceId: number, reason: string, options: { idempotencyKey?: string } = {}): Promise<Invoice> {
    return billing.reverseInvoice(invoiceId, reason, options);
  },

  async voidPayment(
    invoiceId: number,
    paymentId: number,
    reason: string,
    options: { idempotencyKey?: string } = {},
  ): Promise<{ payment: Payment; invoice: Invoice }> {
    return billing.voidPayment(invoiceId, paymentId, { reason }, options);
  },

  async getCurrentCashSession(): Promise<CashSession | null> {
    return cash.getCurrentCashSession();
  },

  async getCashSessions(
    filters: { page?: number; perPage?: number; status?: CashSession['status'] } = {},
  ): Promise<{ data: CashSession[]; meta: PaginatedMeta }> {
    return cash.getCashSessions(filters);
  },

  async openCashSession(
    payload: { opening_amount: string; notes?: string | null },
    options: { idempotencyKey?: string } = {},
  ): Promise<CashSession> {
    return cash.openCashSession(payload, options);
  },

  async closeCashSession(
    id: number,
    payload: { closing_amount: string; notes?: string | null },
    options: { idempotencyKey?: string } = {},
  ): Promise<CashSession> {
    return cash.closeCashSession(id, payload, options);
  },

  async getDashboardReport(): Promise<DashboardReport> {
    return reports.getDashboardReport();
  },

  async getTodayReport(): Promise<TodayReport> {
    return reports.getTodayReport();
  },

  async getExecutiveReport(filters: ExecutiveReportFilters): Promise<ExecutiveReport> {
    return reports.getExecutiveReport(filters);
  },

  async getCashSessionReport(id: string): Promise<CashSessionReport> {
    return reports.getCashSessionReport(id);
  },

  reportExportUrl(filters: ReportFilters): string {
    return reports.exportUrl(filters);
  },

  executivePdfUrl(filters: ExecutiveReportFilters): string {
    return reports.executivePdfUrl(filters);
  },

  executiveExcelUrl(filters: ExecutiveReportFilters): string {
    return reports.executiveExcelUrl(filters);
  },

  async downloadReportExport(filters: ReportFilters): Promise<Blob> {
    return reports.downloadExport(filters);
  },

  async downloadReportPdf(filters: PdfReportFilters): Promise<Blob> {
    return reports.downloadPdf(filters);
  },

  async downloadCashSessionReportExcel(filters: ReportFilters): Promise<Blob> {
    return reports.downloadCashSessionReportExcel(filters);
  },

  async downloadCashSessionReportPdf(filters: ReportFilters): Promise<Blob> {
    return reports.downloadCashSessionReportPdf(filters);
  },
  async downloadExecutivePdf(filters: ExecutiveReportFilters): Promise<Blob> {
    return reports.downloadExecutivePdf(filters);
  },

  async downloadExecutiveExcel(filters: ExecutiveReportFilters): Promise<Blob> {
    return reports.downloadExecutiveExcel(filters);
  },

  async getBackups(filters: { page?: number; perPage?: number; status?: BackupLog['status'] | 'all' } = {}): Promise<{ data: BackupLog[]; meta: PaginatedMeta }> {
    return backups.getBackups(filters);
  },

  async createBackup(options: { idempotencyKey?: string } = {}): Promise<BackupLog> {
    return backups.createBackup(options);
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

  async getSystemStatusSummary(): Promise<SystemStatusSummary> {
    return system.getStatusSummary();
  },

  async getSystemHealth(): Promise<OperationalHealth> {
    return system.getHealth();
  },

  async getFiscalSettings(): Promise<FiscalSettings | null> {
    return fiscal.getFiscalSettings();
  },

  async getOperationalSettings(): Promise<OperationalSettings | null> {
    return fiscal.getOperationalSettings();
  },

  async getPublicBranding(): Promise<PublicBranding | null> {
    return fiscal.getPublicBranding();
  },

  async updateFiscalSettings(payload: Partial<FiscalSettings>): Promise<FiscalSettings> {
    return fiscal.updateFiscalSettings(payload);
  },

  async updateOperationalSettings(
    payload: Pick<OperationalSettings, 'scanner_enabled' | 'partial_payments_enabled'>,
  ): Promise<Pick<OperationalSettings, 'scanner_enabled' | 'partial_payments_enabled'>> {
    return fiscal.updateOperationalSettings(payload);
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

  async getInstitutionalReceiptSettings(): Promise<InstitutionalReceiptSettings> {
    return institutionalReceipts.getSettings();
  },

  async updateReceiptInstitution(payload: ReceiptInstitutionPayload): Promise<InstitutionalReceiptSettings['institution']> {
    return institutionalReceipts.updateInstitution(payload);
  },

  async storeReceiptSeries(payload: ReceiptSeriesPayload): Promise<InstitutionalReceiptSeries> {
    return institutionalReceipts.storeSeries(payload);
  },

  async updateReceiptSeries(id: number, payload: Partial<ReceiptSeriesPayload>): Promise<InstitutionalReceiptSeries> {
    return institutionalReceipts.updateSeries(id, payload);
  },

  async updateReceiptPrintProfile(id: number, payload: ReceiptPrintProfilePayload): Promise<ReceiptPrintProfile> {
    return institutionalReceipts.updatePrintProfile(id, payload);
  },

  async upsertReceiptProfileAssignment(payload: {
    profile_id?: number;
    profile_code?: ReceiptPrintProfile['code'];
    scope_type: ReceiptProfileAssignment['scope_type'];
    scope_id?: number | null;
    active?: boolean;
  }): Promise<ReceiptProfileAssignment> {
    return institutionalReceipts.upsertAssignment(payload);
  },

  async testPrintInstitutionalReceipt(payload: ReceiptTestPrintPayload): Promise<Blob> {
    return institutionalReceipts.testPrint(payload);
  },

  async registerInstitutionalReceiptPrintEvent(
    id: number,
    reason?: string | null,
    options: { idempotencyKey?: string } = {},
  ): Promise<InstitutionalReceipt> {
    return institutionalReceipts.registerPrintEvent(id, reason, options);
  },

  async getInstitutionalReceiptPdf(
    id: number,
    reason?: string | null,
    options: { idempotencyKey?: string } = {},
  ): Promise<Blob> {
    return institutionalReceipts.pdf(id, reason, options);
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
