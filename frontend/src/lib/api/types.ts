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
  receipt_paper_size?: ReceiptPaperSize;
  primary_color: 'teal' | 'blue' | 'indigo' | 'green' | 'rose';
  address?: string;
  slogan?: string;
  scanner_enabled?: boolean;
  partial_payments_enabled?: boolean;
  receipt_template_mode?: 'institutional';
  government_line?: string | null;
  secretariat_line?: string | null;
  receipt_location?: string | null;
  receipt_footer_text?: string | null;
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
  payments_count?: number;
  payments_total?: string;
  payments_by_method?: MoneyByMethod;
  expected_cash_amount?: string;
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

export type ReceiptPaperSize = 'letter' | 'half_letter' | 'a5';

export type ReceiptData = {
  width: ReceiptPaperSize;
  hospital: {
    name: string;
    rtn: string | null;
    address?: string | null;
    slogan?: string | null;
  };
  institutional?: {
    template_mode: 'institutional' | string;
    paper_size: ReceiptPaperSize;
    government_line: string | null;
    secretariat_line: string | null;
    location: string | null;
    footer_text: string | null;
    copy_label: string | null;
    signature_label: string | null;
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
    tax_label?: string | null;
    tax_rate?: string | null;
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
  filters: ReportFilters;
  total_collected: string;
  payments_by_method: MoneyByMethod;
  payment_count: number;
  invoice_count: number;
};

export type CategoryReport = {
  date_from: string;
  date_to: string;
  filters: ReportFilters;
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
  filters: ReportFilters;
  services: Array<{
    service: string;
    category: string;
    item_count: number;
    quantity: string;
    total: string;
  }>;
};

export type OperationsReport = {
  date_from: string;
  date_to: string;
  filters: ReportFilters;
  summary: {
    void_count: number;
    reprint_count: number;
    backup_count: number;
    failed_backup_count: number;
    cashier_count: number;
  };
  voids: Array<{
    invoice_id: number;
    invoice_number: string;
    patient_name: string;
    total: string;
    reason: string | null;
    voided_at: string | null;
    user: string | null;
  }>;
  reprints: Array<{
    invoice_id: number | null;
    invoice_number: string | null;
    width: string | null;
    reason: string | null;
    created_at: string | null;
    user: string | null;
  }>;
  backups: Array<{
    id: number;
    filename: string;
    status: string;
    type: string;
    size_bytes: number | null;
    checksum_sha256: string | null;
    created_at: string | null;
    completed_at: string | null;
    creator: string | null;
  }>;
  cashiers: Array<{
    user_id: number;
    name: string;
    username: string;
    payment_count: number;
    cash_session_count: number;
    invoice_count: number;
    total_collected: string;
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
  error_message?: string | null;
  creator?: Pick<AuthUser, 'id' | 'name' | 'username'> | null;
};

export type SystemStatus = {
  environment: {
    app_env: string;
    app_debug: boolean;
    app_url: string;
    queue_connection: string;
    filesystem_disk: string;
    php_version: string;
    server_time: string;
    timezone: string;
  };
  database: {
    connection: string;
    driver: string;
    is_mysql_family: boolean;
  };
  backups: {
    pending_count: number;
    last_success_at: string | null;
    last_success_filename: string | null;
    last_failure_at: string | null;
    last_failure_message: string | null;
    dump_binary: {
      configured: boolean;
      available: boolean;
      name: string | null;
    };
    storage: {
      writable: boolean;
      free_bytes: number | null;
    };
    queue: {
      connection: string;
      jobs_table_available: boolean;
      failed_jobs_table_available: boolean;
      failed_jobs_count: number | null;
      pending_backup_jobs: number | null;
      worker_command: string;
      scheduler_command: string;
    };
  };
  runtime: {
    logs_writable: boolean;
    cache_writable: boolean;
    laravel_log: {
      exists: boolean;
      size_bytes: number | null;
      modified_at: string | null;
    };
    backup_automation_log: {
      exists: boolean;
      size_bytes: number | null;
      modified_at: string | null;
    };
    latest_migration: string | null;
    migration_count: number | null;
  };
  readiness: {
    state: 'DEMO_READY' | 'PRODUCTION_CANDIDATE' | 'PRODUCTION_READY';
    production_ready: boolean;
    blockers: Array<{
      code: string;
      label: string;
      status: 'pending' | 'partial' | 'validated';
    }>;
  };
  preflight: {
    production_checks: Array<{
      code: string;
      label: string;
      status: 'pending' | 'partial' | 'validated' | 'manual_required';
      detail: string;
    }>;
    public_routes: Array<{
      path: string;
      expected: string;
      status: 'pending' | 'partial' | 'validated' | 'manual_required';
    }>;
    physical_proofs: Array<{
      code: string;
      label: string;
      required_file: string;
      status: 'pending' | 'partial' | 'validated' | 'manual_required';
      detail: string;
    }>;
    commands: {
      preflight: string;
      backup_worker: string;
      scheduler: string;
    };
  };
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

export type ReportFilters = {
  date_from: string;
  date_to: string;
  cash_session_id?: string | number | null;
  user_id?: string | number | null;
  category_id?: string | number | null;
  method?: Payment['method'] | '' | null;
  status?: Invoice['status'] | '' | null;
};

export type DashboardReport = {
  last_7_days: Array<{
    date: string;
    total_billed: string;
    total_collected: string;
    invoice_count: number;
    payment_count: number;
  }>;
  current_month: {
    total_billed: string;
    total_collected: string;
    invoice_count: number;
    payment_count: number;
  };
  payments_by_method: MoneyByMethod;
  top_services: Array<{
    service_name: string;
    category_name: string;
    quantity: string;
    total: string;
  }>;
  cashiers_summary: Array<{
    user_id: number;
    name: string;
    username: string;
    payment_count: number;
    total_collected: string;
  }>;
};
