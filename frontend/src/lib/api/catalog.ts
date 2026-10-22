import { apiClient } from './base';
import type {
  Area,
  Category,
  CategoryPayload,
  PaginatedMeta,
  Service,
  ServiceArea,
  ServiceFilters,
  ServiceHistoryPage,
  ServicePayload,
} from './types';

/** Edición de impuesto en lote (contrato `PATCH /api/services/bulk-tax`). */
export type ServiceBulkTaxPayload = {
  service_ids?: number[];
  category_id?: number;
  /** `null` = exento. */
  tax_rate_id: number | null;
  reason: string;
};

export type CatalogImportMode = 'preview' | 'apply';

export type CatalogImportError = {
  line: number;
  message: string;
};

/** `preview` no escribe: sólo informa filas válidas y errores. */
export type CatalogImportResult = {
  valid: number;
  applied: number;
  errors: CatalogImportError[];
};

export type CatalogExportFormat = 'csv' | 'xlsx';

export const catalog = {
  async getCategories(active?: boolean): Promise<Category[]> {
    const query = active === undefined ? '' : `?active=${active ? '1' : '0'}`;
    const response = await apiClient.request<{ data: Category[] }>(`/api/categories${query}`);
    return response.data;
  },

  async getAreas(active?: boolean): Promise<Area[]> {
    const query = active === undefined ? '' : `?active=${active ? '1' : '0'}`;
    const response = await apiClient.request<{ data?: Area[] }>(`/api/areas${query}`);
    return Array.isArray(response.data) ? response.data : [];
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

  async getServiceAreas(active?: boolean): Promise<ServiceArea[]> {
    const query = active === undefined ? '' : `?active=${active ? '1' : '0'}`;
    const response = await apiClient.request<{ data?: ServiceArea[] }>(`/api/service-areas${query}`);
    return Array.isArray(response.data) ? response.data : [];
  },


  async getServicesPage(
    filters: ServiceFilters = {},
    options: { signal?: AbortSignal } = {},
  ): Promise<{ data: Service[]; meta: PaginatedMeta }> {
    const params = new URLSearchParams();

    if (filters.search) params.set('search', filters.search);
    if (filters.code) params.set('code', filters.code);
    if (filters.active !== undefined) params.set('active', filters.active ? '1' : '0');
    if (filters.billing !== undefined) {
      params.set('billing', filters.billing ? '1' : '0');
      if (filters.billing) {
        params.set('visible_in_billing', '1');
        params.set('is_billable', '1');
      }
    }
    if (filters.categoryId) params.set('category_id', String(filters.categoryId));
    if (filters.areaId) params.set('area_id', String(filters.areaId));
    if (filters.visibleInBilling !== undefined) params.set('visible_in_billing', filters.visibleInBilling ? '1' : '0');
    if (filters.isBillable !== undefined) params.set('is_billable', filters.isBillable ? '1' : '0');
    if (filters.page) params.set('page', String(filters.page));
    if (filters.perPage) params.set('per_page', String(filters.perPage));

    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await apiClient.request<{ data: Service[]; meta?: PaginatedMeta }>(
      `/api/services${query}`,
      { signal: options.signal },
    );

    return {
      data: response.data,
      meta: response.meta ?? {
        current_page: filters.page ?? 1,
        per_page: filters.perPage ?? response.data.length,
        total: response.data.length,
      },
    };
  },

  async getServices(filters: ServiceFilters = {}, options: { signal?: AbortSignal } = {}): Promise<Service[]> {
    const response = await this.getServicesPage(filters, options);
    return response.data;
  },

  async getService(id: number): Promise<Service> {
    const response = await apiClient.request<{ data: Service }>(`/api/services/${id}`);
    return response.data;
  },

  async getServiceHistory(id: number, page = 1): Promise<ServiceHistoryPage> {
    return apiClient.request<ServiceHistoryPage>(`/api/services/${id}/history?page=${page}&per_page=20`);
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

  async deleteService(id: number): Promise<Service> {
    const response = await apiClient.request<{ data: Service }>(`/api/services/${id}`, {
      method: 'DELETE',
    });

    return response.data;
  },

  /**
   * Reasigna la tasa de impuesto de varios conceptos. El backend decide el
   * resultado; aquí sólo se declara el alcance (ids o categoría) y el motivo
   * obligatorio para la auditoría.
   */
  async bulkTax(payload: ServiceBulkTaxPayload): Promise<number> {
    const response = await apiClient.request<{ data?: { updated?: number } }>('/api/services/bulk-tax', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    return response?.data?.updated ?? 0;
  },

  /**
   * Importa el catálogo desde CSV/XLSX. `preview` no escribe nada; `apply`
   * confirma las filas válidas. La importación de un archivo completo puede
   * exceder el tiempo de una mutación normal: se concede un minuto y medio.
   */
  async importServices(
    file: File,
    mode: CatalogImportMode,
  ): Promise<CatalogImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);

    const response = await apiClient.request<{ data?: CatalogImportResult }>('/api/services/import', {
      method: 'POST',
      body: formData,
      timeout: 90_000,
    });

    return response?.data ?? { valid: 0, applied: 0, errors: [] };
  },

  async exportServices(format: CatalogExportFormat): Promise<Blob> {
    return apiClient.download(`/api/services/export?format=${format}`);
  },
};
