const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? '';

function cookieValue(name: string): string | null {
  const prefix = `${name}=`;
  const cookie = document.cookie
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.slice(prefix.length));
}

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
  scan_code?: string | null;
  barcode?: string | null;
  qr_code?: string | null;
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
  scan_code: string | null;
  barcode: string | null;
  qr_code: string | null;
  taxable: boolean;
  active: boolean;
  special_rule_code: string | null;
};

export type InvoiceItemPayload = {
  service_id: number;
  quantity: string;
  dialysis_prescription?: boolean;
  notes?: string | null;
};

export type InvoicePayload = {
  patient_name: string;
  items: InvoiceItemPayload[];
};

export type InvoiceItem = {
  id: number;
  service_id: number;
  service_name: string;
  category_id: number;
  category_name: string;
  quantity: string;
  unit_price: string;
  tax_rate: string;
  tax_amount: string;
  line_subtotal: string;
  line_total: string;
  special_rule_code: string | null;
  special_rule_applied: boolean;
  notes: string | null;
};

export type Invoice = {
  id: number;
  invoice_number: string;
  patient_name: string;
  subtotal: string;
  tax_amount: string;
  discount_amount: string;
  total: string;
  paid_amount: string;
  balance_due: string;
  status: 'issued' | 'partial' | 'paid' | 'void';
  issued_at: string;
  void_reason?: string | null;
  voided_at?: string | null;
  items: InvoiceItem[];
  payments?: Payment[];
  issuer?: Pick<AuthUser, 'id' | 'name' | 'username'>;
  voided_by?: Pick<AuthUser, 'id' | 'name' | 'username'> | null;
  cash_session?: CashSession & {
    user?: Pick<AuthUser, 'id' | 'name' | 'username'>;
  };
};

export type CashSession = {
  id: number;
  user_id: number;
  opening_amount: string;
  closing_amount: string | null;
  expected_amount: string | null;
  difference_amount: string | null;
  status: 'open' | 'closed';
  opening_notes: string | null;
  closing_notes: string | null;
  opened_at: string;
  closed_at: string | null;
};

export type Payment = {
  id: number;
  invoice_id: number;
  cash_session_id: number;
  user_id: number;
  method: 'cash' | 'transfer' | 'card' | 'other';
  amount: string;
  reference: string | null;
  status: 'posted';
  paid_at: string;
};

export type ReceiptData = {
  width: '80mm' | '58mm';
  hospital: {
    name: string;
    rtn: string | null;
  };
  fiscal: {
    cai: string | null;
    authorized_range: string | null;
    valid_until: string | null;
  };
  invoice: Pick<
    Invoice,
    | 'id'
    | 'invoice_number'
    | 'patient_name'
    | 'subtotal'
    | 'tax_amount'
    | 'discount_amount'
    | 'total'
    | 'paid_amount'
    | 'balance_due'
    | 'status'
  > & {
    issued_at: string;
    cashier: string | null;
  };
  items: Array<
    Pick<
      InvoiceItem,
      | 'service_name'
      | 'category_name'
      | 'quantity'
      | 'unit_price'
      | 'tax_amount'
      | 'line_total'
      | 'special_rule_code'
      | 'special_rule_applied'
      | 'notes'
    >
  >;
  payments: Array<Pick<Payment, 'id' | 'method' | 'amount' | 'reference' | 'paid_at'> & {
    cashier: string | null;
  }>;
};

export type MoneyByMethod = {
  cash: string;
  transfer: string;
  card: string;
  other: string;
};

export type DailyReport = {
  date: string;
  total_billed: string;
  total_collected: string;
  invoice_count: number;
  payment_count: number;
  payments_by_method: MoneyByMethod;
  invoices_by_status: Record<'issued' | 'partial' | 'paid' | 'void', { count: number; total: string }>;
};

export type IncomeReport = {
  date_from: string;
  date_to: string;
  cash_session_id: number | null;
  user_id: number | null;
  total_collected: string;
  payments_by_method: MoneyByMethod;
  payment_count: number;
  invoice_count: number;
};

