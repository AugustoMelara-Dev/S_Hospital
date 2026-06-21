import type { ReactNode } from 'react';
import type { Area, Category, Service } from '../../../lib/api';

export type CatalogFilterState = {
  category: string;
  search: string;
  status: string;
};

export type CatalogToolbarProps = {
  categories: Category[];
  categoryFilter: string;
  hasActiveFilters: boolean;
  isLoading: boolean;
  onActiveFilterChange: (value: string) => void;
  onCategoryFilterChange: (value: string) => void;
  onClearFilters: () => void;
  onSearchChange: (value: string) => void;
  searchInputId?: string;
  searchValue: string;
  statusFilter: string;
};

export type ServiceSummary = {
  count: number;
  total: number;
};

export type ServiceStatusSummaryProps = {
  canManage: boolean;
  onNewCategory: () => void;
  onNewService: () => void;
  summary: ServiceSummary;
};

export type ServiceBillingBadges = {
  active: boolean;
  hasConfiguredPrice: boolean;
  isBillable: boolean;
  isVisibleInBilling: boolean;
  reasons: string[];
};

export type ServiceRowActions = {
  canManage: boolean;
  onEdit: (service: Service) => void;
  onToggleActive: (service: Service) => void;
};

export type ServiceCatalogTableProps = {
  canManage: boolean;
  isLoading: boolean;
  loadError: string;
  onClearFilters: () => void;
  onRetry: () => void;
  onRowActions: ServiceRowActions;
  scannerEnabled: boolean;
  services: Service[];
  hasActiveFilters: boolean;
  categories: Category[];
  areas: Area[];
  isEmpty: boolean;
};

export type CatalogPaginationProps = {
  isLoading: boolean;
  meta: { current_page: number; per_page: number; total: number };
  perPage: number;
  servicesCount: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
};

export type CatalogViewContentProps = {
  canManage: boolean;
  isLoading: boolean;
  loadError: string;
  hasActiveFilters: boolean;
  isEmpty: boolean;
  onClearFilters: () => void;
  onRetry: () => void;
  toolbar: ReactNode;
  pagination: ReactNode;
  table: ReactNode;
};

export type ServiceFormSectionProps = {
  categoryErrorMessage?: string;
  categorySelectId: string;
  categories: Array<{ id: number; name: string }>;
  categoryValue: string;
  isEditing: boolean;
  isScannerEnabled: boolean;
  onCategoryChange: (value: string) => void;
  onSpecialRuleChange: (value: string) => void;
  onTaxableChange: (checked: boolean) => void;
  onActiveChange: (checked: boolean) => void;
  specialRuleValue: string;
};

export type CategoryFormSectionProps = {
  activeValue: boolean;
  errorMessage?: string;
  isEditing: boolean;
  onActiveChange: (checked: boolean) => void;
};

export type ServiceSheetFooterProps = {
  cancelLabel: string;
  isEditing: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
};

export type CategorySheetFooterProps = {
  cancelLabel: string;
  isEditing: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
};

export const CATEGORY_FILTER_ALL = 'all';
export const STATUS_FILTER_ALL = 'all';
export const STATUS_FILTER_ACTIVE = 'active';
export const STATUS_FILTER_INACTIVE = 'inactive';

export const PER_PAGE_OPTIONS = [10, 15, 25, 50] as const;

export const CATALOG_DEBOUNCE_MS = 300;
