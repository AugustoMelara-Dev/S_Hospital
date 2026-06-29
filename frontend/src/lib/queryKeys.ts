import type { ExecutiveReportFilters, InvoiceFilters, ServiceFilters } from '@/lib/api';

type BackupListFilters = {
  page?: number;
  perPage?: number;
  status?: 'pending' | 'success' | 'failed' | 'all';
};

export const queryKeys = {
  categories: {
    all: ['categories'] as const,
    list: (active?: boolean) => ['categories', { active }] as const,
  },
  areas: {
    all: ['areas'] as const,
    list: (active?: boolean) => ['areas', { active }] as const,
  },
  services: {
    all: ['services'] as const,
    list: (filters: ServiceFilters = {}) => ['services', filters] as const,
    detail: (id: number) => ['services', id] as const,
  },
  invoices: {
    all: ['invoices'] as const,
    list: (filters: InvoiceFilters = {}) => ['invoices', filters] as const,
    detail: (id: number) => ['invoices', id] as const,
  },
  cashSessions: {
    all: ['cash-sessions'] as const,
    current: () => ['cash-sessions', 'current'] as const,
    movements: (id: number | undefined) => ['cash-sessions', id ?? 'unknown', 'movements'] as const,
  },
  settings: {
    all: ['settings'] as const,
    fiscal: () => ['settings', 'fiscal'] as const,
    operational: () => ['settings', 'operational'] as const,
    branding: () => ['settings', 'branding'] as const,
    institutionalReceipts: () => ['settings', 'institutional-receipts'] as const,
  },
  fiscalSequences: {
    all: ['fiscal-sequences'] as const,
    list: () => ['fiscal-sequences'] as const,
  },
  reports: {
    all: ['reports'] as const,
    dashboard: () => ['reports', 'dashboard'] as const,
    today: () => ['reports', 'today'] as const,
    executive: (filters: ExecutiveReportFilters) => ['reports', 'executive', filters] as const,
    cashSession: (id: string | number | undefined) => ['reports', 'cash-sessions', id ?? 'unknown'] as const,
  },
  backups: {
    all: ['backups'] as const,
    list: (filters: BackupListFilters = {}) => ['backups', filters] as const,
    workerHealth: () => ['backups', 'worker-health'] as const,
  },
  system: {
    all: ['system'] as const,
    status: () => ['system', 'status'] as const,
    health: () => ['system', 'health'] as const,
    setupStatus: () => ['system', 'setup-status'] as const,
  },
  audit: {
    all: ['audit'] as const,
  },
};