export type CategoryReport = {
  date_from: string;
  date_to: string;
  categories: Array<{
    category: string;
    item_count: number;
    quantity: string;
    subtotal: string;
    tax_amount: string;
    total: string;
  }>;
};

export type ServiceSalesReport = {
  date_from: string;
  date_to: string;
  services: Array<{
    service: string;
    category: string;
    item_count: number;
    quantity: string;
    total: string;
  }>;
};

export type CashSessionReport = {
  cash_session: CashSession & {
    user?: Pick<AuthUser, 'id' | 'name' | 'username'>;
  };
  totals_by_method: MoneyByMethod;
  total_cash: string;
  total_transfer: string;
  total_card: string;
  total_other: string;
  payments: Array<Payment & {
    invoice?: Pick<
      Invoice,
      'id' | 'invoice_number' | 'patient_name' | 'status' | 'total' | 'paid_amount' | 'balance_due'
    >;
    user?: Pick<AuthUser, 'id' | 'name' | 'username'>;
  }>;
  movements: Array<{
    id: number;
    cash_session_id: number;
    payment_id: number | null;
    user_id: number;
    type: string;
    method: string | null;
    amount: string;
    notes: string | null;
    occurred_at: string;
    user?: Pick<AuthUser, 'id' | 'name' | 'username'>;
  }>;
};

export type BackupLog = {
  id: number;
  filename: string;
  size_bytes: number | null;
  checksum_sha256: string | null;
  status: 'pending' | 'success' | 'failed';
  type: 'manual' | 'scheduled';
  created_by: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  creator?: Pick<AuthUser, 'id' | 'name' | 'username'> | null;
};

export type PaginatedMeta = {
  current_page: number;
  per_page: number;
  total: number;
};

export type ServiceFilters = {
  search?: string;
  code?: string;
  active?: boolean;
  categoryId?: number;
  page?: number;
  perPage?: number;
};

