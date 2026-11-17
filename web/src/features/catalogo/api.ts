import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/api/queryClient';
import type { Area, Category, ID, Paginated, Service, TaxRate } from '@/api/types';

export const serviceCategoryId = (s: Service): ID => s.category.id;
export const serviceAreaId = (s: Service): ID | null => s.area?.id ?? null;
export const serviceTaxId = (s: Service): ID | null => s.tax_rate?.id ?? null;


export function useCategories() {
  return useQuery({
    queryKey: qk.categories,
    queryFn: async () => (await api.get<Paginated<Category>>('/categories')).items,
  });
}

export function useAreas() {
  return useQuery({
    queryKey: qk.areas,
    queryFn: async () => (await api.get<Paginated<Area>>('/areas')).items,
  });
}

export const taxRatesKey = ['tax-rates'] as const;

export function useTaxRates(enabled = true) {
  return useQuery({
    queryKey: taxRatesKey,
    enabled,
    queryFn: async () => (await api.get<Paginated<TaxRate>>('/tax-rates')).items,
  });
}

export type ServiceFilters = { search: string; category_id: string; active: string; page: number };

export function useServices(f: ServiceFilters) {
  const params = { search: f.search.trim(), category_id: f.category_id, active: f.active, page: f.page, per_page: 25 };
  return useQuery({
    queryKey: qk.services(params),
    queryFn: () => api.get<Paginated<Service>>('/services', params),
    placeholderData: (prev) => prev,
  });
}
