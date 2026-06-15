export type AuthUser = {
  id: number;
  name: string;
  email: string;
  username: string;
  active: boolean;
  roles: string[];
  permissions: string[];
  service_area_id?: number | null;
  must_change_password: boolean;
};

export type FiscalSettings = {
  id?: number;
  hospital_name: string;
  rtn: string;
  default_tax_rate: string;
  receipt_paper_size?: InstitutionalReceiptPaperSize;
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

export type PublicBranding = Pick<
  FiscalSettings,
  'hospital_name' | 'primary_color' | 'slogan' | 'government_line' | 'secretariat_line' | 'receipt_location'
>;

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

export type Area = {
  id: number;
  name: string;
  slug: string;
  active: boolean;
};

export type ServiceArea = Area;

export type Service = {
  id: number;
  category_id: number;
  area_id?: number | null;
  name: string;
  aliases?: string | null;
  slug: string;
  scan_code?: string | null;
  barcode?: string | null;
  qr_code?: string | null;
  description?: string | null;
  internal_code?: string | null;
  price: string;
  taxable: boolean;
  active: boolean;
  visible_in_billing?: boolean;
  is_billable?: boolean;
  special_rule_code: string | null;
  category?: Category;
  area?: Area | null;
};

export type CategoryPayload = {
  name: string;
  active: boolean;
  sort_order: number;
};

export type ServicePayload = {
  category_id: number;
  area_id?: number | null;
  name: string;
  aliases?: string | null;
  price: string;
  price_change_reason?: string | null;
  scan_code: string | null;
  barcode: string | null;
  qr_code: string | null;
  description?: string | null;
  internal_code?: string | null;
  taxable: boolean;
  active: boolean;
  visible_in_billing?: boolean;
  is_billable?: boolean;
  special_rule_code: string | null;
  print_on_receipt?: boolean;
};

export type InvoiceItemPayload = {
  service_id: number;
  quantity: string;
  dialysis_prescription?: boolean;
  notes?: string | null;
};

export type InvoicePayload = {
  patient_name: string;
  dialysis_prescription?: boolean;
  items: InvoiceItemPayload[];
};

export type InvoiceItem = {
  id: number;
  service_id: number;
  service_name: string;
  category_id: number;
  category_name: string;
  area_id?: number | null;
  area_name?: string | null;
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
  institutional_receipt?: InvoiceInstitutionalReceipt | null;
};

export type InvoiceInstitutionalReceipt = Pick<
  InstitutionalReceipt,
  'id' | 'receipt_number_full' | 'status' | 'issued_at' | 'reprint_count'
>;

export type CashSession = {
  id: number;
  user_id: number;
  user?: Pick<AuthUser, 'id' | 'name' | 'username'>;
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
  pending_invoice_count?: number;
  pending_amount?: string;
};

export type Payment = {
  id: number;
  invoice_id: number;
  cash_session_id: number;
  user_id: number;
  method: 'cash' | 'transfer' | 'card' | 'other';
  amount: string;
  reference: string | null;
  status: 'posted' | 'void';
  voided_by?: number | Pick<AuthUser, 'id' | 'name' | 'username'> | null;
  voided_at?: string | null;
  void_reason?: string | null;
  paid_at: string;
};

export type InstitutionalReceiptPaperSize = 'letter' | 'half_letter' | 'a5' | '80mm' | '58mm';
export type ReceiptPaperSize = InstitutionalReceiptPaperSize;

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

export type InstitutionalReceipt = {
  id: number;
  invoice_id: number | null;
  payment_id: number | null;
  cash_session_id: number;
  series_id: number;
  receipt_number: number;
  receipt_number_full: string;
  status: 'issued' | 'void';
  amount: string;
  amount_cents: number;
  issued_at: string | null;
  issued_by: number;
  payer_name: string;
  concept: string;
  amount_words: string;
  template_code: 'institutional_classic';
  print_profile_code: ReceiptPrintProfile['code'];
  copy_mode: ReceiptPrintProfile['copies_mode'];
  reprint_count: number;
  voided_by: number | null;
  voided_at: string | null;
  void_reason: string | null;
};

export type PaymentRegistrationResult = {
  payment: Payment;
  invoice: Invoice;
  institutional_receipt: InstitutionalReceipt | null;
  institutional_receipt_error: string | null;
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
  total_pending: string;
  total_partial: string;
  total_voided: string;
  invoice_count: number;
  payment_count: number;
  payments_by_method: MoneyByMethod;
  invoices_by_status: Record<'issued' | 'partial' | 'paid' | 'void', { count: number; total: string }>;
};

export type MonthlyReport = {
  month: string;
  date_from: string;
  date_to: string;
  total_billed: string;
  total_collected: string;
  total_pending: string;
  total_partial: string;
  total_voided: string;
  invoice_count: number;
  payment_count: number;
  payments_by_method: MoneyByMethod;
  invoices_by_status: Record<'issued' | 'partial' | 'paid' | 'void', { count: number; total: string }>;
  daily_totals: Array<{
    date: string;
    total_billed: string;
    total_collected: string;
    total_pending: string;
    total_partial: string;
    total_voided: string;
    invoice_count: number;
    payment_count: number;
  }>;
};

export type IncomeReport = {
  date_from: string;
  date_to: string;
  cash_session_id: number | null;
  user_id: number | null;
  filters: ReportFilters;
  total_billed: string;
  total_collected: string;
  total_pending: string;
  total_partial: string;
  total_voided: string;
  payments_by_method: MoneyByMethod;
  invoices_by_status?: Record<'issued' | 'partial' | 'paid' | 'void', { count: number; total: string }>;
  payment_count: number;
  invoice_count: number;
};

export type CategoryReport = {
  date_from: string;
  date_to: string;
  amount_basis: 'billed' | 'collected_prorated';
  amount_label: string;
  amount_source: string;
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

export type AreaReport = {
  date_from: string;
  date_to: string;
  filters: ReportFilters;
  areas: Array<{
    area_id: number | null;
    area: string;
    item_count: number;
    invoice_count: number;
    quantity: string;
    subtotal: string;
    tax_amount: string;
    total: string;
    collected: string;
    balance_due: string;
  }>;
};

export type ServiceSalesReport = {
  date_from: string;
  date_to: string;
  amount_basis: 'billed' | 'collected_prorated';
  amount_label: string;
  amount_source: string;
  filters: ReportFilters;
  services: Array<{
    service: string;
    category: string;
    item_count: number;
    quantity: string;
    total: string;
  }>;
};

export type AreaIncomeReport = {
  date_from: string;
  date_to: string;
  amount_basis: 'billed' | 'collected_prorated';
  amount_label: string;
  amount_source: string;
  filters: ReportFilters;
  areas: Array<{
    area_id: number | null;
    area: string;
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
    service_change_count?: number;
    payment_void_count?: number;
    audit_event_count?: number;
    backup_count: number;
    failed_backup_count: number;
    cashier_count: number;
  };
  voids: Array<{
    invoice_number: string;
    patient_name: string;
    total: string;
    reason: string | null;
    voided_at: string | null;
    user: string | null;
  }>;
  reprints: Array<{
    invoice_number: string | null;
    width: string | null;
    reason: string | null;
    created_at: string | null;
    user: string | null;
  }>;
  payment_voids?: Array<{
    invoice_number: string | null;
    patient_name: string | null;
    method: Payment['method'];
    amount: string;
    reason: string | null;
    voided_at: string | null;
    voided_by: string | null;
    cashier: string | null;
  }>;
  catalog_changes?: Array<{
    action: string;
    service: string;
    old_values: Record<string, string | number | boolean | null | string[]>;
    new_values: Record<string, string | number | boolean | null | string[]>;
    created_at: string | null;
    user: string | null;
  }>;
  audit_events?: Array<{
    id?: number;
    action: string;
    result?: string | null;
    entity_type?: string | null;
    entity_id?: number | null;
    reason?: string | null;
    created_at: string | null;
    user: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
    details?: Record<string, unknown> | null;
  }>;
  backups: Array<{
    filename: string;
    status: string;
    type: string;
    size_bytes: number | null;
    created_at: string | null;
    completed_at: string | null;
    creator: string | null;
  }>;
  cashiers: Array<{
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
  payments_count: number;
  payments_total: string;
  expected_cash_amount: string;
  pending_invoice_count: number;
  pending_amount: string;
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
  summary?: {
    severity: 'ok' | 'warning' | 'error';
    problem_count: number;
    label: string;
  };
  environment: {
    app_env: string;
    app_debug: boolean;
    app_url: string;
    queue_connection: string;
    filesystem_disk: string;
    app_version: string;
    php_version: string;
    server_time: string;
    timezone: string;
  };
  database: {
    connection: string;
    driver: string;
    connected: boolean;
    is_mysql_family: boolean;
  };
  frontend: {
    dist_index_exists: boolean;
    assets_present: boolean;
    assets_count: number;
    entry_label: string;
  };
  network: {
    configured_host: string | null;
    host_type: 'unknown' | 'loopback' | 'lan';
    lan_ready: boolean;
    client_url: string | null;
    guidance: string;
  };
  backups: {
    pending_count: number;
    worker_recently_active: boolean;
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
    frontend_build: {
      available: boolean;
      modified_at: string | null;
    };
    installed_version: string | null;
    latest_migration: string | null;
    migration_count: number | null;
    pending_migration_count: number | null;
    pending_migrations: string[];
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

export type SystemStatusCheck = {
  code: string;
  label: string;
  status: 'validated' | 'warning' | 'error' | 'manual_required';
  detail: string;
};

export type SystemStatusSummary = {
  summary: {
    severity: 'ok' | 'warning' | 'error';
    problem_count: number;
    label: string;
    action: string;
  };
  checks: SystemStatusCheck[];
  advanced_available: boolean;
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
  billing?: boolean;
  categoryId?: number;
  areaId?: number;
  visibleInBilling?: boolean;
  isBillable?: boolean;
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
  area_id?: string | number | null;
  method?: Payment['method'] | '' | null;
  status?: Invoice['status'] | '' | null;
};

export type PdfReportFilters = ReportFilters & { date?: string };

export type DashboardReport = {
  last_7_days: Array<{
    date: string;
    total_billed: string;
    total_collected: string;
    total_pending?: string;
    total_partial?: string;
    total_voided?: string;
    invoice_count: number;
    payment_count: number;
  }>;
  current_month: {
    total_billed: string;
    total_collected: string;
    total_pending?: string;
    total_partial?: string;
    total_voided?: string;
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


export type OperationalHealth = {
  generated_at: string;
  database: {
    driver: string;
    connected: boolean;
    error?: string;
  };
  queue: {
    connection: string;
    pending: number;
    failed: number;
    error?: string;
  };
  backups: {
    worker_recently_active: boolean;
    pending: number;
    success_last_24h: number;
    failed_last_24h: number;
    error?: string;
  };
  storage: {
    backup_files: number;
    backup_bytes: number;
    error?: string;
  };
  recent_errors: Array<{
    id: number;
    action: string;
    entity_type: string;
    created_at: string;
  }>;
};

export type InstitutionalReceiptSeries = {
  id: number;
  document_type: 'institutional_receipt';
  series: string;
  prefix: string;
  number_format: string;
  min_number: number;
  max_number: number;
  current_number: number;
  range_authorization: string | null;
  legal_text: string | null;
  receipt_number_color: string;
  active: boolean;
  reprint_behavior: 'audit_only' | 'require_reason';
  void_behavior: 'permission_reason_audit';
};

export type ReceiptPrintProfile = {
  id: number;
  code: 'recibo_pequeno_personalizado' | 'media_carta_horizontal' | 'a5_horizontal' | 'carta_horizontal' | 'thermal_80mm' | 'thermal_58mm';
  name: string;
  paper_kind: 'custom_mm' | 'half_letter_landscape' | 'a5_landscape' | 'letter_landscape' | 'thermal_80mm' | 'thermal_58mm';
  width_mm: string;
  height_mm: string;
  margin_top_mm: string;
  margin_right_mm: string;
  margin_bottom_mm: string;
  margin_left_mm: string;
  orientation: 'landscape' | 'portrait';
  template_code: 'institutional_classic';
  font_family: string | null;
  font_scale: string;
  copies_mode: 'original_only' | 'original_first' | 'original_first_second';
  show_copy_legend: boolean;
  show_physical_seal_space: boolean;
  use_logo: boolean;
  show_technical_fields: boolean;
  active: boolean;
  is_global_default: boolean;
};

export type ReceiptProfileAssignment = {
  id: number;
  receipt_print_profile_id: number;
  scope_type: 'global' | 'user' | 'cash_session';
  scope_id: number | null;
  active: boolean;
  print_profile?: ReceiptPrintProfile;
};

export type InstitutionalReceiptSettings = {
  institution: FiscalSettings | null;
  active_series: InstitutionalReceiptSeries | null;
  series: InstitutionalReceiptSeries[];
  print_profiles: ReceiptPrintProfile[];
  assignments: ReceiptProfileAssignment[];
  resolved_profile: ReceiptPrintProfile | null;
};

export type ReceiptInstitutionPayload = {
  hospital_name: string;
  rtn?: string | null;
  address?: string | null;
  slogan?: string | null;
  government_line?: string | null;
  secretariat_line?: string | null;
  receipt_location?: string | null;
  receipt_footer_text?: string | null;
  receipt_template_mode?: 'institutional';
};

export type ReceiptSeriesPayload = {
  document_type?: 'institutional_receipt';
  series: string;
  prefix: string;
  number_format?: string;
  min_number: number;
  max_number: number;
  current_number: number;
  range_authorization?: string | null;
  legal_text?: string | null;
  receipt_number_color?: string;
  active: boolean;
  reprint_behavior?: 'audit_only' | 'require_reason';
  void_behavior?: 'permission_reason_audit';
};

export type ReceiptPrintProfilePayload = Partial<Pick<
  ReceiptPrintProfile,
  | 'name'
  | 'paper_kind'
  | 'width_mm'
  | 'height_mm'
  | 'margin_top_mm'
  | 'margin_right_mm'
  | 'margin_bottom_mm'
  | 'margin_left_mm'
  | 'orientation'
  | 'template_code'
  | 'font_family'
  | 'font_scale'
  | 'copies_mode'
  | 'show_copy_legend'
  | 'show_physical_seal_space'
  | 'use_logo'
  | 'show_technical_fields'
  | 'active'
  | 'is_global_default'
>>;

export type ReceiptTestPrintPayload = {
  profile_id?: number;
  profile_code?: ReceiptPrintProfile['code'];
  payer_name?: string;
  concept?: string;
  amount?: string;
};
