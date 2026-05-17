const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? '';

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  username: string;
  active: boolean;
  roles: string[];
  permissions: string[];
  must_change_password: boolean;
};

export type FiscalSettings = {
  id?: number;
  hospital_name: string;
  rtn: string;
  default_tax_rate: string;
  receipt_width: '80mm' | '58mm';
};

export type FiscalSequence = {
  id?: number;
  document_type: 'invoice';
  prefix: string;
  min_number: number;
  max_number: number;
  current_number: number;
  cai: string;
  valid_until: string;
  active: boolean;
};

export type Category = {
  id: number;
  name: string;
  slug: string;
  active: boolean;
  sort_order: number;
};

export type Service = {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  price: string;
  taxable: boolean;
  active: boolean;
  special_rule_code: string | null;
  category?: Category;
};

export type CategoryPayload = {
  name: string;
  active: boolean;
  sort_order: number;
};

export type ServicePayload = {
  category_id: number;
  name: string;
  price: string;
  taxable: boolean;
  active: boolean;
  special_rule_code: string | null;
};

export const apiClient = {
  baseUrl: configuredBaseUrl.replace(/\/$/, ''),

  url(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${normalizedPath}`;
  },

  async csrf(): Promise<void> {
    await fetch(this.url('/sanctum/csrf-cookie'), {
      credentials: 'include',
    });
  },

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(this.url(path), {
      ...options,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(error?.message ?? `HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  },

  async login(login: string, password: string): Promise<AuthUser> {
    await this.csrf();
    const response = await this.request<{ data: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    });

    return response.data;
  },

  async me(): Promise<AuthUser> {
    const response = await this.request<{ data: AuthUser }>('/api/auth/me');

    return response.data;
  },

  async logout(): Promise<void> {
    await this.request<{ ok: true }>('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async changePassword(payload: {
    current_password: string;
    password: string;
    password_confirmation: string;
  }): Promise<AuthUser> {
    const response = await this.request<{ data: AuthUser }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return response.data;
  },

  async getFiscalSettings(): Promise<FiscalSettings | null> {
    const response = await this.request<{ data: FiscalSettings | null }>('/api/settings/fiscal');

    return response.data;
  },

  async updateFiscalSettings(payload: FiscalSettings): Promise<FiscalSettings> {
    const response = await this.request<{ data: FiscalSettings }>('/api/settings/fiscal', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    return response.data;
  },

  async getFiscalSequences(): Promise<FiscalSequence[]> {
    const response = await this.request<{ data: FiscalSequence[] }>('/api/fiscal-sequences');

    return response.data;
  },

  async saveFiscalSequence(payload: FiscalSequence): Promise<FiscalSequence> {
    const response = await this.request<{ data: FiscalSequence }>(
      payload.id ? `/api/fiscal-sequences/${payload.id}` : '/api/fiscal-sequences',
      {
        method: payload.id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      },
    );

    return response.data;
  },

  async getCategories(active?: boolean): Promise<Category[]> {
    const query = active === undefined ? '' : `?active=${active ? '1' : '0'}`;
    const response = await this.request<{ data: Category[] }>(`/api/categories${query}`);

    return response.data;
  },

  async saveCategory(payload: CategoryPayload, id?: number): Promise<Category> {
    const response = await this.request<{ data: Category }>(
      id ? `/api/categories/${id}` : '/api/categories',
      {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      },
    );

    return response.data;
  },

  async getServices(
    filters: { search?: string; active?: boolean; categoryId?: number; perPage?: number } = {},
  ): Promise<Service[]> {
    const params = new URLSearchParams();

    if (filters.search) {
      params.set('search', filters.search);
    }

    if (filters.active !== undefined) {
      params.set('active', filters.active ? '1' : '0');
    }

    if (filters.categoryId) {
      params.set('category_id', String(filters.categoryId));
    }

    if (filters.perPage) {
      params.set('per_page', String(filters.perPage));
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await this.request<{ data: Service[] }>(`/api/services${query}`);

    return response.data;
  },

  async saveService(payload: ServicePayload, id?: number): Promise<Service> {
    const response = await this.request<{ data: Service }>(
      id ? `/api/services/${id}` : '/api/services',
      {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      },
    );

    return response.data;
  },
};