export type InvoiceFilters = {
  date_from?: string;
  date_to?: string;
  status?: Invoice['status'] | '';
  patient?: string;
  invoice_number?: string;
  user_id?: string;
  cash_session_id?: string;
  page?: number;
  per_page?: number;
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
    const method = options.method?.toUpperCase() ?? 'GET';
    const xsrfToken = method === 'GET' || method === 'HEAD' ? null : cookieValue('XSRF-TOKEN');

    const response = await fetch(this.url(path), {
      ...options,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
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

  async getServicesPage(filters: ServiceFilters = {}): Promise<{ data: Service[]; meta: PaginatedMeta }> {
    const params = new URLSearchParams();

    if (filters.search) {
      params.set('search', filters.search);
    }

    if (filters.code) {
      params.set('code', filters.code);
    }

    if (filters.active !== undefined) {
      params.set('active', filters.active ? '1' : '0');
    }

    if (filters.categoryId) {
      params.set('category_id', String(filters.categoryId));
    }

    if (filters.page) {
      params.set('page', String(filters.page));
    }

    if (filters.perPage) {
      params.set('per_page', String(filters.perPage));
    }

    const query = params.toString() ? `?${params.toString()}` : '';

    const response = await this.request<{ data: Service[]; meta?: PaginatedMeta }>(`/api/services${query}`);

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
    const response = await this.request<{ data: Service }>(
      id ? `/api/services/${id}` : '/api/services',
      {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      },
    );

    return response.data;
  },

  async createInvoice(payload: InvoicePayload): Promise<Invoice> {
    const response = await this.request<{ data: Invoice }>('/api/invoices', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return response.data;
  },

  async getInvoices(filters: InvoiceFilters = {}): Promise<{ data: Invoice[]; meta: PaginatedMeta }> {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.set(key, String(value));
      }
    });

    const query = params.toString() ? `?${params.toString()}` : '';

    return this.request<{ data: Invoice[]; meta: PaginatedMeta }>(`/api/invoices${query}`);
  },

  async getInvoice(id: number): Promise<Invoice> {
    const response = await this.request<{ data: Invoice }>(`/api/invoices/${id}`);

    return response.data;
  },

  async getCurrentCashSession(): Promise<CashSession | null> {
    const response = await this.request<{ data: CashSession | null }>('/api/cash-sessions/current');

    return response.data;
  },

  async openCashSession(payload: { opening_amount: string; notes?: string | null }): Promise<CashSession> {
    const response = await this.request<{ data: CashSession }>('/api/cash-sessions/open', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return response.data;
  },

  async closeCashSession(id: number, payload: { closing_amount: string; notes?: string | null }): Promise<CashSession> {
    const response = await this.request<{ data: CashSession }>(`/api/cash-sessions/${id}/close`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return response.data;
  },

  async registerPayment(
    invoiceId: number,
    payload: { cash_session_id: number; method: Payment['method']; amount: string; reference?: string | null },
  ): Promise<{ payment: Payment; invoice: Invoice }> {
    const response = await this.request<{ data: { payment: Payment; invoice: Invoice } }>(
      `/api/invoices/${invoiceId}/payments`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );

    return response.data;
  },

  async getReceipt(invoiceId: number, width?: ReceiptData['width']): Promise<ReceiptData> {
    const query = width ? `?width=${width}` : '';
    const response = await this.request<{ data: ReceiptData }>(
      `/api/invoices/${invoiceId}/receipt${query}`,
    );

    return response.data;
  },

  async reprintInvoice(
    invoiceId: number,
    payload: { width: ReceiptData['width']; reason?: string | null },
  ): Promise<ReceiptData> {
    const response = await this.request<{ data: { receipt: ReceiptData } }>(
      `/api/invoices/${invoiceId}/reprint`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );

    return response.data.receipt;
  },

  async voidInvoice(invoiceId: number, reason: string): Promise<Invoice> {
    const response = await this.request<{ data: Invoice }>(`/api/invoices/${invoiceId}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });

    return response.data;
  },

  async getDailyReport(date?: string): Promise<DailyReport> {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    const response = await this.request<{ data: DailyReport }>(`/api/reports/daily${query}`);

    return response.data;
  },

  async getIncomeReport(filters: {
    date_from: string;
    date_to: string;
    cash_session_id?: string;
    user_id?: string;
  }): Promise<IncomeReport> {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });

    const response = await this.request<{ data: IncomeReport }>(
      `/api/reports/income?${params.toString()}`,
    );

    return response.data;
  },

  async getCategoryReport(filters: { date_from: string; date_to: string }): Promise<CategoryReport> {
    const params = new URLSearchParams(filters);
    const response = await this.request<{ data: CategoryReport }>(
      `/api/reports/categories?${params.toString()}`,
    );

    return response.data;
  },

  async getServiceSalesReport(filters: { date_from: string; date_to: string }): Promise<ServiceSalesReport> {
    const params = new URLSearchParams(filters);
    const response = await this.request<{ data: ServiceSalesReport }>(
      `/api/reports/services?${params.toString()}`,
    );

    return response.data;
  },

  reportExportUrl(filters: {
    date_from: string;
    date_to: string;
    cash_session_id?: string;
    user_id?: string;
  }): string {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });

    return this.url(`/api/reports/export?${params.toString()}`);
  },

  async getCashSessionReport(id: string): Promise<CashSessionReport> {
    const response = await this.request<{ data: CashSessionReport }>(
      `/api/reports/cash-sessions/${encodeURIComponent(id)}`,
    );

    return response.data;
  },

  async getBackups(filters: { page?: number; perPage?: number } = {}): Promise<{ data: BackupLog[]; meta: PaginatedMeta }> {
    const params = new URLSearchParams();

    if (filters.page) {
      params.set('page', String(filters.page));
    }

    if (filters.perPage) {
      params.set('per_page', String(filters.perPage));
    }

    const query = params.toString() ? `?${params.toString()}` : '';

    return this.request<{ data: BackupLog[]; meta: PaginatedMeta }>(`/api/backups${query}`);
  },

  async createBackup(): Promise<BackupLog> {
    const response = await this.request<{ data: BackupLog }>('/api/backups', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    return response.data;
  },

  backupDownloadUrl(id: number): string {
    return this.url(`/api/backups/${encodeURIComponent(id)}/download`);
  },
};
