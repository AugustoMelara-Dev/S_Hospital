import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/api/queryClient';
import type { Area, Category, ID, ISODateTime, Paginated, TaxRate } from '@/api/types';
import { asList } from './formUtils';

/**
 * Local catalog shapes. They tolerate both the SPEC types (`category_id`) and
 * the real API output (`api/app/schemas/catalog.py`: `category: {id,name}`).
 */
export type CatalogService = {
  id: ID;
  name: string;
  category_id?: ID;
  category?: { id: ID; name: string; active?: boolean } | null;
  area_id?: ID | null;
  area?: { id: ID; name: string } | null;
  price_cents: number;
  tax_rate_id?: ID | null;
  tax_rate?: { id: ID; name: string; rate_bp: number } | null;
  active: boolean;
  visible_in_billing: boolean;
  is_billable: boolean;
  special_rule_code: string | null;
  aliases?: string | null;
  description?: string | null;
  updated_at?: ISODateTime;
};

export const serviceCategoryId = (s: CatalogService): ID | null => s.category_id ?? s.category?.id ?? null;
export const serviceAreaId = (s: CatalogService): ID | null => (s.area_id !== undefined ? s.area_id : (s.area?.id ?? null));
export const serviceTaxId = (s: CatalogService): ID | null =>
  s.tax_rate_id !== undefined ? s.tax_rate_id : (s.tax_rate?.id ?? null);

/** `changed_by` is `{id,name}` in the real API, an id in SPEC types. */
export type PriceHistoryEntry = {
  id: ID;
  old_price_cents: number;
  new_price_cents: number;
  reason: string;
  changed_by: { id: ID; name: string } | ID | null;
  changed_by_name?: string;
  changed_at: ISODateTime;
};

/** Import report (`ImportReport` in api/app/schemas/catalog.py). */
export type ImportLine = {
  line: number;
  category: string;
  name: string;
  action: 'create' | 'update' | 'unchanged' | 'skip' | 'error' | (string & {});
  errors?: string[];
  new_category?: boolean;
};

export type ImportReport = {
  mode?: string;
  applied?: boolean;
  summary: { total?: number; create: number; update: number; unchanged?: number; skip?: number; error: number; new_categories?: string[] };
  lines?: ImportLine[];
  /** SPEC types variant. */
  rows?: ImportLine[];
};

export const importLines = (r: ImportReport): ImportLine[] => r.lines ?? r.rows ?? [];

export type TaxRateRow = TaxRate & { services_count?: number };

type ListOf<T> = T[] | { items: T[] };

export function useCategories() {
  return useQuery({
    queryKey: qk.categories,
    queryFn: async () => asList(await api.get<ListOf<Category>>('/categories')),
  });
}

export function useAreas() {
  return useQuery({
    queryKey: qk.areas,
    queryFn: async () => asList(await api.get<ListOf<Area>>('/areas')),
  });
}

export const taxRatesKey = ['tax-rates'] as const;

export function useTaxRates(enabled = true) {
  return useQuery({
    queryKey: taxRatesKey,
    enabled,
    queryFn: async () => asList(await api.get<ListOf<TaxRateRow>>('/tax-rates')),
  });
}

export type ServiceFilters = { search: string; category_id: string; active: string; page: number };

export function useServices(f: ServiceFilters) {
  const params = { search: f.search.trim(), category_id: f.category_id, active: f.active, page: f.page, per_page: 25 };
  return useQuery({
    queryKey: qk.services(params),
    queryFn: () => api.get<Paginated<CatalogService>>('/services', params),
    placeholderData: (prev) => prev,
  });
}
