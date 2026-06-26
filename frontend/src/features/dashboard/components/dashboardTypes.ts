import type { ReactNode } from 'react';

export type DashboardSectionState = 'loading' | 'error' | 'empty' | 'ready' | 'permission-locked';

export type DashboardSectionCardProps = {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  description?: ReactNode;
  emptyDescription?: string;
  emptyTitle?: string;
  errorMessage?: string;
  loadingLabel?: string;
  onRetry?: () => void;
  state: DashboardSectionState;
  title: ReactNode;
  variant?: 'card' | 'chart';
};

export type SetupStatusStep = {
  done: boolean;
  helper: string;
  label: string;
};

export type SetupStatus = {
  needs_setup: boolean;
  steps: {
    admin_exists: boolean;
    catalog_has_services: boolean;
    fiscal_sequence_exists: boolean;
    fiscal_settings: boolean;
  };
};

export type DashboardNextActionContext = {
  cashSession: { id: number } | null;
  canCreateInvoices: boolean;
  canViewCash: boolean;
  onQuickCash: () => void;
  onQuickInvoice: () => void;
};

export type DashboardMetricsContext = {
  cashSession: { id: number } | null;
  invoiceCount: number | null | undefined;
  loading: boolean;
  todayBilled: string | number | null | undefined;
  todayCollected: string | number | null | undefined;
  todayInvoiceCount: number | null | undefined;
  todayPaymentCount: number | null | undefined;
  totalBilled: string | number | null | undefined;
  totalCollected: string | number | null | undefined;
  totalPending: string | number | null | undefined;
};
