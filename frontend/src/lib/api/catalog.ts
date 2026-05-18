import { apiClient } from './base';
import type { Category, CategoryPayload, Service, ServicePayload, ServiceFilters, PaginatedMeta } from './types';

export const catalog = {
  async getCategories(active?: boolean): Promise<Category[]> {
    const query = active === undefined ? '' : `?active=${active ? '1' : '0'}`;
    const response = await apiClient.request<{ data: Category[] }>(`/api/categories${query}`);
    return response.data;
  },

  async saveCategory(payload: CategoryPayload, id?: number): Promise<Category> {
    const response = await apiClient.request<{ data: Category }>(
      id ? `/api/categories/${id}` : '/api/categories',
      {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      },
    );
    return response.data;
  },

  async getServicesPage(filters: ServiceFilters = {}): Promise<{ data: Service[]; meta: PaginatedMeta }> {
    const params = new URLSearchParams();

    if (filters.search) params.set('search', filters.search);
    if (filters.code) params.set('code', filters.code);
    if (filters.active !== undefined) params.set('active', filters.active ? '1' : '0');
    if (filters.categoryId) params.set('category_id', String(filters.categoryId));
    if (filters.page) params.set('page', String(filters.page));
    if (filters.perPage) params.set('per_page', String(filters.perPage));

    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await apiClient.request<{ data: Service[]; meta?: PaginatedMeta }>(`/api/services${query}`);

    return {
      data: response.data,
      meta: response.meta ?? {
        current_page: filters.page ?? 1,
        per_page: filters.perPage ?? response.data.length,
        total: response.data.length,
      },
    };
  },

  async getServices(filters: ServiceFilters = {}): Promise<Service[]> {
    const response = await this.getServicesPage(filters);
    return response.data;
  },

  async saveService(payload: ServicePayload, id?: number): Promise<Service> {
    const response = await apiClient.request<{ data: Service }>(
      id ? `/api/services/${id}` : '/api/services',
      {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      },
    );
    return response.data;
  },
};