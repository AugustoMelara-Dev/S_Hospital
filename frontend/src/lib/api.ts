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
};
